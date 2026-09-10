import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs/promises';

const PORT=47831;
const MAYHEM_START=Date.parse('2026-09-10T00:30:00.000Z');
const ALLOWED=new Set(['https://aram-arena-amigos.codingviegas.chatgpt.site','http://localhost:3000','http://127.0.0.1:3000']);
const lockfile=process.env.RIOT_LOCKFILE||'C:\\Riot Games\\League of Legends\\lockfile';

async function lcu(path){
 const raw=await fs.readFile(lockfile,'utf8');
 const [,pid,port,password,protocol]=raw.trim().split(':');
 return await new Promise((resolve,reject)=>{const req=https.request({hostname:'127.0.0.1',port:Number(port),path,method:'GET',rejectUnauthorized:false,headers:{Authorization:`Basic ${Buffer.from(`riot:${password}`).toString('base64')}`}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>{if((res.statusCode||500)>=400)return reject(new Error('O cliente recusou a consulta.'));try{resolve(JSON.parse(body));}catch{reject(new Error('Resposta inválida do cliente.'));}})});req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('Tempo esgotado.')));req.end();});
}
function sanitize(game){
 const names=new Map((game.participantIdentities||[]).map(x=>[x.participantId,{gameName:x.player?.gameName||x.player?.summonerName||'',tagLine:x.player?.tagLine||''}]));
 const participants=(game.participants||[]).map(p=>({...names.get(p.participantId),win:p.stats?.win===true}));
 return {matchId:`BR1_${game.gameId}`,playedAt:new Date(game.gameCreation).toISOString(),duration:game.gameDuration,queueId:game.queueId,gameMode:game.gameMode,gameType:game.gameType,complete:game.endOfGameResult==='GameComplete',remake:game.gameDuration<300||(game.participants||[]).some(p=>p.stats?.gameEndedInEarlySurrender),participants};
}
function headers(origin){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Private-Network':'true','Access-Control-Max-Age':'600','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','Vary':'Origin'};}
http.createServer(async(req,res)=>{
 const origin=req.headers.origin||'';if(!ALLOWED.has(origin)){res.writeHead(403,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Origem não autorizada.'}));}
 if(req.method==='OPTIONS'){res.writeHead(204,headers(origin));return res.end();}
 if(req.method!=='GET'||req.url!=='/matches'){res.writeHead(404,headers(origin));return res.end(JSON.stringify({error:'Rota não encontrada.'}));}
 try{
  const history=await lcu('/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=39');
  const candidates=(history.games?.games||[]).filter(g=>g.queueId===2400&&g.gameMode==='KIWI'&&g.gameCreation>=MAYHEM_START);
  const full=[];for(const item of candidates)full.push(await lcu(`/lol-match-history/v1/games/${item.gameId}`));
  res.writeHead(200,headers(origin));res.end(JSON.stringify({matches:full.map(sanitize)}));
 }catch(e){res.writeHead(503,headers(origin));res.end(JSON.stringify({error:e instanceof Error?e.message:'Abra o League of Legends.'}));}
}).listen(PORT,'127.0.0.1');
