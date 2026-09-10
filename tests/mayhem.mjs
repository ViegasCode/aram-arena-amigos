import assert from 'node:assert/strict';
import {standings,validateEntries,riotMayhem} from '../lib/mayhem.ts';
const players=[{id:'a',name:'A',riot_id:'A',tagline:'BR1'},{id:'b',name:'B',riot_id:'B',tagline:'BR1'},{id:'c',name:'C'}];
const ranked=standings(players,[{player_id:'b',win:0}]);assert.equal(ranked[0].id,'b');assert.equal(ranked[0].points,0);assert.equal(ranked[1].games,0);
assert.throws(()=>validateEntries([{playerId:'a',win:1},{playerId:'a',win:0}]));assert.throws(()=>validateEntries([{playerId:'a',win:2}]));
assert.throws(()=>riotMayhem({info:{queueId:450}},players));
const info={queueId:2400,gameMode:'KIWI',gameEndTimestamp:1,gameStartTimestamp:Date.now(),gameDuration:1200,participants:Array.from({length:10},(_,i)=>({riotIdGameName:i===0?'a':'other'+i,riotIdTagline:'br1',win:i<5}))};
assert.deepEqual(riotMayhem({info},players.slice(0,2)).entries,[{playerId:'a',win:1}]);
assert.throws(()=>riotMayhem({info:{...info,gameDuration:120}},players));
console.log('PASS scoring, unranked ordering, duplicate participants, mode validation, Riot matching and remake guard.');
const origin='http://localhost:3000',headers={'Content-Type':'application/json',Origin:origin,Cookie:'__sites_local_auth=1'};
async function get(path){const r=await fetch(origin+path);assert.equal(r.status,200);return r.json()}
async function post(b,status=200,h=headers){const r=await fetch(origin+'/api/mayhem',{method:'POST',headers:h,body:JSON.stringify(b)}),d=await r.text();assert.equal(r.status,status,d);return d}
const before=await get('/api/arena'),p=before.players[0];assert(p);
const state=await get('/api/mayhem'),initial=state.ranking.find(x=>x.id===p.id).points;
const body={action:'manual',matchId:'BR1_'+Date.now(),playedAt:new Date().toISOString(),confirmed:true,entries:[{playerId:p.id,win:1}]};
await post(body,403,{'Content-Type':'application/json',Origin:origin});await post(body,403,{...headers,Origin:'https://bad.example'});
await post({...body,playedAt:'2020-01-01'},400);await post({...body,confirmed:false},400);
await post(body);await post(body,409);
let m=await get('/api/mayhem');assert.equal(m.ranking.find(x=>x.id===p.id).points,initial+3);
await post({action:'void',matchId:body.matchId,reason:'Resultado de teste anulado'});
m=await get('/api/mayhem');assert.equal(m.ranking.find(x=>x.id===p.id).points,initial);assert(m.matches.find(x=>x.id===body.matchId).void_reason);
const after=await get('/api/arena');for(const field of ['players','matches','results','adjustments','championship'])assert.deepEqual(after[field],before[field],field+' must not change');
console.log('PASS persistent results, auth/CSRF, period, confirmation, duplicates, void and complete championship isolation.');
