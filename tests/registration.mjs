import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const origin = 'http://localhost:3000';
const headers = {
  Connection: 'close',
  Origin: origin,
  'Content-Type': 'application/json',
  Cookie: '__sites_local_auth=1',
};
async function req(path, body, authenticated = true) {
  const r = await fetch(origin + path, {
    method: body ? 'POST' : 'GET',
    headers: authenticated
      ? headers
      : { Origin: origin, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
assert.equal((await req('/api/profile', null, false)).status, 401);
assert.equal((await req('/api/profile', { name: 'Anon' }, false)).status, 401);
const before = await req('/api/arena');
assert.equal(
  before.data.admin,
  false,
  'Use ADMIN_EMAILS different from seedy@sites.test for this test.',
);
assert.equal(
  (
    await req('/api/arena', {
      action: 'rules',
      name: 'Hack',
      threshold: 0,
      bonus: 20,
    })
  ).status,
  403,
);
assert.equal(
  (await req('/api/profile', { name: '', riotId: 'QA', tagline: 'BR' })).status,
  400,
);
const victim = before.data.players.find((p) => p.tagline === 'QA');
const entry = {
  name: 'Cadastro QA',
  riotId: 'SelfSignupQA',
  tagline: 'TEST',
  icon: 'QA',
  id: victim?.id,
  active: false,
  points: 9999,
  user_id: 'forged-owner',
  admin: true,
};
const sends = await Promise.all([
  req('/api/profile', entry),
  req('/api/profile', entry),
]);
assert(
  sends.every((r) => [200, 201, 409].includes(r.status)),
  JSON.stringify(sends),
);
let own = await req('/api/profile');
assert.equal(own.status, 200);
assert.equal(own.data.player.name, entry.name);
assert.equal(own.data.player.active, 1);
assert.notEqual(own.data.player.id, victim?.id);
assert(!('user_id' in own.data.player));
const all = await req('/api/arena');
assert.equal(all.data.myPlayerId, own.data.player.id);
assert.equal(
  all.data.players.filter((p) => p.riot_id === entry.riotId).length,
  1,
);
if (victim) {
  assert.deepEqual(
    all.data.players.find((p) => p.id === victim.id),
    victim,
  );
  assert.equal(
    (
      await req('/api/profile', {
        ...entry,
        riotId: victim.riot_id,
        tagline: victim.tagline,
      })
    ).status,
    409,
  );
}
const anonymous = await req('/api/arena', null, false);
assert.equal(anonymous.status, 200);
assert.equal(anonymous.data.myPlayerId, null);
assert.equal(anonymous.data.admin, false);
assert.equal(anonymous.data.audit.length, 0);
assert(
  anonymous.data.players.every((p) => !('user_id' in p) && !('email' in p)),
);
function sql(command) {
  const r = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'site-creator-d1',
      '--local',
      '--config',
      '.wrangler-local.json',
      '--command',
      command,
    ],
    {
      env: {
        ...process.env,
        WRANGLER_WRITE_LOGS: 'false',
        WRANGLER_LOG_PATH: '.wrangler/logs',
      },
      encoding: 'utf8',
    },
  );
  assert.equal(r.status, 0, r.stderr);
}
sql(
  "UPDATE players SET active=0 WHERE user_id='local_seedy' AND riot_id='SelfSignupQA'",
);
try {
  assert.equal(
    (
      await req('/api/profile', {
        ...entry,
        name: 'Cadastro QA editado',
        active: true,
      })
    ).status,
    200,
  );
  own = await req('/api/profile');
  assert.equal(own.data.player.active, 0);
  assert.equal(own.data.player.name, 'Cadastro QA editado');
} finally {
  sql(
    "UPDATE players SET active=1 WHERE user_id='local_seedy' AND riot_id='SelfSignupQA'",
  );
}
assert.equal((await fetch(origin + '/cadastro')).status, 200);
console.log(
  'PASS: anonymous guards, self-registration, duplicate/race protection, automatic player listing, ownership isolation, admin denial, inactive-player protection and private identity fields.',
);

