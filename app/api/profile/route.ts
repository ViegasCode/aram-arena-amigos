import { database, identity } from '@/lib/server';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const publicFields = 'id,name,riot_id,tagline,icon,active';
const cleanRiot = (value: string) => value.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '').trim();
export async function GET() {
  const { user } = await identity();
  if (!user) return json({ error: 'Entre para acessar seu cadastro.' }, 401);
  try {
    return json({
      player: await database()
        .prepare(`SELECT ${publicFields} FROM players WHERE user_id=?`)
        .bind(user.userId)
        .first(),
    });
  } catch {
    return json({ error: 'Não foi possível carregar seu cadastro.' }, 503);
  }
}
export async function POST(request: Request) {
  const { user } = await identity();
  if (!user) return json({ error: 'Entre para concluir seu cadastro.' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return json({ error: 'Origem não permitida.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ error: 'Formato inválido.' }, 415);
  try {
    const raw = await request.text();
    if (raw.length > 10000)
      return json({ error: 'Cadastro muito grande.' }, 413);
    const b = JSON.parse(raw);
    const field = (value: unknown, max: number) =>
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value.trim().length <= max
        ? value.trim()
        : null;
    const name = field(b.name, 40),
      riotIdRaw = field(b.riotId, 50),
      taglineRaw = field(b.tagline, 10),
      riotId = riotIdRaw ? cleanRiot(riotIdRaw) : null,
      tagline = taglineRaw ? cleanRiot(taglineRaw) : null,
      icon = typeof b.icon === 'string' ? b.icon.trim().slice(0, 4) : '';
    if (
      !name ||
      !riotId ||
      !tagline ||
      riotId.includes('#') ||
      tagline.includes('#')
    )
      return json(
        {
          error:
            'Informe apelido, Riot ID e tagline separadamente, sem o caractere #.',
        },
        400,
      );
    const db = database(),
      existing = await db
        .prepare('SELECT id FROM players WHERE user_id=?')
        .bind(user.userId)
        .first<{ id: string }>(),
      id = existing?.id ?? crypto.randomUUID(),
      now = new Date().toISOString();
    const duplicate = await db
      .prepare(
        'SELECT id FROM players WHERE lower(riot_id)=lower(?) AND lower(tagline)=lower(?) AND id<>?',
      )
      .bind(riotId, tagline, id)
      .first();
    if (duplicate)
      return json(
        {
          error:
            'Essa conta Riot já está cadastrada. Fale com o administrador; não é possível assumir o cadastro de outra pessoa.',
        },
        409,
      );
    const write = existing
      ? db
          .prepare(
            'UPDATE players SET name=?,riot_id=?,tagline=?,icon=?,puuid=NULL WHERE id=? AND user_id=?',
          )
          .bind(name, riotId, tagline, icon, id, user.userId)
      : db
          .prepare(
            'INSERT INTO players(id,user_id,name,riot_id,tagline,icon,active,created_at) VALUES(?,?,?,?,?,?,1,?)',
          )
          .bind(id, user.userId, name, riotId, tagline, icon, now);
    await db.batch([
      write,
      db
        .prepare(
          'INSERT INTO audit_logs(id,actor,action,details,created_at) SELECT ?,?,?,?,? WHERE changes()>0',
        )
        .bind(
          crypto.randomUUID(),
          user.userId,
          existing ? 'player.self_update' : 'player.register',
          JSON.stringify({ id, name, riotId, tagline }),
          now,
        ),
    ]);
    return json({ id, created: !existing }, existing ? 200 : 201);
  } catch (e) {
    if (e instanceof SyntaxError)
      return json({ error: 'Cadastro inválido.' }, 400);
    if (e instanceof Error && /UNIQUE|constraint/i.test(e.message))
      return json(
        {
          error:
            'Sua conta ou este Riot ID já possui cadastro. Atualize a página.',
        },
        409,
      );
    console.error(e);
    return json(
      { error: 'Não foi possível salvar seu cadastro. Tente novamente.' },
      503,
    );
  }
}
