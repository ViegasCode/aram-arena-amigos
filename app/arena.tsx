'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Swords,
  Trophy,
  Users,
  History,
  ChartNoAxesCombined,
  Settings,
  LayoutDashboard,
  ArrowUpRight,
  Shield,
  Plus,
  RotateCcw,
  Check,
  Medal,
} from 'lucide-react';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table } from '@/components/ui/table';
import { DEFAULT_RULES } from '@/lib/scoring';
const navigation = [
  ['Dashboard', LayoutDashboard],
  ['Ranking', Trophy],
  ['Partida', Swords],
  ['Histórico', History],
  ['Jogadores', Users],
  ['Estatísticas', ChartNoAxesCombined],
  ['Configurações', Settings],
] as const;
const statFields = [
  ['kills', 'Eliminações'],
  ['deaths', 'Mortes'],
  ['assists', 'Assistências'],
  ['damage', 'Dano a campeões'],
  ['mitigation', 'Dano mitigado'],
  ['healing', 'Cura de aliados'],
  ['shielding', 'Escudos a aliados'],
  ['cc', 'Controle (segundos)'],
  ['gold', 'Ouro'],
  ['cs', 'Tropas'],
  ['objectives', 'Dano a objetivos'],
] as const;
const blank = { name: '', riotId: '', tagline: '', icon: '', active: true };
const date = (s: string) =>
  new Date(s).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
