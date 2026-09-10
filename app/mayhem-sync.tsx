'use client';
import {useState} from 'react';
export default function MayhemSync({players,knownIds,onUpdated}:{players:any[];knownIds:string[];onUpdated:()=>Promise<unknown>}){
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[summary,setSummary]=useState(''),[issues,setIssues]=useState<string[]>([]);
 async function sync(){
  setBusy(true);setSummary('');setIssues([]);
  const found=new Set<string>(),known=new Set(knownIds),errors:string[]=[];let consulted=0,imported=0,duplicates=0,unavailable=0,stop=false;
  async function post(path:string,body:any){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b:any=await r.json();return {status:r.status,ok:r.ok,...b};}
  try{
   for(let i=0;i<players.length;i++){
    const p=players[i];setProgress(`Buscando partidas de ${p.name} (${i+1}/${players.length})…`);
    try{const b=await post('/api/mayhem-history',{playerId:p.id});if(!b.ok){errors.push(`${p.name}: ${b.error}`);if(b.status===429||/chave/.test(b.error)){stop=true;break;}}else{consulted++;b.matchIds.forEach((id:string)=>found.add(id));if(b.possiblyMore)errors.push(`${p.name}: consultadas as 100 partidas Mayhem mais recentes do período.`);}}
    catch{errors.push(`${p.name}: falha de conexão. Tente novamente.`);}
    await new Promise(r=>setTimeout(r,1500));
   }
   if(!stop){let count=0;for(const id of found){count++;if(known.has(id)){duplicates++;continue;}
    setProgress(`Importando ${id} (${count}/${found.size})…`);
    try{const b=await post('/api/mayhem',{action:'riot',matchId:id});if(b.ok){imported++;}else if(b.status===409||/duplicada|já foi registrada/.test(b.error)){duplicates++;}else{unavailable++;errors.push(`${id}: ${b.error}`);if(b.status===429||/chave/.test(b.error))break;}}
    catch{unavailable++;errors.push(`${id}: falha de conexão. Tente novamente.`);}
    await new Promise(r=>setTimeout(r,1500));
   }}
   await onUpdated();
   setSummary(`${consulted}/${players.length} jogadores consultados · ${found.size} partidas encontradas · ${imported} importadas · ${duplicates} já registradas · ${unavailable} não importadas.${found.size===0?' A Riot não retornou partidas Mayhem elegíveis. Partidas em andamento ou ainda indisponíveis não geram pontos.':''}`);
  }catch{errors.push('Não foi possível atualizar a classificação. Recarregue a página; os resultados já salvos foram mantidos.');}
  finally{setIssues(errors);setProgress('');setBusy(false);}
 }
 return <section className="panel detail"><div className="toolbar"><div><h2>Partidas dos jogadores</h2><p className="muted">Busca até 100 partidas Mayhem recentes por jogador, dentro do período da liga, e importa os resultados disponíveis na Riot.</p></div><button className="gold" disabled={busy||!players.length} onClick={sync}>{busy?'Buscando partidas…':'Buscar partidas dos jogadores'}</button></div>{progress&&<p role="status">{progress} Mantenha esta aba aberta até concluir.</p>}{summary&&<p role="status">{summary}</p>}{issues.length>0&&<div role="alert" className="mayhem-error">{issues.map((s,i)=><p key={i}>{s}</p>)}</div>}</section>
}
