'use client';
import {useState} from 'react';
const tiers:Record<string,string>={IRON:'Ferro',BRONZE:'Bronze',SILVER:'Prata',GOLD:'Ouro',PLATINUM:'Platina',EMERALD:'Esmeralda',DIAMOND:'Diamante',MASTER:'Mestre',GRANDMASTER:'Grão-Mestre',CHALLENGER:'Desafiante'};
function rankName(r:any){return r?`${tiers[r.tier]||r.tier}${['MASTER','GRANDMASTER','CHALLENGER'].includes(r.tier)?'':' '+r.division}`:'Sem classificação'}
export function RiotProfile({p,compact=false}:{p:any;compact?:boolean}) {
 const profile=p?.riot_profile;
 if(!profile)return <p className="muted riot-pending">Perfil Riot ainda não consultado.</p>;
 return <section className={compact?'riot-summary':'riot-details'} aria-label={`Perfil Riot de ${p.name}`}>
  <div className="riot-profile-meta"><span className="badge">Nível {profile.level}</span><span className="muted">Servidor {profile.platform}</span></div>
  {!compact&&<><h2>Perfil na Riot</h2><p className="muted">{profile.gameName}#{profile.tagLine}</p></>}
  <div className="riot-ranks">{[['RANKED_SOLO_5x5','Solo/Duo'],['RANKED_FLEX_SR','Flex']].map(([queue,label])=>{const r=profile.ranked.find((r:any)=>r.queue===queue);return <div key={queue} className="riot-rank"><small>{label}</small><strong>{rankName(r)}</strong>{r&&<span>{r.lp} PdL</span>}{!compact&&r&&<p>{r.wins} V · {r.losses} D · {r.wins+r.losses?Math.round(r.wins/(r.wins+r.losses)*100):0}% vitórias</p>}</div>})}</div>
  {!compact&&<p className="muted">Consultado em {new Date(profile.fetchedAt).toLocaleString('pt-BR')}. Classificações das filas ranqueadas da Riot, independentes do campeonato e do Mayhem.</p>}
 </section>;
}
export function RiotSync({players,onUpdated}:{players:any[];onUpdated:()=>Promise<unknown>}) {
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 async function sync(){
  setBusy(true);let success=0;const errors:string[]=[];
  try {
   for(let i=0;i<players.length;i++){
    const p=players[i];setStatus(`Consultando ${p.name} (${i+1}/${players.length})…`);
    try {const r=await fetch('/api/riot-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:p.id})}),b:any=await r.json();if(!r.ok)throw new Error(b.error);success++;await onUpdated();}
    catch(e){const message=e instanceof Error?e.message:'Falha na consulta';errors.push(`${p.name}: ${message}`);if(/Limite|chave/.test(message))break;}
    if(i<players.length-1)await new Promise(r=>setTimeout(r,1200));
   }
   setStatus(`${success} de ${players.length} perfis atualizados. ${errors.join(' ')}`);
  } finally {setBusy(false)}
 }
 return <div className="riot-sync"><button disabled={busy||!players.length} onClick={sync}>{busy?'Atualizando perfis…':'Atualizar perfis Riot'}</button>{status&&<p className="muted" role="status">{status}</p>}</div>;
}
