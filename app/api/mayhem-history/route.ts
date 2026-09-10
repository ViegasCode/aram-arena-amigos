import {env} from 'cloudflare:workers';
import {database,identity} from '@/lib/server';
import {MAYHEM_START} from '@/lib/mayhem';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request) {
 try {
  const who=await identity();
  if(!who.admin)return json({error:'Somente o administrador pode buscar partidas.'},403);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido.'},415);
  const raw=await request.text();if(raw.length>1000)return json({error:'Envio muito grande.'},413);
  const b=JSON.parse(raw);if(typeof b.playerId!=='string'||b.playerId.length>100)return json({error:'Jogador inválido.'},400);
  const db=database(),p=await db.prepare('SELECT id,riot_id,tagline,puuid,created_at FROM players WHERE id=?').bind(b.playerId).first<{id:string;riot_id:string;tagline:string;puuid:string|null;created_at:string}>();
  if(!p)return json({error:'Jogador não encontrado.'},404);
  const key=(env as unknown as {RIOT_API_KEY?:string}).RIOT_API_KEY;
  if(!key)return json({error:'A chave Riot precisa ser configurada.'},503);
  async function get(path:string){
   const r=await fetch(`https://americas.api.riotgames.com${path}`,{headers:{'X-Riot-Token':key!},redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(!r.ok) return {status:r.status,data:null};
   return {status:200,data:await r.json() as any};
  }
  let puuid=p.puuid;
  if(!puuid){
   const account=await get(`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(p.riot_id)}/${encodeURIComponent(p.tagline)}`);
   if(account.status!==200)return failure(account.status);
   if(typeof account.data?.puuid!=='string')return json({error:'A Riot retornou uma conta incompleta.'},502);
   puuid=account.data.puuid;
   await new Promise(r=>setTimeout(r,1200));
  }
  const startTime=Math.ceil(Math.max(Date.parse(MAYHEM_START),Date.parse(p.created_at))/1000);
  const result=await get(`/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid!)}/ids?queue=2400&start=0&count=100&startTime=${startTime}`);
  if(result.status!==200)return failure(result.status);
  if(!Array.isArray(result.data)||result.data.some((id:unknown)=>typeof id!=='string'||!/^BR1_[0-9]{5,20}$/.test(id)))return json({error:'A Riot retornou uma lista de partidas inválida.'},502);
  return json({matchIds:[...new Set(result.data)],limit:100,possiblyMore:result.data.length===100});
 }catch{return json({error:'Não foi possível consultar o histórico na Riot. Tente novamente.'},502);}
}
function failure(status:number){
 return json({error:status===429?'Limite da Riot atingido. Aguarde alguns minutos e tente novamente.':[401,403].includes(status)?'A chave Riot precisa ser revisada.':status===404?'Conta ou histórico não encontrado na Riot.':'A Riot está indisponível. Tente novamente.'},status===429?429:502);
}
