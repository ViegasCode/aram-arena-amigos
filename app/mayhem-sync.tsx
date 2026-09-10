'use client';
import {useState} from 'react';
export default function MayhemSync({players,knownIds,onUpdated}:{players:any[];knownIds:string[];onUpdated:()=>Promise<unknown>}){
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[summary,setSummary]=useState(''),[issues,setIssues]=useState<string[]>([]);
 async function sync(){
  setBusy(true);setSummary('');setIssues([]);
  const known=new Set(knownIds),errors:string[]=[];let imported=0,duplicates=0,unavailable=0;
  async function post(path:string,body:any){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b:any=await r.json();return {status:r.status,ok:r.ok,...b};}
  try{
   setProgress('Lendo as partidas no cliente do League of Legends…');
   const response=await fetch('http://127.0.0.1:47831/matches',{cache:'no-store',signal:AbortSignal.timeout(20000)});
   const local:any=await response.json();
   if(!response.ok)throw new Error(local.error||'Não foi possível acessar o cliente do LoL.');
   const matches=Array.isArray(local.matches)?local.matches:[];
   let count=0;for(const match of matches){count++;if(known.has(match.matchId)){duplicates++;continue;}
    setProgress(`Importando ${match.matchId} (${count}/${matches.length})…`);
    try{const b=await post('/api/mayhem',{action:'client',...match});if(b.ok)imported++;else if(b.status===409||/duplicada|já foi registrada/.test(b.error))duplicates++;else{unavailable++;errors.push(`${match.matchId}: ${b.error}`);}}
    catch{unavailable++;errors.push(`${match.matchId}: falha de conexão.`);}
   }
   await onUpdated();
   setSummary(`${matches.length} partidas Mayhem encontradas · ${imported} importadas · ${duplicates} já registradas · ${unavailable} não importadas.`);
  }catch(e){errors.push(e instanceof Error&&/fetch|cliente/i.test(e.message)?'Abra o League of Legends neste computador, entre na sua conta e tente novamente. O conector da Arena também precisa estar ativo.':'Não foi possível atualizar a classificação. Tente novamente.');}
  finally{setIssues(errors);setProgress('');setBusy(false);}
 }
 return <section className="panel detail"><div className="toolbar"><div><h2>Partidas dos jogadores</h2><p className="muted"><strong>O League of Legends precisa estar aberto neste computador.</strong> A busca lê as partidas Mayhem recentes do cliente e atualiza todos os jogadores cadastrados que participaram.</p></div><button className="gold" disabled={busy||!players.length} onClick={sync}>{busy?'Buscando partidas…':'Buscar partidas dos jogadores'}</button></div>{progress&&<p role="status">{progress} Mantenha esta aba aberta até concluir.</p>}{summary&&<p role="status">{summary}</p>}{issues.length>0&&<div role="alert" className="mayhem-error">{issues.map((s,i)=><p key={i}>{s}</p>)}</div>}</section>
}
