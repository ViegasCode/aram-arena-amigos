import { env } from 'cloudflare:workers';
import {database,identity} from '@/lib/server';
import {MAYHEM_START,standings,validateEntries,riotMayhem} from '@/lib/mayhem';
export const dynamic = 'force-dynamic';
const json = (body:unknown,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET() {
 try {
  const db=database();
  const [p,m,r]=await db.batch([
   db.prepare('SELECT id,name,riot_id,tagline,active FROM players ORDER BY name'),
   db.prepare('SELECT id,played_at,source,void_reason FROM mayhem_matches ORDER BY played_at DESC'),
   db.prepare('SELECT r.* FROM mayhem_results r JOIN mayhem_matches m ON m.id=r.match_id WHERE m.void_reason IS NULL'),
  ]);
  return json({ranking:standings(p.results,r.results),matches:m.results,results:r.results,startAt:MAYHEM_START});
 } catch {return json({error:'Não foi possível carregar o ranking Mayhem.'},503);}
}
export async function POST(request:Request) {
 try {
  const who=await identity();
  if (!who.admin) return json({error:'Somente o administrador pode registrar resultados.'},403);
  if(request.headers.get('origin')!==new URL(request.url).origin) return json({error:'Origem inválida.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido.'},415);
  const raw=await request.text();if(raw.length>16000)return json({error:'Envio muito grande.'},413);
  const b=JSON.parse(raw),db=database(),now=new Date().toISOString();
  if(typeof b.matchId!=='string'||!/^BR1_[0-9]{5,20}$/.test(b.matchId))throw new Error('Informe o Match ID completo: BR1_ seguido dos números da partida.');
  if(b.action==='void') {
   if(typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>500)throw new Error('Explique o motivo da anulação (5 a 500 caracteres).');
   const changed=await db.batch([
    db.prepare('UPDATE mayhem_matches SET void_reason=? WHERE id=? AND void_reason IS NULL').bind(b.reason.trim(),b.matchId),
    db.prepare('INSERT INTO audit_logs(id,actor,action,details,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),who.user!.userId,'mayhem.void',JSON.stringify({id:b.matchId,reason:b.reason.trim()}),now),
   ]);
   if(!changed[0].meta.changes)throw new Error('Partida não encontrada ou já anulada.');
   return json({ok:true});
  }
  if(!['manual','riot'].includes(b.action))throw new Error('Ação inválida.');
  if(await db.prepare('SELECT id FROM mayhem_matches WHERE id=?').bind(b.matchId).first())return json({error:'Esta partida já foi registrada no Mayhem.'},409);
  const players=(await db.prepare('SELECT id,riot_id,tagline,created_at FROM players').all()).results as any[];
  let entries:{playerId:string;win:number}[],playedAt:string;
  if(b.action==='riot') {
   const key=(env as unknown as {RIOT_API_KEY?:string}).RIOT_API_KEY;
   if(!key)return json({error:'Importação Riot não configurada. O administrador pode registrar o resultado conferido.'},503);
   const response=await fetch(`https://americas.api.riotgames.com/lol/match/v5/matches/${b.matchId}`,{headers:{'X-Riot-Token':key},redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok) {
    const error=response.status===404?'A Riot não disponibilizou esta partida. Aguarde o término ou registre o resultado conferido.':response.status===429?'Limite da Riot atingido. Aguarde antes de tentar novamente.':[401,403].includes(response.status)?'A chave Riot precisa ser revisada pelo administrador.':'A Riot está indisponível. Tente novamente.';
    return json({error},response.status===429?429:502);
   }
   const body=await response.json() as any;
   if(body.metadata?.matchId!==b.matchId)throw new Error('A resposta da Riot não corresponde à partida solicitada.');
   ({entries,playedAt}=riotMayhem(body,players));
  } else {
   if(b.confirmed!==true)throw new Error('Confirme que conferiu o resultado de ARAM Mayhem.');
   entries=validateEntries(b.entries);
   const time=Date.parse(b.playedAt);if(!Number.isFinite(time))throw new Error('Informe a data da partida.');
   playedAt=new Date(time).toISOString();
  }
  if(playedAt<MAYHEM_START||playedAt>now)throw new Error('A partida deve estar dentro do período do ranking e não pode estar no futuro.');
  if(entries.some(r=>!players.some(p=>p.id===r.playerId&&p.created_at<=playedAt)))throw new Error('Todos os participantes precisam ter cadastro anterior à partida.');
  await db.batch([
   db.prepare('INSERT INTO mayhem_matches(id,played_at,source,created_at,actor) VALUES(?,?,?,?,?)').bind(b.matchId,playedAt,b.action,now,who.user!.userId),
   ...entries.map(r=>db.prepare('INSERT INTO mayhem_results(match_id,player_id,win) VALUES(?,?,?)').bind(b.matchId,r.playerId,r.win)),
   db.prepare('INSERT INTO audit_logs(id,actor,action,details,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),who.user!.userId,'mayhem.record',JSON.stringify({id:b.matchId,source:b.action,entries}),now),
  ]);
  return json({ok:true,participants:entries.length});
 } catch(e) {
  const message=e instanceof Error?e.message:'';
  return json({error:/UNIQUE|constraint/.test(message)?'Partida duplicada. Nenhum ponto foi repetido.':/D1|SQLITE|fetch|timeout/i.test(message)?'Não foi possível registrar. Tente novamente.':message||'Não foi possível registrar.'},400);
 }
}
