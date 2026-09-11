import {env} from 'cloudflare:workers';
import {database,identity} from '@/lib/server';
import {profileData} from '@/lib/riot-profile';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const cleanRiot=(value:string)=>value.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'').trim();
export async function POST(request:Request) {
 try {
  const who=await identity();
  if(!who.admin)return json({error:'Somente o administrador pode atualizar os perfis Riot.'},403);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido.'},415);
  const raw=await request.text();if(raw.length>1000)return json({error:'Envio muito grande.'},413);
  const b=JSON.parse(raw);if(typeof b.playerId!=='string'||b.playerId.length>100)return json({error:'Jogador inválido.'},400);
  const db=database(),p=await db.prepare('SELECT id,riot_id,tagline FROM players WHERE id=?').bind(b.playerId).first<{id:string;riot_id:string;tagline:string}>();
  if(!p)return json({error:'Jogador não encontrado.'},404);
  const riotId=cleanRiot(p.riot_id),tagline=cleanRiot(p.tagline);
  if(!riotId||!tagline)return json({error:'O Riot ID cadastrado está inválido. Corrija o cadastro e tente novamente.'},400);
  const cached=await db.prepare('SELECT fetched_at FROM riot_profiles WHERE player_id=? AND lower(riot_id)=lower(?) AND lower(tagline)=lower(?)').bind(p.id,riotId,tagline).first<{fetched_at:string}>();
  if(cached&&Date.now()-Date.parse(cached.fetched_at)<300000)return json({ok:true,cached:true});
  const key=(env as unknown as {RIOT_API_KEY?:string}).RIOT_API_KEY;
  if(!key)return json({error:'A chave Riot precisa ser configurada pelo administrador.'},503);
  async function get(host:string,path:string){
   const r=await fetch(`https://${host}.api.riotgames.com${path}`,{headers:{'X-Riot-Token':key!},redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error(r.status===404?'Conta não encontrada na Riot/servidor BR. Confira o Riot ID.':r.status===429?'Limite da Riot atingido. Aguarde alguns minutos.':[401,403].includes(r.status)?'A chave Riot precisa ser revisada.':'A Riot está indisponível. Tente novamente.');
   return r.json() as Promise<any>;
  }
  const account=await get('americas',`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(riotId)}/${encodeURIComponent(tagline)}`);
  if(typeof account.puuid!=='string')throw new Error('A Riot retornou um perfil incompleto.');
  const puuid=encodeURIComponent(account.puuid);
  await new Promise(r=>setTimeout(r,1100));
  const summoner=await get('br1',`/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  await new Promise(r=>setTimeout(r,1100));
  const leagues=await get('br1',`/lol/league/v4/entries/by-puuid/${puuid}`);
  const profile=profileData(account,summoner,leagues),now=new Date().toISOString();
  const saved=await db.batch([
   db.prepare('INSERT INTO riot_profiles(player_id,riot_id,tagline,profile,fetched_at) VALUES(?,?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET riot_id=excluded.riot_id,tagline=excluded.tagline,profile=excluded.profile,fetched_at=excluded.fetched_at').bind(p.id,riotId,tagline,JSON.stringify(profile),now),
   db.prepare('UPDATE players SET riot_id=?,tagline=?,puuid=? WHERE id=?').bind(riotId,tagline,account.puuid,p.id),
   db.prepare('INSERT INTO audit_logs(id,actor,action,details,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),who.user!.userId,'riot.profile_sync',JSON.stringify({playerId:p.id}),now),
  ]);
  if(!saved[0].meta.changes)return json({error:'Não foi possível salvar o perfil atualizado.'},409);
  return json({ok:true,profile:{...profile,fetchedAt:now}});
 } catch(e) {
  const message=e instanceof Error?e.message:'';
  console.error('riot.profile_sync.failed', message.replace(/RGAPI-[\w-]+/g, '[secret]').replace(/https?:\/\/[^\s]+/g, '[url]'));
  return json({error:message.startsWith('A Riot')||message.startsWith('Conta ')||message.startsWith('Limite ')||message.startsWith('A chave ')?message:'Não foi possível atualizar este perfil. Os dados anteriores foram preservados.'},502);
 }
}
