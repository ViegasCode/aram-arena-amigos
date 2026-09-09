// Pure, versioned scoring module. Initial heuristic; not a calibrated Riot grade.
export const DEFAULT_RULES = {
  threshold: 7,
  bonus: 1,
  win: 1,
  algorithm: 'aram-v1',
  weights: {
    participation: 0.3,
    survival: 0.2,
    contribution: 0.35,
    economy: 0.15,
  },
};
export type Stats = {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  mitigation: number;
  healing: number;
  shielding: number;
  cc: number;
  gold: number;
  cs: number;
  objectives: number;
};
const clamp = (x: number) => Math.max(0, Math.min(1, x));
export function score(
  stats: Stats,
  team: Stats[],
  minutes: number,
  rules = DEFAULT_RULES,
) {
  const sum = (key: keyof Stats) => team.reduce((a, p) => a + p[key], 0);
  const share = (key: keyof Stats) =>
    sum(key) > 0 ? clamp(((stats[key] / sum(key)) * team.length) / 2) : 0;
  const kills = sum('kills');
  const participation = kills
    ? clamp((stats.kills + stats.assists) / kills)
    : 0;
  const survival = clamp(1 - stats.deaths / Math.max(1, minutes * 0.65));
  const offense = share('damage');
  const defense = share('mitigation');
  const utility = Math.max(share('healing'), share('shielding'), share('cc'));
  const contribution =
    Math.max(offense, defense, utility) * 0.8 +
    Math.min(1, (offense + defense + utility) / 3) * 0.2;
  const economy =
    share('gold') * 0.7 + share('cs') * 0.1 + share('objectives') * 0.2;
  const w = rules.weights,
    total = w.participation + w.survival + w.contribution + w.economy;
  const grade =
    Math.round(
      100 *
        clamp(
          (participation * w.participation +
            survival * w.survival +
            contribution * w.contribution +
            economy * w.economy) /
            total,
        ),
    ) / 10;
  const role =
    utility >= Math.max(offense, defense)
      ? 'utilidade, cura, escudos ou controle'
      : defense >= offense
        ? 'mitigação de dano'
        : 'dano a campeões';
  return {
    grade,
    explanation: `Participação em eliminações: ${Math.round(participation * 100)}%. Maior contribuição relativa: ${role}. ${stats.deaths} mortes em ${minutes} minutos.`,
    components: { participation, survival, contribution, economy },
    algorithm: 'aram-v1',
  };
}
export function shuffled<T>(input: T[]) {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const range = i + 1,
      limit = 4294967296 - (4294967296 % range);
    let n;
    do {
      n = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (n >= limit);
    const j = n % range;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
