import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';

const PORT=47831;
const MAYHEM_START=Date.parse('2026-09-10T00:30:00.000Z');
const ALLOWED=new Set(['https://aram-arena-amigos.codingviegas.chatgpt.site','http://localhost:3000','http://127.0.0.1:3000']);
const lockfile=process.env.RIOT_LOCKFILE||'C:\\Riot Games\\League of Legends\\lockfile';

async function lcu(path){
 const raw=await fs.readFile(lockfile,'utf8');
 const [,pid,port,password,protocol]=raw.trim().split(':');
 return await new Promise((resolve,reject)=>{const req=https.request({hostname:'127.0.0.1',port:Number(port),path,method:'GET',rejectUnauthorized:false,headers:{Authorization:`Basic ${Buffer.from(`riot:${password}`).toString('base64')}`}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>{if((res.statusCode||500)>=400)return reject(new Error('O cliente recusou a consulta.'));try{resolve(JSON.parse(body));}catch{reject(new Error('Resposta inválida do cliente.'));}})});req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('Tempo esgotado.')));req.end();});
}
function sanitize(game,champions=new Map()){
 const names=new Map((game.participantIdentities||[]).map(x=>[x.participantId,{gameName:x.player?.gameName||x.player?.summonerName||'',tagLine:x.player?.tagLine||''}]));
 const participants=(game.participants||[]).map(p=>{const s=p.stats||{},identity=names.get(p.participantId)||{};return {...identity,win:s.win===true,teamId:p.teamId,championId:p.championId,championName:champions.get(p.championId)||'',kills:s.kills||0,deaths:s.deaths||0,assists:s.assists||0,damage:s.totalDamageDealtToChampions||0,damageTaken:s.totalDamageTaken||0,healing:s.totalHeal||0,shielding:s.totalDamageShieldedOnTeammates||0,gold:s.goldEarned||0,cs:(s.totalMinionsKilled||0)+(s.neutralMinionsKilled||0),items:[s.item0,s.item1,s.item2,s.item3,s.item4,s.item5,s.item6].filter(Number.isInteger),augments:[s.playerAugment1,s.playerAugment2,s.playerAugment3,s.playerAugment4,s.playerAugment5,s.playerAugment6].filter(x=>Number.isInteger(x)&&x>0)};});
 return {matchId:`BR1_${game.gameId}`,playedAt:new Date(game.gameCreation).toISOString(),duration:game.gameDuration,queueId:game.queueId,gameMode:game.gameMode,gameType:game.gameType,complete:game.endOfGameResult==='GameComplete',remake:game.gameDuration<300||(game.participants||[]).some(p=>p.stats?.gameEndedInEarlySurrender),participants};
}
async function sanitizeGames(games){const ids=[...new Set(games.flatMap(g=>(g.participants||[]).map(p=>p.championId)).filter(Number.isInteger))],champions=new Map();await Promise.all(ids.map(async id=>{try{const data=await lcu(`/lol-game-data/assets/v1/champions/${id}.json`);if(typeof data?.name==='string')champions.set(id,data.name)}catch{}}));return games.map(game=>sanitize(game,champions));}
function headers(origin){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Private-Network':'true','Access-Control-Max-Age':'600','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','Vary':'Origin'};}
http.createServer(async(req,res)=>{
 const origin=req.headers.origin||'';
 if(req.method==='GET'&&req.url==='/sync'){
  try{const history=await lcu('/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=39');const candidates=(history.games?.games||[]).filter(g=>g.queueId===2400&&g.gameMode==='KIWI'&&g.gameCreation>=MAYHEM_START);const full=[];for(const item of candidates)full.push(await lcu(`/lol-match-history/v1/games/${item.gameId}`));const payload=deflateRawSync(Buffer.from(JSON.stringify({matches:await sanitizeGames(full)}))).toString('base64url');res.writeHead(302,{Location:`https://aram-arena-amigos.codingviegas.chatgpt.site/?view=Mayhem#mayhem-sync-z=${payload}`,'Cache-Control':'no-store'});return res.end();}catch{res.writeHead(302,{Location:'https://aram-arena-amigos.codingviegas.chatgpt.site/?view=Mayhem#mayhem-client-error'});return res.end();}
 }
 if(!ALLOWED.has(origin)){res.writeHead(403,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Origem não autorizada.'}));}
 if(req.method==='OPTIONS'){res.writeHead(204,headers(origin));return res.end();}
 if(req.method!=='GET'||req.url!=='/matches'){res.writeHead(404,headers(origin));return res.end(JSON.stringify({error:'Rota não encontrada.'}));}
 try{
  const history=await lcu('/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=39');
  const candidates=(history.games?.games||[]).filter(g=>g.queueId===2400&&g.gameMode==='KIWI'&&g.gameCreation>=MAYHEM_START);
  const full=[];for(const item of candidates)full.push(await lcu(`/lol-match-history/v1/games/${item.gameId}`));
  res.writeHead(200,headers(origin));res.end(JSON.stringify({matches:await sanitizeGames(full)}));
 }catch(e){res.writeHead(503,headers(origin));res.end(JSON.stringify({error:e instanceof Error?e.message:'Abra o League of Legends.'}));}
}).listen(PORT,'127.0.0.1');
