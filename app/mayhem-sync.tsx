'use client';
import {useEffect,useState} from 'react';
export default function MayhemSync({players,knownIds,onUpdated,signedIn,admin}:{players:any[];knownIds:string[];onUpdated:()=>Promise<unknown>;signedIn:boolean;admin:boolean}){
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[summary,setSummary]=useState(''),[issues,setIssues]=useState<string[]>([]);
 useEffect(()=>{const params=new URLSearchParams(location.hash.slice(1)),raw=params.get('mayhem-sync-z')||params.get('mayhem-sync');if(!raw)return;history.replaceState(null,'',location.pathname+location.search);void (async()=>{try{const bytes=Uint8Array.from(atob(raw.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));let decoded=bytes;if(params.has('mayhem-sync-z')){const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));decoded=new Uint8Array(await new Response(stream).arrayBuffer())}const data=JSON.parse(new TextDecoder().decode(decoded));await importMatches(data.matches);}catch{setIssues(['O conector devolveu dados inválidos. Baixe a versão mais recente e tente novamente.']);}})();},[]);
 async function importMatches(input:unknown){
  setBusy(true);setSummary('');setIssues([]);
  const known=new Set(knownIds),errors:string[]=[];let imported=0,updated=0,unavailable=0;
  async function post(path:string,body:any){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b:any=await r.json();return {status:r.status,ok:r.ok,...b};}
  try{
   const matches=Array.isArray(input)?input:[];
   let count=0;for(const match of matches){count++;
    setProgress(`${known.has(match.matchId)?'Atualizando detalhes':'Importando'} ${match.matchId} (${count}/${matches.length})…`);
    try{const b=await post('/api/mayhem',{action:'client',...match});if(b.ok){if(b.updated)updated++;else imported++;}else{unavailable++;errors.push(`${match.matchId}: ${b.error}`);}}
    catch{unavailable++;errors.push(`${match.matchId}: falha de conexão.`);}
   }
   await onUpdated();
   setSummary(`${matches.length} partidas Mayhem encontradas · ${imported} novas · ${updated} atualizadas com detalhes · ${unavailable} não importadas.`);
  }catch{errors.push('Não foi possível atualizar a classificação. Tente novamente.');}
  finally{setIssues(errors);setProgress('');setBusy(false);}
 }
 async function syncRemote(){
  setBusy(true);setSummary('');setIssues([]);const found=new Set<string>(),errors:string[]=[];
  try{
   for(let i=0;i<players.length;i++){
    const player=players[i];setProgress(`Consultando histórico de ${player.name} (${i+1}/${players.length})…`);
    try{const r=await fetch('/api/mayhem-history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:player.id})}),b:any=await r.json();if(!r.ok)throw new Error(b.error);for(const id of b.matchIds||[])if(!knownIds.includes(id))found.add(id)}
    catch(e){errors.push(`${player.name}: ${e instanceof Error?e.message:'falha na consulta'}`)}
    if(i<players.length-1)await new Promise(r=>setTimeout(r,1250));
   }
   let imported=0,failed=0,index=0;for(const id of found){index++;setProgress(`Importando ${id} (${index}/${found.size})…`);const r=await fetch('/api/mayhem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'riot',matchId:id})}),b:any=await r.json();if(r.ok)imported++;else{failed++;errors.push(`${id}: ${b.error}`)};await new Promise(r=>setTimeout(r,1250))}
   await onUpdated();setSummary(`${players.length} jogadores consultados · ${found.size} partidas novas encontradas · ${imported} importadas · ${failed} não importadas.`);
  }catch{errors.push('Não foi possível concluir a busca de todos os jogadores.')}finally{setIssues(errors);setProgress('');setBusy(false)}
 }
 function sync(){if(admin){void syncRemote();return}location.href=`http://127.0.0.1:47831/sync`;}
 return <section className="panel detail mayhem-sync-card"><div className="toolbar"><div><span className="mayhem-kicker">SINCRONIZAÇÃO LOCAL</span><h2>Partidas dos jogadores</h2><p className="muted"><strong>{admin?'A busca administrativa consulta diretamente a Riot e não exige o League aberto.':'O League of Legends e o conector da Arena precisam estar abertos neste computador.'}</strong> {admin?'Todos os jogadores cadastrados são verificados individualmente.':'A busca volta automaticamente para cá e importa as partidas da conta aberta.'}</p><p className="muted">Primeiro uso neste computador? <a href="/downloads/conector-aram.zip" download>Baixe o conector atualizado</a>, extraia a pasta e abra “Iniciar conector ARAM”.</p></div>{signedIn?<button className="gold" disabled={busy||!players.length} onClick={sync}>{busy?'Consultando jogadores…':admin?'Buscar partidas de todos':'Buscar partidas da conta aberta'}</button>:<a className="button gold" href="/cadastro">Entrar para atualizar partidas</a>}</div>{!signedIn&&<p className="mayhem-auth-note">Entre com sua conta antes de buscar. Isso protege o ranking contra resultados enviados por pessoas de fora do grupo.</p>}{progress&&<p role="status">{progress} Mantenha esta aba aberta até concluir.</p>}{summary&&<p role="status" className="sync-summary">{summary}</p>}{issues.length>0&&<div role="alert" className="mayhem-error">{issues.map((s,i)=><p key={i}>{s}</p>)}</div>}</section>
}
