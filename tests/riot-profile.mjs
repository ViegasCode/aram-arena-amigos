import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync,unlinkSync} from 'node:fs';
import {profileData} from '../lib/riot-profile.ts';
const profile=profileData({gameName:'QA',tagLine:'BR1',puuid:'private'},{profileIconId:784,summonerLevel:55},[{queueType:'RANKED_SOLO_5x5',tier:'GOLD',rank:'II',leaguePoints:30,wins:8,losses:2},{queueType:'OTHER',tier:'OTHER'}]);
assert.equal(profile.ranked.length,1);assert.equal(profile.ranked[0].wins,8);assert.equal(JSON.stringify(profile).includes('private'),false);assert.deepEqual(profileData({gameName:'QA',tagLine:'BR1'},{profileIconId:0,summonerLevel:1},[]).ranked,[]);assert.throws(()=>profileData({}, {}, []));assert.throws(()=>profileData({gameName:'QA',tagLine:'BR1'},{profileIconId:1,summonerLevel:1},null));
const origin='http://localhost:3000',headers={Origin:origin,'Content-Type':'application/json',Cookie:'__sites_local_auth=1',Connection:'close'};
const get=async()=>{const r=await fetch(origin+'/api/arena',{headers});assert.equal(r.status,200);return r.json()};
async function post(path,body,h=headers){return fetch(origin+path,{method:'POST',headers:h,body:JSON.stringify(body)})}
const name='Riot QA '+Date.now(),b={action:'player',name,riotId:name,tagline:'QA',active:true};const created=await post('/api/arena',b);assert.equal(created.status,200);const {id}=await created.json();
const sqlQuote=s=>"'"+s.replaceAll("'","''")+"'";
const file='.wrangler/riot-profile-test.sql';writeFileSync(file,`INSERT INTO riot_profiles(player_id,riot_id,tagline,profile,fetched_at) VALUES(${sqlQuote(id)},${sqlQuote(name)},'QA',${sqlQuote(JSON.stringify(profile))},'2020-01-01T00:00:00Z');`);
try{const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','site-creator-d1','--local','--config','.wrangler-local.json','--file',file],{encoding:'utf8',env:{...process.env,WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:'.wrangler/logs'}});assert.equal(r.status,0,r.stderr)}finally{unlinkSync(file)}
let d=await get();assert.equal(d.players.find(p=>p.id===id).riot_profile.level,55);assert(!('puuid' in d.players[0]));
assert.equal((await post('/api/riot-profile',{playerId:id},{...headers,Cookie:''})).status,403);
assert.equal((await post('/api/riot-profile',{playerId:id},{...headers,Origin:'https://invalid.example'})).status,403);
assert.equal((await post('/api/riot-profile',{playerId:id})).status,503,'No local key should be required for this test');
d=await get();assert.equal(d.players.find(p=>p.id===id).riot_profile.level,55,'Failed lookup preserves profile');
assert.equal((await post('/api/arena',{...b,id,riotId:name+'changed'})).status,200);d=await get();assert.equal(d.players.find(p=>p.id===id).riot_profile,null,'Changing Riot ID hides old account data');
console.log('PASS profile normalization, empty ranks, secret minimization, persistent joins, auth/CSRF, failures preserve data, stale account invalidation.');
