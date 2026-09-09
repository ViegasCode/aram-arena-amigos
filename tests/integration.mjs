import assert from 'node:assert/strict';
const origin='http://localhost:3000';
const headers={'Content-Type':'application/json','Origin':origin,Cookie:'__sites_local_auth=1'};
async function get(){const r=await fetch(origin+'/api/arena',{headers});assert.equal(r.status,200);return r.json()}
async function post(b,status=200){const r=await fetch(origin+'/api/arena',{method:'POST',headers,body:JSON.stringify(b)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d}
let data=await get();assert.equal(data.admin,true,'Local administrator unavailable');
const anon=await fetch(origin+'/api/arena',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"action":"rules"}'});assert.equal(anon.status,403);
const csrf=await fetch(origin+'/api/arena',{method:'POST',headers:{...headers,Origin:'https://other.example'},body:'{"action":"rules"}'});assert.equal(csrf.status,403);
const suffix=Date.now().toString(36); const ids=[];for(let i=0;i<10;i++){ids.push((await post({action:'player',name:'Teste '+i,riotId:'TestPlayer'+suffix+i,tagline:'QA',active:true})).id)}
await post({action:'draw',players:ids.slice(0,9)},400);
const {id}=await post({action:'draw',players:ids});data=await get();let match=data.matches.find(m=>m.id===id);assert.equal(new Set(match.teams.flat()).size,10);await post({action:'draw',players:ids},400);
await post({action:'confirm',id,version:match.version});data=await get();match=data.matches.find(m=>m.id===id);
await post({action:'draw',players:ids,id,version:match.version},400);
await post({action:'rules',name:'ARAM Arena QA',threshold:0,bonus:1});
const entries=ids.map(playerId=>({playerId,champion:'Campeão QA',kills:10,deaths:5,assists:25,damage:25000,mitigation:10000,healing:1000,shielding:2000,cc:15,gold:12000,cs:30,objectives:1500}));
const payload={action:'result',id,version:match.version,winner:1,duration:20,results:entries};await post(payload);await post(payload,400);data=await get();data.results=data.results.filter(r=>r.match_id===id);assert.equal(data.results.length,10);assert.equal(data.results.reduce((a,r)=>a+r.points,0),15);assert.equal(data.results.filter(r=>!r.win&&r.bonus===1).length,5);assert(data.results.every(r=>r.stats.damage===25000&&r.grade>=0&&r.grade<=10));
await post({action:'adjust',playerId:ids[0],points:-1,reason:'Correção QA'});data=await get();assert.equal(data.adjustments.find(a=>a.player_id===ids[0]).points,-1);assert(data.audit.some(a=>a.action==='points.adjust'));
console.log('PASS: persistent player CRUD, 5v5 draw, state guards, result scoring, losing bonus, duplicate prevention, audit, authentication, CSRF.');


