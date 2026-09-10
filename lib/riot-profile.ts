export const ICON_VERSION = '16.17.1';
const queues = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR'];
export function profileData(account:any,summoner:any,leagues:any) {
 if(typeof account?.gameName!=='string'||typeof account?.tagLine!=='string'||
   !Number.isInteger(summoner?.profileIconId)||summoner.profileIconId<0||
   !Number.isInteger(summoner?.summonerLevel)||summoner.summonerLevel<0||!Array.isArray(leagues))
   throw new Error('A Riot retornou um perfil incompleto. Tente novamente.');
 const ranked = leagues.filter((r:any)=>queues.includes(r.queueType)).map((r:any)=>{
  if(!['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'].includes(r.tier)||
    !['I','II','III','IV'].includes(r.rank)||['leaguePoints','wins','losses'].some(k=>!Number.isInteger(r[k])||r[k]<0))
    throw new Error('A Riot retornou uma classificação incompleta. Tente novamente.');
  return {queue:r.queueType,tier:r.tier,division:r.rank,lp:r.leaguePoints,wins:r.wins,losses:r.losses};
 });
 return {gameName:account.gameName,tagLine:account.tagLine,level:summoner.summonerLevel,iconId:summoner.profileIconId,iconVersion:ICON_VERSION,platform:'BR1',ranked};
}
