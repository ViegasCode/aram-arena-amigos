'use client';
import {useEffect,useState} from 'react';
export default function MayhemSync({players,knownIds,onUpdated}:{players:any[];knownIds:string[];onUpdated:()=>Promise<unknown>}){
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[summary,setSummary]=useState(''),[issues,setIssues]=useState<string[]>([]);
 useEffect(()=>{const raw=new URLSearchParams(location.hash.slice(1)).get('mayhem-sync');if(!raw)return;history.replaceState(null,'',location.pathname+location.search);try{const bytes=Uint8Array.from(atob(raw.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const data=JSON.parse(new TextDecoder().decode(bytes));void importMatches(data.matches);}catch{setIssues(['O conector devolveu dados inválidos. Tente novamente.']);}},[]);
 async function importMatches(input:unknown){
  setBusy(true);setSummary('');setIssues([]);
  const known=new Set(knownIds),errors:string[]=[];let imported=0,duplicates=0,unavailable=0;
  async function post(path:string,body:any){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b:any=await r.json();return {status:r.status,ok:r.ok,...b};}
  try{
   const matches=Array.isArray(input)?input:[];
   let count=0;for(const match of matches){count++;if(known.has(match.matchId)){duplicates++;continue;}
    setProgress(`Importando ${match.matchId} (${count}/${matches.length})…`);
    try{const b=await post('/api/mayhem',{action:'client',...match});if(b.ok)imported++;else if(b.status===409||/duplicada|já foi registrada/.test(b.error))duplicates++;else{unavailable++;errors.push(`${match.matchId}: ${b.error}`);}}
    catch{unavailable++;errors.push(`${match.matchId}: falha de conexão.`);}
   }
   await onUpdated();
   setSummary(`${matches.length} partidas Mayhem encontradas · ${imported} importadas · ${duplicates} já registradas · ${unavailable} não importadas.`);
  }catch{errors.push('Não foi possível atualizar a classificação. Tente novamente.');}
  finally{setIssues(errors);setProgress('');setBusy(false);}
 }
 function sync(){location.href=`http://127.0.0.1:47831/sync`;}
 return <section className="panel detail"><div className="toolbar"><div><h2>Partidas dos jogadores</h2><p className="muted"><strong>O League of Legends e o conector da Arena precisam estar abertos neste computador.</strong> A busca volta automaticamente para cá e atualiza todos os jogadores cadastrados que participaram.</p></div><button className="gold" disabled={busy||!players.length} onClick={sync}>{busy?'Importando partidas…':'Buscar partidas dos jogadores'}</button></div>{progress&&<p role="status">{progress} Mantenha esta aba aberta até concluir.</p>}{summary&&<p role="status">{summary}</p>}{issues.length>0&&<div role="alert" className="mayhem-error">{issues.map((s,i)=><p key={i}>{s}</p>)}</div>}</section>
}
