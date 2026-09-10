import assert from 'node:assert/strict';
import {riotMayhem} from '../lib/mayhem.ts';
const players=[{id:'a',puuid:'stable',riot_id:'oldname',tagline:'BR1'}];
const info={queueId:2400,gameMode:'KIWI',gameEndTimestamp:1,gameStartTimestamp:Date.now(),gameDuration:1200,participants:Array.from({length:10},(_,i)=>({puuid:i===0?'stable':'other'+i,riotIdGameName:'newname',riotIdTagline:'br1',win:i<5}))};
assert.deepEqual(riotMayhem({info},players).entries,[{playerId:'a',win:1}]);
assert.throws(()=>riotMayhem({info:{...info,queueId:450}},players));
const origin='http://localhost:3000',headers={'Content-Type':'application/json',Origin:origin,Cookie:'__sites_local_auth=1'};
const data=await fetch(origin+'/api/arena').then(r=>r.json()),id=data.players[0].id;
async function post(h,b={playerId:id}){return fetch(origin+'/api/mayhem-history',{method:'POST',headers:h,body:JSON.stringify(b)})}
assert.equal((await post({...headers,Cookie:''})).status,403);
assert.equal((await post({...headers,Origin:'https://invalid.example'})).status,403);
assert.equal((await post(headers,{})).status,400);
assert.equal((await post(headers,{playerId:'missing'})).status,404);
assert.equal((await post(headers)).status,503);
console.log('PASS history auth, CSRF, input validation, missing key handling and stable PUUID matching.');
