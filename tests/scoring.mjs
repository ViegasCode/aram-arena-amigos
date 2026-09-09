import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpile(readFileSync(new URL('../lib/scoring.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {score,shuffled,DEFAULT_RULES}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const base={kills:5,deaths:4,assists:20,damage:10000,mitigation:10000,healing:0,shielding:0,cc:10,gold:10000,cs:30,objectives:1000};
assert.deepEqual(shuffled([1,2,3,4,5]).sort(),[1,2,3,4,5]);
for(let i=0;i<100;i++){const p={...base,deaths:i};const r=score(p,[p,base,base,base,base],20);assert(Number.isFinite(r.grade)&&r.grade>=0&&r.grade<=10)}
const damage={...base,damage:40000,mitigation:1000};const tank={...base,damage:1000,mitigation:40000};const team=[damage,tank,base,base,base];assert(Math.abs(score(damage,team,20).grade-score(tank,team,20).grade)<.2,'Defensive contribution should match equivalent offensive contribution');
const zero=Object.fromEntries(Object.keys(base).map(k=>[k,0]));assert(Number.isFinite(score(zero,[zero,zero],20).grade));assert.equal(DEFAULT_RULES.threshold,7);
console.log('PASS: score bounds, zero stats, equivalent defensive/offensive contributions, shuffle invariants.');
