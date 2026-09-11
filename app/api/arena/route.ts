import { database, identity } from '@/lib/server';
import { DEFAULT_RULES, score, shuffled, type Stats } from '@/lib/scoring';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (s: string) => {
  throw new Error(s);
};
const str = (v: unknown, max = 100) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max
    ? v.trim()
    : fail('Preencha os campos obrigatórios corretamente.');
const cleanRiot = (v: unknown, max: number) => str(v, max).normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '').trim();
const number = (v: unknown, min = 0, max = 10000000) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
    ? v
    : fail('Valor numérico inválido.');
const keys = [
  'kills',
  'deaths',
  'assists',
  'damage',
  'mitigation',
  'healing',
  'shielding',
  'cc',
  'gold',
  'cs',
  'objectives',
] as const;
export async function GET() {
  try {
    const db = database(),
      who = await identity();
    const [p, m, r, c, a] = await db.batch([
      db.prepare(
        'SELECT p.id,p.name,p.riot_id,p.tagline,p.icon,p.active,p.created_at,r.profile AS riot_profile,r.fetched_at AS riot_fetched_at FROM players p LEFT JOIN riot_profiles r ON r.player_id=p.id AND lower(r.riot_id)=lower(p.riot_id) AND lower(r.tagline)=lower(p.tagline) ORDER BY p.name',
      ),
      db.prepare('SELECT * FROM matches ORDER BY created_at DESC'),
      db.prepare('SELECT * FROM match_players'),
      db.prepare("SELECT * FROM championships WHERE id='main'"),
      db.prepare(
        'SELECT player_id,SUM(points) points FROM adjustments GROUP BY player_id',
      ),
    ]);
    const logs = who.admin
      ? (
          await db
            .prepare(
              'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100',
            )
            .all()
        ).results
      : [];
    return json({
      players: p.results.map((p: any) => ({...p, riot_profile: p.riot_profile ? {...JSON.parse(p.riot_profile), fetchedAt:p.riot_fetched_at} : null})),
      matches: m.results.map((x: any) => ({
        ...x,
        teams: JSON.parse(x.teams),
        rules: x.rules ? JSON.parse(x.rules) : null,
      })),
      results: r.results.map((x: any) => ({
        ...x,
        stats: JSON.parse(x.stats),
      })),
      championship: c.results[0]
        ? {
            ...c.results[0],
            rules: JSON.parse((c.results[0] as any).rules as string),
          }
        : { id: 'main', name: 'ARAM Arena', rules: DEFAULT_RULES, version: 0 },
      adjustments: a.results,
      admin: who.admin,
      signedIn: !!who.user,
      myPlayerId: who.user
        ? ((
            await db
              .prepare('SELECT id FROM players WHERE user_id=?')
              .bind(who.user.userId)
              .first<{ id: string }>()
          )?.id ?? null)
        : null,
      audit: logs,
    });
  } catch (e) {
    console.error(e);
    return json(
      { error: 'Não foi possível carregar o campeonato. Tente novamente.' },
      503,
    );
  }
}
export async function POST(request: Request) {
  try {
    const who = await identity();
    if (!who.admin)
      return json(
        { error: 'Acesso exclusivo de administradores autorizados.' },
        403,
      );
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin)
      return json({ error: 'Origem não permitida.' }, 403);
    if (!request.headers.get('content-type')?.includes('application/json'))
      return json({ error: 'Formato inválido.' }, 415);
    const raw = await request.text();
    if (raw.length > 100000) return json({ error: 'Envio muito grande.' }, 413);
    const b = JSON.parse(raw),
      db = database(),
      now = new Date().toISOString();
    const log = (action: string, details: unknown) =>
      db
        .prepare(
          'INSERT INTO audit_logs(id,actor,action,details,created_at) SELECT ?,?,?,?,? WHERE changes()>0',
        )
        .bind(
          crypto.randomUUID(),
          who.user!.userId,
          action,
          JSON.stringify(details),
          now,
        );
    if (b.action === 'player') {
      const id = b.id ? str(b.id) : crypto.randomUUID(),
        name = str(b.name, 40),
        riot = cleanRiot(b.riotId, 50),
        tag = cleanRiot(b.tagline, 10),
        icon = typeof b.icon === 'string' ? b.icon.slice(0, 4) : '';
      if (b.id) {
        if (
          !(await db
            .prepare('SELECT id FROM players WHERE id=?')
            .bind(id)
            .first())
        )
          fail('Jogador não encontrado.');
        await db.batch([
          db
            .prepare(
              'UPDATE players SET name=?,riot_id=?,tagline=?,icon=?,active=?,puuid=NULL WHERE id=?',
            )
            .bind(name, riot, tag, icon, b.active === false ? 0 : 1, id),
          log('player.update', { id, name, riot, tag, active: b.active }),
        ]);
      } else
        await db.batch([
          db
            .prepare(
              'INSERT INTO players(id,name,riot_id,tagline,icon,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(id, name, riot, tag, icon, now),
          log('player.create', { id, name }),
        ]);
      return json({ id });
    }
    if (b.action === 'rules') {
      const rules = {
        ...DEFAULT_RULES,
        threshold: number(b.threshold, 0, 10),
        bonus: number(b.bonus, 0, 20),
      };
      const name = str(b.name, 60);
      await db.batch([
        db
          .prepare(
            "INSERT INTO championships(id,name,rules,version) VALUES('main',?,?,1) ON CONFLICT(id) DO UPDATE SET name=excluded.name,rules=excluded.rules,version=championships.version+1",
          )
          .bind(name, JSON.stringify(rules)),
        log('rules.update', { name, rules }),
      ]);
      return json({ ok: true });
    }
    if (b.action === 'draw') {
      if (
        !Array.isArray(b.players) ||
        b.players.length !== 10 ||
        new Set(b.players).size !== 10
      )
        fail('Selecione exatamente 10 jogadores distintos para o ARAM 5×5.');
      const ids = b.players.map((v: unknown) => str(v));
      const active = await db
        .prepare(
          `SELECT id FROM players WHERE active=1 AND id IN (${ids.map(() => '?').join(',')})`,
        )
        .bind(...ids)
        .all();
      if (active.results.length !== 10)
        fail('Todos os jogadores devem estar ativos.');
      const list = shuffled(ids),
        teams = [list.slice(0, 5), list.slice(5)];
      if (b.id) {
        const change = await db.batch([
          db
            .prepare(
              "UPDATE matches SET teams=?,created_at=?,version=version+1 WHERE id=? AND status='draft' AND version=?",
            )
            .bind(JSON.stringify(teams), now, str(b.id), number(b.version)),
          log('match.redraw', { id: b.id, teams }),
        ]);
        if (!change[0].meta.changes)
          fail('O confronto mudou. Atualize a página.');
        return json({ id: b.id });
      }
      const id = crypto.randomUUID();
      await db.batch([
        db
          .prepare(
            "INSERT INTO matches(id,championship_id,status,teams,created_at) VALUES(?,'main','draft',?,?)",
          )
          .bind(id, JSON.stringify(teams), now),
        log('match.draw', { id, teams }),
      ]);
      return json({ id });
    }
    if (b.action === 'confirm' || b.action === 'cancel') {
      const next = b.action === 'confirm' ? 'confirmed' : 'cancelled';
      const previous =
        b.action === 'confirm'
          ? "status='draft'"
          : "status IN ('draft','confirmed')";
      const change = await db.batch([
        db
          .prepare(
            `UPDATE matches SET status=?,confirmed_at=?,version=version+1 WHERE id=? AND ${previous} AND version=?`,
          )
          .bind(next, now, str(b.id), number(b.version)),
        log('match.' + b.action, { id: b.id }),
      ]);
      if (!change[0].meta.changes)
        fail('O confronto mudou. Atualize a página.');
      return json({ ok: true });
    }
    if (b.action === 'result') {
      const match: any = await db
        .prepare("SELECT * FROM matches WHERE id=? AND status='confirmed'")
        .bind(str(b.id))
        .first();
      if (!match || match.version !== b.version)
        fail('A partida já foi processada ou alterada.');
      const duration = number(b.duration, 1, 180),
        winner = number(b.winner, 1, 2);
      if (!Number.isInteger(winner)) fail('Selecione o time vencedor.');
      const teams: string[][] = JSON.parse(match.teams),
        ids = teams.flat();
      if (
        !Array.isArray(b.results) ||
        b.results.length !== 10 ||
        new Set(b.results.map((r: any) => r.playerId)).size !== 10 ||
        b.results.some((r: any) => !ids.includes(r.playerId))
      )
        fail('O resultado precisa conter todos os jogadores sorteados.');
      const entries = b.results.map((r: any) => {
        const stats = {} as Stats;
        for (const key of keys) stats[key] = number(r[key]);
        return {
          playerId: r.playerId,
          champion: str(r.champion, 40),
          stats,
          team: teams[0].includes(r.playerId) ? 1 : 2,
        };
      });
      const c: any = await db
          .prepare("SELECT rules FROM championships WHERE id='main'")
          .first(),
        rules = c ? JSON.parse(c.rules) : DEFAULT_RULES;
      const statements = entries.map((r: any) => {
        const result = score(
            r.stats,
            entries
              .filter((p: any) => p.team === r.team)
              .map((p: any) => p.stats),
            duration,
            rules,
          ),
          bonus = result.grade >= rules.threshold ? rules.bonus : 0,
          win = r.team === winner ? 1 : 0;
        return db
          .prepare(
            "INSERT INTO match_players(id,match_id,player_id,team,champion,stats,grade,explanation,win,bonus,points) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM matches WHERE id=? AND status='confirmed' AND version=?)",
          )
          .bind(
            crypto.randomUUID(),
            match.id,
            r.playerId,
            r.team,
            r.champion,
            JSON.stringify({ ...r.stats, components: result.components }),
            result.grade,
            result.explanation,
            win,
            bonus,
            win * rules.win + bonus,
            match.id,
            match.version,
          );
      });
      statements.push(
        db
          .prepare(
            "UPDATE matches SET status='completed',winner=?,duration=?,completed_at=?,rules=?,version=version+1 WHERE id=? AND status='confirmed' AND version=?",
          )
          .bind(
            winner,
            duration,
            now,
            JSON.stringify(rules),
            match.id,
            match.version,
          ),
        log('match.manual_result', { id: match.id, winner, duration, rules }),
      );
      const saved = await db.batch(statements);
      if (saved[0].meta.changes !== 1)
        fail('O confronto mudou. Nenhum ponto foi aplicado.');
      return json({ ok: true });
    }
    if (b.action === 'adjust') {
      const playerId = str(b.playerId),
        points = number(b.points, -1000, 1000),
        reason = str(b.reason, 500);
      if (
        !(await db
          .prepare('SELECT id FROM players WHERE id=?')
          .bind(playerId)
          .first())
      )
        fail('Jogador não encontrado.');
      await db.batch([
        db
          .prepare(
            'INSERT INTO adjustments(id,player_id,points,reason,created_at) VALUES(?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), playerId, points, reason, now),
        log('points.adjust', { playerId, points, reason }),
      ]);
      return json({ ok: true });
    }
    return json({ error: 'Ação inválida.' }, 400);
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : 'Erro inesperado';
    return json(
      {
        error: /UNIQUE|constraint/i.test(message)
          ? 'Registro duplicado ou confronto já existente. Atualize a página.'
          : /D1|SQLITE|database/i.test(message)
            ? 'Não foi possível salvar. Tente novamente.'
            : message,
      },
      400,
    );
  }
}
