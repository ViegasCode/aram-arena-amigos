// Community points only; independent of the championship and official Riot ranks.
export const MAYHEM_START = '2026-09-10T00:30:00.000Z';
export function mayhemDelta(points: number, win: boolean | number, mvp: boolean | number = false) {
  if (win) return 3 + (mvp ? 1 : 0);
  const loss = points < 15 ? 0 : points < 60 ? -1 : points < 160 ? -2 : -3;
  return loss + (mvp ? 1 : 0);
}
export function standings(players: any[], results: any[]) {
  return players.map(p => {
    const entries = results.filter(r => r.player_id === p.id).sort((a,b) => String(a.played_at||'').localeCompare(String(b.played_at||'')) || String(a.match_id||'').localeCompare(String(b.match_id||'')));
    const wins = entries.reduce((n, r) => n + r.win, 0);
    const points = entries.reduce((score, r) => Math.max(0, score + mayhemDelta(score, r.win, r.mvp)), 0);
    return { ...p, games: entries.length, wins, losses: entries.length - wins,
      points, mvps: entries.reduce((n,r)=>n+(r.mvp?1:0),0), rate: entries.length ? wins / entries.length : 0 };
  }).sort((a, b) => b.points - a.points || b.rate - a.rate || b.wins - a.wins || Number(b.games > 0) - Number(a.games > 0) || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
}
export function validateEntries(entries: unknown) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 10 ||
    entries.some(r => typeof r?.playerId !== 'string' || ![0,1].includes(r.win)) ||
    new Set(entries.map(r => r.playerId)).size !== entries.length ||
    entries.filter(r => r.win === 1).length > 5 || entries.filter(r => r.win === 0).length > 5)
    throw new Error('Selecione de 1 a 10 participantes distintos, até 5 vencedores e 5 derrotados.');
  return entries as {playerId:string;win:number}[];
}
export function riotMayhem(body: any, players: any[]) {
  const info = body?.info;
  if (info?.queueId !== 2400 || info?.gameMode !== 'KIWI' || !Array.isArray(info.participants) || info.participants.length !== 10)
    throw new Error('Esta partida não é um ARAM Mayhem PvP normal.');
  if (!info.gameEndTimestamp || info.gameDuration < 300 || info.participants.some((p:any) => p.gameEndedInEarlySurrender))
    throw new Error('Partida incompleta, remake ou com menos de 5 minutos.');
  const entries = players.flatMap(p => {
    const participant = info.participants.find((r:any) =>
      (p.puuid ? r.puuid === p.puuid :
      typeof r.riotIdGameName === 'string' && typeof r.riotIdTagline === 'string' &&
      r.riotIdGameName.toLowerCase() === p.riot_id.toLowerCase() && r.riotIdTagline.toLowerCase() === p.tagline.toLowerCase()));
    return participant && typeof participant.win === 'boolean' ? [{playerId:p.id, win:participant.win ? 1 : 0}] : [];
  });
  return {playedAt:new Date(info.gameStartTimestamp).toISOString(),entries:validateEntries(entries)};
}