function Avatar({ p }: { p: any }) {
  return (
    <div className="avatar">
      {p?.icon || p?.name?.slice(0, 2).toUpperCase() || '?'}
    </div>
  );
}
function Person({ p }: { p: any }) {
  return (
    <div className="person">
      <Avatar p={p} />
      <div>
        <strong>{p?.name || 'Jogador'}</strong>
        <small>
          {p?.riot_id}#{p?.tagline}
        </small>
      </div>
    </div>
  );
}
function Empty({
  title = 'A história começa aqui',
  text = 'Os resultados aparecerão depois da primeira partida.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Trophy size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export default function Arena() {
  const [view, setView] = useState('Dashboard'),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [selection, setSelection] = useState<string[]>([]),
    [edit, setEdit] = useState<any>(null),
    [profile, setProfile] = useState<string | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [search, setSearch] = useState(''),
    [resultOpen, setResultOpen] = useState(false),
    [entries, setEntries] = useState<any[]>([]),
    [winner, setWinner] = useState('1'),
    [duration, setDuration] = useState(20),
    [ruleForm, setRuleForm] = useState<any>(null),
    [adjust, setAdjust] = useState<any>(null),
    [reason, setReason] = useState(''),
    [points, setPoints] = useState(0),
    [animating, setAnimating] = useState(false);
  const reload = useCallback(async () => {
    const response = await fetch('/api/arena', { cache: 'no-store' });
    const body: any = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
    return body;
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const v = params.get('view');
    if (navigation.some(([name]) => name === v)) setView(v!);
    setProfile(params.get('player'));
    reload().catch((e) => setError(e.message));
    const timer = setInterval(() => reload().catch(() => {}), 20000);
    return () => clearInterval(timer);
  }, [reload]);
  const go = (v: string) => {
    setView(v);
    setProfile(null);
    setDetail(null);
    history.replaceState(null, '', '?view=' + encodeURIComponent(v));
  };
  const mutate = async (payload: any) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/arena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reload();
      setNotice('Alteração salva no campeonato.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'read_championship',
            description:
              'Consulta ranking, jogadores e partidas persistidas do campeonato ARAM.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async (input: any) => {
              if (!input || Object.keys(input).length)
                throw new Error('Nenhum parâmetro é aceito');
              const d = await reload();
              return {
                players: d.players,
                matches: d.matches,
                results: d.results,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [reload]);
  const players = data?.players || [],
    results = data?.results || [],
    matches = data?.matches || [],
    completed = matches.filter((m: any) => m.status === 'completed'),
    current = matches.find((m: any) =>
      ['draft', 'confirmed'].includes(m.status),
    ),
    admin = !!data?.admin;
  const ranked = players
    .map((p: any) => {
      const rows = results.filter((r: any) => r.player_id === p.id),
        wins = rows.filter((r: any) => r.win).length,
        adjustment =
          data?.adjustments.find((a: any) => a.player_id === p.id)?.points || 0;
      return {
        ...p,
        games: rows.length,
        wins,
        losses: rows.length - wins,
        rate: rows.length ? (100 * wins) / rows.length : 0,
        grade: rows.length
          ? rows.reduce((a: number, r: any) => a + r.grade, 0) / rows.length
          : 0,
        bonus: rows.filter((r: any) => r.bonus > 0).length,
        points:
          rows.reduce((a: number, r: any) => a + r.points, 0) + adjustment,
      };
    })
    .sort(
      (a: any, b: any) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.grade - a.grade ||
        a.name.localeCompare(b.name),
    );
  const person = (id: string) => ranked.find((p: any) => p.id === id),
    rules = data?.championship.rules || DEFAULT_RULES;
  const openProfile = (id: string) => {
    setProfile(id);
    history.replaceState(null, '', '?view=Jogadores&player=' + id);
  };
  const draw = async () => {
    setAnimating(true);
    const ok = await mutate({
      action: 'draw',
      players: selection,
      id: current?.id,
      version: current?.version,
    });
    if (ok) setTimeout(() => setAnimating(false), 1300);
    else setAnimating(false);
  };
  const openResult = () => {
    setEntries(
      current.teams
        .flat()
        .map((id: string) => ({
          playerId: id,
          champion: '',
          ...Object.fromEntries(statFields.map(([k]) => [k, 0])),
        })),
    );
    setResultOpen(true);
  };
  function Ranking() {
    return ranked.length ? (
      <Table>
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pontos</th>
            <th>Vitórias</th>
            <th>Partidas</th>
            <th>Win rate</th>
            <th>Nota média</th>
            <th>Bônus</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p: any, i: number) => (
            <tr key={p.id}>
              <td className={i < 3 ? 'score' : ''}>
                {i < 3 ? <Medal size={20} /> : i + 1}
              </td>
              <td>
                <button onClick={() => openProfile(p.id)}>
                  <Person p={p} />
                </button>
              </td>
              <td className="score">{p.points} pts</td>
              <td>{p.wins}</td>
              <td>{p.games}</td>
              <td>{p.rate.toFixed(0)}%</td>
              <td>{p.grade.toFixed(1)}</td>
              <td>{p.bonus}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    ) : (
      <Empty text="Cadastre os jogadores para começar o campeonato." />
    );
  }
  function Teams({ match }: { match: any }) {
    return (
      <div className="teams">
        {match.teams.map((team: string[], i: number) => (
          <div key={i} style={{ display: 'contents' }}>
            {i === 1 && <div className="vs">VS</div>}
            <section className="panel team">
              <p className="eyebrow">TIME {i + 1}</p>
              {match.status === 'completed' && (
                <h2 className={match.winner === i + 1 ? 'good' : 'muted'}>
                  {match.winner === i + 1 ? 'VITÓRIA' : 'DERROTA'}
                </h2>
              )}
              {team.map((id: string, index: number) => {
                const r = results.find(
                  (r: any) => r.match_id === match.id && r.player_id === id,
                );
                return (
                  <div
                    key={id}
                    style={{
                      animationDelay: animating ? `${index * 0.18}s` : '0s',
                    }}
                    className="person"
                  >
                    <button onClick={() => openProfile(id)}>
                      <Person p={person(id)} />
                    </button>
                    {r && (
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <strong className="score">
                          {r.grade.toFixed(1)} · +{r.points}
                        </strong>
                        <small className="muted" style={{ display: 'block' }}>
                          {r.champion} · {r.stats.kills}/{r.stats.deaths}/
                          {r.stats.assists}
                        </small>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        ))}
      </div>
    );
  }
  const selectedProfile = profile ? person(profile) : null,
    selectedMatch = detail ? matches.find((m: any) => m.id === detail) : null;
  return (
    <SidebarProvider>
      <div className="arena" style={{ width: '100%' }}>
        <Sidebar collapsible="none" className="rail">
          <a className="brand" href="/">
            <Swords />
            <span>
              ARAM<b>ARENA</b>
            </span>
          </a>
          <p className="eyebrow">CAMPEONATO ENTRE AMIGOS</p>
          <nav>
            {navigation.map(([name, Icon]) => (
              <a
                href={'/?view=' + encodeURIComponent(name)}
                className={view === name ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  go(name);
                }}
                key={name}
              >
                <Icon size={19} />
                {name}
              </a>
            ))}
          </nav>
          <div className="rail-bottom">
            <Shield size={18} /> A sua comunidade.
            <br />A sua arena.
          </div>
        </Sidebar>
        <main className="main">
          <header>
            <span>ARENA / {view.toUpperCase()}</span>
            <a
              href={
                data?.signedIn
                  ? '/signout-with-chatgpt?return_to=/'
                  : '/signin-with-chatgpt?return_to=/'
              }
            >
              {admin
                ? 'Administrador · Sair'
                : data?.signedIn
                  ? 'Visitante · Sair'
                  : 'Entrar como administrador'}{' '}
              <ArrowUpRight size={16} />
            </a>
          </header>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {data?.championship.name?.toUpperCase() || 'ARAM ARENA'}
              </p>
              <h1>
                {selectedProfile ? (
                  selectedProfile.name
                ) : selectedMatch ? (
                  'O confronto em detalhes'
                ) : view === 'Dashboard' ? (
                  <>
                    O próximo destaque
                    <br />
                    pode ser você<span>.</span>
                  </>
                ) : (
                  view
                )}
              </h1>
              <p>
                {view === 'Dashboard'
                  ? 'Novos times. Grandes jogadas. Uma só arena.'
                  : view === 'Partida'
                    ? 'Cinco de cada lado. Todo mundo por uma grande partida.'
                    : view === 'Jogadores'
                      ? 'As pessoas que fazem a arena acontecer.'
                      : view === 'Ranking'
                        ? 'Cada vitória conta. Cada grande jogada também.'
                        : view === 'Histórico'
                          ? 'Toda partida deixa uma história.'
                          : ''}
              </p>
            </div>
            {view === 'Dashboard' && (
              <div className="season-mark">
                <Trophy size={46} />
                <b>ARAM</b>
                <span>AMIGOS • COMPETIÇÃO</span>
              </div>
            )}
          </div>
          {error && (
            <div role="alert" className="notice error">
              {error}{' '}
              <button
                onClick={() =>
                  reload()
                    .then(() => setError(''))
                    .catch((e) => setError(e.message))
                }
              >
                Tentar novamente
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
          {!data && !error && <p role="status">Carregando campeonato…</p>}
          {selectedProfile ? (
            <>
              <button
                className="secondary"
                onClick={() => {
                  setProfile(null);
                  history.replaceState(null, '', '?view=Jogadores');
                }}
              >
                ← Voltar
              </button>
              <div className="panel detail">
                <Person p={selectedProfile} />
                <div className="stats detail">
                  {[
                    [
                      'Posição',
                      '#' +
                        (ranked.findIndex((p: any) => p.id === profile) + 1),
                    ],
                    ['Pontos', selectedProfile.points],
                    [
                      'Vitórias / derrotas',
                      `${selectedProfile.wins} / ${selectedProfile.losses}`,
                    ],
                    ['Nota média', selectedProfile.grade.toFixed(1)],
                    ['Partidas', selectedProfile.games],
                    ['Win rate', selectedProfile.rate.toFixed(0) + '%'],
                    ['Bônus', selectedProfile.bonus],
                    [
                      'KDA médio',
                      (() => {
                        const rr = results.filter(
                          (r: any) => r.player_id === profile,
                        );
                        return rr.length
                          ? (
                              rr.reduce(
                                (a: number, r: any) =>
                                  a + r.stats.kills + r.stats.assists,
                                0,
                              ) /
                              Math.max(
                                1,
                                rr.reduce(
                                  (a: number, r: any) => a + r.stats.deaths,
                                  0,
                                ),
                              )
                            ).toFixed(2)
                          : '—';
                      })(),
                    ],
                  ].map(([label, value]) => (
                    <div className="stat" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <h2>Últimas partidas e evolução</h2>
                {!selectedProfile.games ? (
                  <Empty />
                ) : (
                  completed
                    .filter((m: any) => m.teams.flat().includes(profile))
                    .map((m: any) => {
                      const r = results.find(
                        (r: any) =>
                          r.match_id === m.id && r.player_id === profile,
                      );
                      return (
                        <div className="record" key={m.id}>
                          <div>
                            <strong>
                              {r.win ? 'Vitória' : 'Derrota'} · {r.champion}
                            </strong>
                            <p className="muted">
                              {date(m.completed_at)} · {r.stats.kills}/
                              {r.stats.deaths}/{r.stats.assists}
                            </p>
                            <p className="muted">{r.explanation}</p>
                          </div>
                          <div>
                            <strong className="score">
                              {r.grade.toFixed(1)} · +{r.points} pts
                            </strong>
                            <div
                              style={{
                                width: 100,
                                background: '#24374b',
                                height: 5,
                                marginTop: 10,
                              }}
                            >
                              <div
                                style={{
                                  width: r.grade * 10 + '%',
                                  height: 5,
                                  background: '#cdb47e',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
                <h2 className="detail">Médias por partida</h2>
                <div className="grid">
                  {statFields.slice(3).map(([key, label]) => (
                    <div className="stat" key={key}>
                      <span>{label}</span>
                      <strong>
                        {selectedProfile.games
                          ? Math.round(
                              results
                                .filter((r: any) => r.player_id === profile)
                                .reduce(
                                  (a: number, r: any) => a + r.stats[key],
                                  0,
                                ) / selectedProfile.games,
                            ).toLocaleString('pt-BR')
                          : '—'}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : selectedMatch ? (
            <>
              <button className="secondary" onClick={() => setDetail(null)}>
                ← Voltar ao histórico
              </button>
              <p className="muted">
                {date(selectedMatch.created_at)} ·{' '}
                {selectedMatch.duration || '—'} min · Registro manual · Match
                ID: {selectedMatch.match_id || 'Não vinculado'}
              </p>
              <Teams match={selectedMatch} />
              <section className="panel detail">
                <h2>Desempenho individual</h2>
                {results
                  .filter((r: any) => r.match_id === selectedMatch.id)
                  .map((r: any) => (
                    <div className="record" key={r.id}>
                      <div>
                        <strong>
                          {person(r.player_id)?.name} · {r.champion}
                        </strong>
                        <p className="muted">{r.explanation}</p>
                        <p className="muted">
                          Dano: {r.stats.damage.toLocaleString('pt-BR')} ·
                          Mitigação:{' '}
                          {r.stats.mitigation.toLocaleString('pt-BR')} · Cura:{' '}
                          {r.stats.healing.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <strong className="score">
                        {r.grade.toFixed(1)}
                        <small style={{ display: 'block' }}>
                          +{r.points} pts
                        </small>
                      </strong>
                    </div>
                  ))}
              </section>
            </>
          ) : (
            <>
              {view === 'Dashboard' && (
                <>
                  <div className="stats">
                    {[
                      [
                        'Jogadores na arena',
                        players.filter((p: any) => p.active).length,
                      ],
                      ['Partidas disputadas', completed.length],
                      [
                        'Bônus conquistados',
                        results.filter((r: any) => r.bonus > 0).length,
                      ],
                      ['Nota para bônus', rules.threshold.toFixed(1) + '+'],
                    ].map(([label, value]) => (
                      <div className="stat" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="section-title">
                        <h2>Ranking do campeonato</h2>
                        <Trophy size={22} />
                      </div>
                      <Ranking />
                    </section>
                    <section className="panel current">
                      <p className="eyebrow">
                        {current ? 'PARTIDA ATUAL' : 'PRÓXIMO CONFRONTO'}
                      </p>
                      <h2>
                        {current ? (
                          current.status === 'draft' ? (
                            'Os times estão prontos.'
                          ) : (
                            'Aguardando a partida.'
                          )
                        ) : (
                          <>
                            A arena espera
                            <br />
                            pelo seu time.
                          </>
                        )}
                      </h2>
                      <div className="versus">
                        I <span>VS</span> II
                      </div>
                      <button
                        className="gold button"
                        onClick={() => go('Partida')}
                      >
                        <Swords size={18} />
                        {current
                          ? 'Abrir confronto'
                          : 'Sortear próxima partida'}
                      </button>
                      <p className="muted">Times diferentes a cada partida.</p>
                    </section>
                    <section className="panel">
                      <h2>Última partida</h2>
                      {completed[0] ? (
                        <div className="record">
                          <div>
                            <span className="badge">
                              TIME {completed[0].winner} · VITÓRIA
                            </span>
                            <p className="muted">
                              {date(completed[0].completed_at)} ·{' '}
                              {completed[0].duration} min
                            </p>
                          </div>
                          <button
                            className="secondary"
                            onClick={() => setDetail(completed[0].id)}
                          >
                            Ver partida ↗
                          </button>
                        </div>
                      ) : (
                        <Empty title="A primeira vitória está por vir" />
                      )}
                    </section>
                    <section className="panel">
                      <h2>Melhores desempenhos</h2>
                      {results.length ? (
                        [...results]
                          .sort((a: any, b: any) => b.grade - a.grade)
                          .slice(0, 3)
                          .map((r: any) => (
                            <div className="record" key={r.id}>
                              <Person p={person(r.player_id)} />
                              <strong className="score">
                                {r.grade.toFixed(1)}
                              </strong>
                            </div>
                          ))
                      ) : (
                        <Empty
                          title="Quem vai brilhar primeiro?"
                          text="As maiores notas ganham destaque aqui."
                        />
                      )}
                    </section>
                  </div>
                </>
              )}
              {view === 'Ranking' && (
                <>
                  {ranked.length > 0 && (
                    <div className="grid podium">
                      {ranked.slice(0, 3).map((p: any, i: number) => (
                        <button
                          className="panel"
                          onClick={() => openProfile(p.id)}
                          key={p.id}
                        >
                          <p className="eyebrow">{i + 1}º LUGAR</p>
                          <Medal size={30} className="score" />
                          <h2>{p.name}</h2>
                          <strong className="score">{p.points} pontos</strong>
                        </button>
                      ))}
                    </div>
                  )}
                  <section className="panel">
                    <Ranking />
                  </section>
                  <p className="muted">
                    Desempate: vitórias, nota média e nome. Pontuação: +1 por
                    vitória e +{rules.bonus} por nota ≥{' '}
                    {rules.threshold.toFixed(1)}.
                  </p>
                </>
              )}
              {view === 'Jogadores' && (
                <>
                  <div className="toolbar">
                    <input
                      aria-label="Buscar jogador"
                      placeholder="Buscar por nome ou Riot ID…"
                      style={{ maxWidth: 350 }}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {admin && (
                      <button
                        className="gold"
                        onClick={() => setEdit({ ...blank })}
                      >
                        <Plus size={18} /> Cadastrar jogador
                      </button>
                    )}
                  </div>
                  <div className="grid">
                    {ranked
                      .filter((p: any) =>
                        (p.name + ' ' + p.riot_id + '#' + p.tagline)
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((p: any) => (
                        <article className="panel player-card" key={p.id}>
                          <button onClick={() => openProfile(p.id)}>
                            <Person p={p} />
                          </button>
                          <div className="record">
                            <strong className="score">{p.points} pts</strong>
                            <span className="badge">
                              {p.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <p className="muted">
                            {p.games} partidas · {p.rate.toFixed(0)}% vitórias
                          </p>
                          {admin && (
                            <div className="toolbar">
                              <button
                                className="secondary"
                                onClick={() =>
                                  setEdit({
                                    id: p.id,
                                    name: p.name,
                                    riotId: p.riot_id,
                                    tagline: p.tagline,
                                    icon: p.icon,
                                    active: !!p.active,
                                  })
                                }
                              >
                                Editar
                              </button>
                              <button
                                className="secondary"
                                onClick={() => {
                                  setAdjust(p);
                                  setReason('');
                                  setPoints(0);
                                }}
                              >
                                Ajustar pontos
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                  </div>
                  {!ranked.length && (
                    <Empty
                      text={
                        admin
                          ? 'Use “Cadastrar jogador” para reunir sua comunidade.'
                          : 'O administrador ainda não cadastrou os jogadores.'
                      }
                    />
                  )}
                </>
              )}
              {view === 'Partida' && (
                <>
                  {!admin && (
                    <div className="notice">
                      Você está acompanhando a arena. Sorteios e resultados são
                      controlados pelo administrador.
                    </div>
                  )}
                  {current ? (
                    <>
                      <div className="toolbar">
                        <span className="badge">
                          {current.status === 'draft'
                            ? '1 · TIMES SORTEADOS'
                            : '2 · AGUARDANDO PARTIDA'}
                        </span>
                        <span className="muted">
                          {date(current.created_at)}
                        </span>
                      </div>
                      <Teams key={current.version} match={current} />
                      {admin && (
                        <div className="toolbar detail">
                          {current.status === 'draft' ? (
                            <>
                              <button
                                className="secondary"
                                disabled={busy || animating}
                                onClick={() => {
                                  setSelection(current.teams.flat());
                                  setAnimating(true);
                                  mutate({
                                    action: 'draw',
                                    players: current.teams.flat(),
                                    id: current.id,
                                    version: current.version,
                                  }).finally(() =>
                                    setTimeout(() => setAnimating(false), 1300),
                                  );
                                }}
                              >
                                <RotateCcw size={16} /> Sortear novamente
                              </button>
                              <button
                                className="gold"
                                disabled={busy || animating}
                                onClick={() =>
                                  mutate({
                                    action: 'confirm',
                                    id: current.id,
                                    version: current.version,
                                  })
                                }
                              >
                                <Check size={16} /> Confirmar confronto
                              </button>
                            </>
                          ) : (
                            <button className="gold" onClick={openResult}>
                              Registrar resultado manual
                            </button>
                          )}
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => {
                              setAdjust({ cancel: current });
                            }}
                          >
                            Cancelar confronto
                          </button>
                        </div>
                      )}
                      {current.status === 'confirmed' && (
                        <p className="notice">
                          Integração Riot ainda não ativada. Registre as
                          estatísticas após conferir o pós-jogo; nenhum
                          resultado é apresentado como verificado pela Riot.
                        </p>
                      )}
                    </>
                  ) : (
                    <section className="panel">
                      <div className="section-title">
                        <h2>Monte a lista. Deixe o resto com a sorte.</h2>
                        <Swords />
                      </div>
                      <p className="muted">
                        Selecione 10 jogadores ativos para um confronto 5×5.
                        Você pode refazer o sorteio antes de confirmar.
                      </p>
                      <div className="checks">
                        {players
                          .filter((p: any) => p.active)
                          .map((p: any) => (
                            <label className="check" key={p.id}>
                              <Checkbox
                                disabled={!admin || busy}
                                checked={selection.includes(p.id)}
                                onCheckedChange={(checked) =>
                                  setSelection((s) =>
                                    checked
                                      ? [...s, p.id]
                                      : s.filter((id) => id !== p.id),
                                  )
                                }
                              />
                              {p.name}
                            </label>
                          ))}
                      </div>
                      {!players.length && (
                        <Empty text="Cadastre os jogadores antes do primeiro sorteio." />
                      )}
                      <div className="toolbar detail">
                        <button
                          className="gold"
                          disabled={!admin || busy || selection.length !== 10}
                          onClick={draw}
                        >
                          <Swords size={18} />
                          {busy ? 'Distribuindo jogadores…' : 'Sortear times'}
                        </button>
                        <span className="muted">
                          {selection.length}/10 selecionados
                        </span>
                      </div>
                    </section>
                  )}
                </>
              )}
              {view === 'Histórico' && (
                <section className="panel">
                  {!matches.length ? (
                    <Empty title="Nenhuma partida registrada" />
                  ) : (
                    matches.map((m: any) => (
                      <div className="record" key={m.id}>
                        <div>
                          <span className="badge">
                            {m.status === 'completed'
                              ? 'FINALIZADA'
                              : m.status === 'cancelled'
                                ? 'CANCELADA'
                                : m.status === 'draft'
                                  ? 'SORTEADA'
                                  : 'AGUARDANDO'}
                          </span>
                          <p>
                            {m.status === 'completed'
                              ? `Time ${m.winner} venceu`
                              : 'Time 1 × Time 2'}
                          </p>
                          <small className="muted">
                            {date(m.created_at)} ·{' '}
                            {m.duration
                              ? m.duration + ' min'
                              : 'Duração pendente'}
                          </small>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setDetail(m.id)}
                        >
                          Ver confronto ↗
                        </button>
                      </div>
                    ))
                  )}
                </section>
              )}
              {view === 'Estatísticas' && (
                <>
                  {!results.length ? (
                    <section className="panel">
                      <Empty
                        title="O campeonato ainda está aquecendo"
                        text="Jogue e registre a primeira partida para descobrir os destaques."
                      />
                    </section>
                  ) : (
                    <div className="grid">
                      {(() => {
                        const played = ranked.filter((p: any) => p.games),
                          bestRate = [...played].sort(
                            (a: any, b: any) => b.rate - a.rate,
                          )[0],
                          bestGrade = [...played].sort(
                            (a: any, b: any) => b.grade - a.grade,
                          )[0],
                          damage = [...results].sort(
                            (a: any, b: any) => b.stats.damage - a.stats.damage,
                          )[0],
                          grade = [...results].sort(
                            (a: any, b: any) => b.grade - a.grade,
                          )[0];
                        let bestStreak = { name: '—', value: 0 };
                        for (const p of played) {
                          let streak = 0,
                            max = 0;
                          for (const m of [...completed].reverse()) {
                            const r = results.find(
                              (r: any) =>
                                r.match_id === m.id && r.player_id === p.id,
                            );
                            if (r) {
                              streak = r.win ? streak + 1 : 0;
                              max = Math.max(max, streak);
                            }
                          }
                          if (max > bestStreak.value)
                            bestStreak = { name: p.name, value: max };
                        }
                        const kdas = played
                          .map((p: any) => {
                            const rr = results.filter(
                              (r: any) => r.player_id === p.id,
                            );
                            return {
                              name: p.name,
                              value:
                                rr.reduce(
                                  (a: number, r: any) =>
                                    a + r.stats.kills + r.stats.assists,
                                  0,
                                ) /
                                Math.max(
                                  1,
                                  rr.reduce(
                                    (a: number, r: any) => a + r.stats.deaths,
                                    0,
                                  ),
                                ),
                            };
                          })
                          .sort((a: any, b: any) => b.value - a.value);
                        return [
                          [
                            'Maior win rate',
                            bestRate.name,
                            bestRate.rate.toFixed(0) + '%',
                          ],
                          [
                            'Maior nota média',
                            bestGrade.name,
                            bestGrade.grade.toFixed(1),
                          ],
                          [
                            'Maior sequência de vitórias',
                            bestStreak.name,
                            bestStreak.value,
                          ],
                          ['Maior KDA', kdas[0].name, kdas[0].value.toFixed(2)],
                          [
                            'Maior dano em uma partida',
                            person(damage.player_id)?.name,
                            damage.stats.damage.toLocaleString('pt-BR'),
                          ],
                          [
                            'Maior nota registrada',
                            person(grade.player_id)?.name,
                            grade.grade.toFixed(1),
                          ],
                        ].map(([label, name, value]) => (
                          <section className="panel" key={label}>
                            <p className="eyebrow">{label}</p>
                            <h1 className="score">{value}</h1>
                            <Person p={{ name }} />
                          </section>
                        ));
                      })()}
                    </div>
                  )}
                  <p className="muted">
                    Estatísticas incluem todos os jogos registrados, sem mínimo
                    de partidas.
                  </p>
                </>
              )}
              {view === 'Configurações' && (
                <div className="dashboard-grid">
                  <section className="panel">
                    <h2>Regras do campeonato</h2>
                    <form
                      className="form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = ruleForm || {
                          name: data.championship.name,
                          threshold: rules.threshold,
                          bonus: rules.bonus,
                        };
                        if (await mutate({ action: 'rules', ...f }))
                          setRuleForm(null);
                      }}
                    >
                      <label>
                        Nome do campeonato
                        <input
                          disabled={!admin}
                          value={
                            ruleForm?.name ??
                            data?.championship.name ??
                            'ARAM Arena'
                          }
                          maxLength={60}
                          required
                          onChange={(e) =>
                            setRuleForm({
                              ...ruleForm,
                              name: e.target.value,
                              threshold: ruleForm?.threshold ?? rules.threshold,
                              bonus: ruleForm?.bonus ?? rules.bonus,
                            })
                          }
                        />
                      </label>
                      <div className="form-grid">
                        <label>
                          Nota mínima para bônus
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.1}
                            disabled={!admin}
                            value={ruleForm?.threshold ?? rules.threshold}
                            onChange={(e) =>
                              setRuleForm({
                                name: data.championship.name,
                                ...ruleForm,
                                threshold: Number(e.target.value),
                                bonus: ruleForm?.bonus ?? rules.bonus,
                              })
                            }
                          />
                        </label>
                        <label>
                          Pontos de bônus
                          <input
                            type="number"
                            min={0}
                            max={20}
                            step={0.5}
                            disabled={!admin}
                            value={ruleForm?.bonus ?? rules.bonus}
                            onChange={(e) =>
                              setRuleForm({
                                name: data.championship.name,
                                ...ruleForm,
                                bonus: Number(e.target.value),
                                threshold:
                                  ruleForm?.threshold ?? rules.threshold,
                              })
                            }
                          />
                        </label>
                      </div>
                      <p className="muted">
                        Vitória: +1 ponto. O bônus também vale para o time
                        derrotado. Mudanças valem para os próximos resultados;
                        partidas anteriores preservam as regras usadas.
                      </p>
                      {admin && (
                        <button className="gold" disabled={busy}>
                          Salvar regras
                        </button>
                      )}
                    </form>
                  </section>
                  <section className="panel">
                    <h2>Avaliação ARAM · v1</h2>
                    <p className="muted">
                      Participação 30% · Sobrevivência 20% · Contribuição 35% ·
                      Economia e objetivos 15%.
                    </p>
                    <p className="muted">
                      A contribuição usa o melhor eixo entre dano, mitigação e
                      utilidade. Esta é uma heurística inicial, ainda sem
                      calibração por campeão.
                    </p>
                    <span className="badge">RIOT · ETAPA SEGUINTE</span>
                    <p className="muted">
                      As contas estão cadastradas por Riot ID. A vinculação
                      oficial por PUUID e a importação de partidas ainda não
                      estão ativas.
                    </p>
                  </section>
                  {admin && (
                    <section className="panel full">
                      <h2>Registro de auditoria</h2>
                      {data?.audit.length ? (
                        data.audit.map((a: any) => (
                          <div className="record" key={a.id}>
                            <div>
                              <strong>{a.action}</strong>
                              <p
                                className="muted"
                                style={{ overflowWrap: 'anywhere' }}
                              >
                                {a.details}
                              </p>
                            </div>
                            <small>{date(a.created_at)}</small>
                          </div>
                        ))
                      ) : (
                        <p className="muted">Nenhuma alteração registrada.</p>
                      )}
                    </section>
                  )}
                </div>
              )}
            </>
          )}
          <footer
            className="muted"
            style={{
              marginTop: 45,
              borderTop: '1px solid #213045',
              paddingTop: 20,
              fontSize: 12,
            }}
          >
            ARAM Arena · Feito para a nossa comunidade. Projeto independente,
            sem afiliação com a Riot Games.
          </footer>
        </main>
        <Dialog
          open={!!edit}
          onOpenChange={(open) => {
            if (!open) setEdit(null);
          }}
        >
          <DialogContent className="arena-dialog">
            <DialogHeader>
              <DialogTitle>
                {edit?.id ? 'Editar jogador' : 'Novo jogador'}
              </DialogTitle>
              <DialogDescription>
                Adicione a identidade do jogador no campeonato.
              </DialogDescription>
            </DialogHeader>
            {edit && (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await mutate({ action: 'player', ...edit }))
                    setEdit(null);
                }}
              >
                {[
                  ['name', 'Nome / apelido', 40],
                  ['riotId', 'Riot ID (sem #)', 50],
                  ['tagline', 'Tagline', 10],
                  ['icon', 'Ícone / iniciais', 4],
                ].map(([key, label, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      required={key !== 'icon'}
                      maxLength={Number(max)}
                      value={edit[key]}
                      onChange={(e) =>
                        setEdit({ ...edit, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label className="check">
                  <Checkbox
                    checked={edit.active}
                    onCheckedChange={(active) => setEdit({ ...edit, active })}
                  />
                  Jogador ativo
                </label>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button className="gold" disabled={busy}>
                  Salvar jogador
                </button>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={resultOpen} onOpenChange={setResultOpen}>
          <DialogContent className="arena-dialog wide">
            <DialogHeader>
              <DialogTitle>Registrar resultado</DialogTitle>
              <DialogDescription>
                Confira os dados do pós-jogo. Este registro é manual e aplicará
                pontos ao campeonato.
              </DialogDescription>
            </DialogHeader>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate({
                    action: 'result',
                    id: current.id,
                    version: current.version,
                    winner: Number(winner),
                    duration,
                    results: entries,
                  })
                )
                  setResultOpen(false);
              }}
            >
              <label>Time vencedor</label>
              <RadioGroup
                value={winner}
                onValueChange={(v) => setWinner(String(v))}
                className="radio-inline"
              >
                <label className="check">
                  <RadioGroupItem value="1" />
                  Time 1
                </label>
                <label className="check">
                  <RadioGroupItem value="2" />
                  Time 2
                </label>
              </RadioGroup>
              <label>
                Duração (minutos)
                <input
                  required
                  type="number"
                  min={1}
                  max={180}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
              <p className="notice">
                Nota mínima: {rules.threshold.toFixed(1)} · Bônus: +
                {rules.bonus}. Preencha as estatísticas disponíveis; use zero
                somente quando o valor for realmente zero.
              </p>
              {entries.map((r, i) => (
                <fieldset className="panel form" key={r.playerId}>
                  <legend>
                    {person(r.playerId)?.name} · Time{' '}
                    {current?.teams[0].includes(r.playerId) ? 1 : 2}
                  </legend>
                  <label>
                    Campeão
                    <input
                      required
                      maxLength={40}
                      value={r.champion}
                      onChange={(e) =>
                        setEntries((es) =>
                          es.map((x, j) =>
                            i === j ? { ...x, champion: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="form-grid">
                    {statFields.map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          required
                          min={0}
                          max={10000000}
                          value={r[key]}
                          onChange={(e) =>
                            setEntries((es) =>
                              es.map((x, j) =>
                                i === j
                                  ? { ...x, [key]: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="gold" disabled={busy || !current}>
                Confirmar resultado e aplicar pontos
              </button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!adjust}
          onOpenChange={(open) => {
            if (!open) setAdjust(null);
          }}
        >
          <DialogContent className="arena-dialog">
            <DialogHeader>
              <DialogTitle>
                {adjust?.cancel ? 'Cancelar confronto' : 'Ajustar pontos'}
              </DialogTitle>
              <DialogDescription>
                {adjust?.cancel
                  ? 'O confronto ficará registrado como cancelado, sem pontuação.'
                  : `Ajuste para ${adjust?.name}. O motivo ficará na auditoria.`}
              </DialogDescription>
            </DialogHeader>
            {adjust?.cancel ? (
              <button
                className="gold"
                disabled={busy}
                onClick={async () => {
                  if (
                    await mutate({
                      action: 'cancel',
                      id: adjust.cancel.id,
                      version: adjust.cancel.version,
                    })
                  )
                    setAdjust(null);
                }}
              >
                Confirmar cancelamento
              </button>
            ) : (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await mutate({
                      action: 'adjust',
                      playerId: adjust.id,
                      points,
                      reason,
                    })
                  )
                    setAdjust(null);
                }}
              >
                <label>
                  Variação de pontos
                  <input
                    type="number"
                    required
                    min={-1000}
                    max={1000}
                    step={0.5}
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                  />
                </label>
                <label>
                  Motivo
                  <textarea
                    required
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <button className="gold" disabled={busy}>
                  Registrar ajuste
                </button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}
