import { useState, useMemo, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDQhBVBogW5ww9b8bGRf9sDTLy0HLH2xAo",
  authDomain: "financas-kpv.firebaseapp.com",
  projectId: "financas-kpv",
  storageBucket: "financas-kpv.firebasestorage.app",
  messagingSenderId: "746701888550",
  appId: "1:746701888550:web:d2689be734fee12ffa9ae7",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const C = {
  bg:"#080808", surface:"#101010", surface2:"#141414", border:"#1f1f1f", border2:"#282828",
  text:"#f2f2f2", muted:"#606060", muted2:"#383838",
  amber:"#f59e0b", amberLo:"#f59e0b1a", amberMid:"#f59e0b44",
  warn:"#fb923c", danger:"#ef4444", white:"#ffffff",
};

const CATS_GASTO = [
  {nome:"Alimentação",emoji:"🍽️"},{nome:"Transporte",emoji:"🚌"},
  {nome:"Lazer",emoji:"🎮"},{nome:"Saúde",emoji:"💊"},
  {nome:"Moradia",emoji:"🏠"},{nome:"Educação",emoji:"📚"},{nome:"Outros",emoji:"📦"},
];
const CATS_ENTRADA = [
  {nome:"Salário",emoji:"💼"},{nome:"Freelance",emoji:"💻"},
  {nome:"Investimento",emoji:"📈"},{nome:"Presente",emoji:"🎁"},{nome:"Outros",emoji:"📦"},
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MS    = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const fBRL   = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fShort = v => v>=1000?`R$${(v/1000).toFixed(1)}k`:`R$${v.toFixed(0)}`;

function useIsMobile(){
  const [m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{const fn=()=>setM(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  return m;
}

function getSaude(pct,saldo){
  if(pct<=60)  return{label:"Saudável",  cor:C.amber, icon:"✦",msg:"Ótimo controle! Você está bem abaixo do limite."};
  if(pct<=80)  return{label:"Razoável",  cor:C.warn,  icon:"◈",msg:"Atenção: mais de 60% da renda comprometida."};
  if(pct<=100) return{label:"Crítico",   cor:C.danger,icon:"⚠",msg:"Limite quase atingido! Reduza gastos agora."};
  return              {label:"Estourado",cor:C.danger,icon:"🔴",msg:`Saldo negativo de ${fBRL(Math.abs(saldo))}!`};
}

// ── Shared UI ────────────────────────────────────────────
function Card({children,style={},amber=false}){
  return <div style={{background:C.surface,border:`1px solid ${amber?C.amber+"33":C.border}`,borderRadius:16,...style}}>{children}</div>;
}
function Label({children}){
  return <p style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{children}</p>;
}

// ── BarChart ──────────────────────────────────────────────
function BarChart({gastos}){
  const totais=CATS_GASTO.map(c=>({...c,total:gastos.filter(g=>g.categoria===c.nome).reduce((s,g)=>s+g.valor,0)})).filter(t=>t.total>0).sort((a,b)=>b.total-a.total);
  const max=Math.max(...totais.map(t=>t.total),1);
  if(!totais.length) return <p style={{color:C.muted,textAlign:"center",fontSize:14,padding:"24px 0"}}>Nenhum gasto registrado</p>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {totais.map(t=>(
        <div key={t.nome} style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{width:24,textAlign:"center",fontSize:16}}>{t.emoji}</span>
          <span style={{width:96,fontSize:13,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{t.nome}</span>
          <div style={{flex:1,background:C.border,borderRadius:4,height:18,overflow:"hidden"}}>
            <div style={{width:`${(t.total/max)*100}%`,background:`linear-gradient(90deg,${C.amberMid},${C.amber})`,height:"100%",borderRadius:4,transition:"width .7s cubic-bezier(.4,0,.2,1)"}}/>
          </div>
          <span style={{width:88,fontSize:12,color:C.amber,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{fBRL(t.total)}</span>
        </div>
      ))}
    </div>
  );
}

// ── AnualChart ────────────────────────────────────────────
function AnualChart({gastos,entradas}){
  const ano=new Date().getFullYear(), mc=new Date().getMonth();
  const dados=MS.map((m,i)=>({
    m,i,
    renda:entradas.filter(e=>{const d=new Date(e.data+"T12:00:00");return d.getMonth()===i&&d.getFullYear()===ano;}).reduce((s,e)=>s+e.valor,0),
    gasto:gastos.filter(g=>{const d=new Date(g.data+"T12:00:00");return d.getMonth()===i&&d.getFullYear()===ano;}).reduce((s,g)=>s+g.valor,0),
  }));
  const max=Math.max(...dados.map(d=>Math.max(d.renda,d.gasto)),1);
  return(
    <div>
      <div style={{display:"flex",gap:16,marginBottom:14}}>
        {[{cor:C.amber,label:"entradas"},{cor:C.muted2,label:"gastos"}].map(l=>(
          <div key={l.label} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,background:l.cor,borderRadius:2}}/><span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{l.label}</span></div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:110}}>
        {dados.map(d=>{
          const hR=Math.max((d.renda/max)*88,d.renda>0?3:0);
          const hG=Math.max((d.gasto/max)*88,d.gasto>0?3:0);
          const cur=d.i===mc;
          return(
            <div key={d.m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <div style={{width:"100%",height:88,display:"flex",alignItems:"flex-end",gap:1}}>
                <div style={{flex:1,height:hR,background:cur?C.amber:C.amberMid,borderRadius:"3px 3px 1px 1px",transition:"height .6s"}}/>
                <div style={{flex:1,height:hG,background:cur?"#555":C.muted2,borderRadius:"3px 3px 1px 1px",transition:"height .6s"}}/>
              </div>
              <span style={{fontSize:10,color:cur?C.white:C.muted2,fontFamily:"'DM Mono',monospace",fontWeight:cur?700:400}}>{d.m}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PainelSaude ───────────────────────────────────────────
function PainelSaude({pct,saldo,gastosMes,renda}){
  const s=getSaude(pct,saldo);
  const top=CATS_GASTO.map(c=>({...c,total:gastosMes.filter(g=>g.categoria===c.nome).reduce((a,g)=>a+g.valor,0)})).sort((a,b)=>b.total-a.total).filter(c=>c.total>0).slice(0,3);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {/* Status badge */}
      <div style={{padding:"18px 20px",background:s.cor+"14",border:`1px solid ${s.cor}44`,borderRadius:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:s.cor+"22",border:`2px solid ${s.cor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{s.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>saúde financeira</p>
            <p style={{fontSize:20,fontWeight:700,color:s.cor,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{s.label}</p>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:2}}>comprometido</p>
            <p style={{fontSize:16,fontWeight:700,color:s.cor,fontFamily:"'DM Mono',monospace"}}>{pct.toFixed(1)}%</p>
          </div>
        </div>
        <p style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace",lineHeight:1.5,borderLeft:`3px solid ${s.cor}44`,paddingLeft:10}}>{s.msg}</p>
      </div>

      {/* Medidor */}
      <Card style={{padding:"16px 20px"}}>
        <Label>comprometimento da renda</Label>
        <div style={{background:C.border,borderRadius:99,height:10,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",left:"60%",top:0,bottom:0,width:1,background:C.border2,zIndex:1}}/>
          <div style={{position:"absolute",left:"80%",top:0,bottom:0,width:1,background:C.border2,zIndex:1}}/>
          <div style={{width:`${Math.min(pct,100)}%`,background:`linear-gradient(90deg,${C.amber},${s.cor})`,height:"100%",transition:"width .6s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
          {["livre","60% ótimo","80% alerta","crítico"].map(l=><span key={l} style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>{l}</span>)}
        </div>
      </Card>

      {/* Top categorias */}
      {top.length>0&&(
        <Card style={{padding:"16px 20px"}}>
          <Label>maiores gastos do mês</Label>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {top.map((c,i)=>(
              <div key={c.nome} style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,color:C.muted2,fontFamily:"'DM Mono',monospace",width:18}}>#{i+1}</span>
                <span style={{fontSize:17}}>{c.emoji}</span>
                <span style={{flex:1,fontSize:14,color:C.text}}>{c.nome}</span>
                <span style={{fontSize:13,color:C.amber,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{fBRL(c.total)}</span>
                {renda>0&&<span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",width:32,textAlign:"right",flexShrink:0}}>{((c.total/renda)*100).toFixed(0)}%</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 50/30/20 */}
      <Card style={{padding:"16px 20px"}}>
        <Label>regra 50 · 30 · 20</Label>
        <div style={{display:"flex",gap:8}}>
          {[{label:"Essencial",pct:50},{label:"Lazer",pct:30},{label:"Reserva",pct:20}].map(r=>(
            <div key={r.label} style={{flex:1,background:C.border,borderRadius:10,padding:"10px 0",textAlign:"center"}}>
              <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:5}}>{r.label}</p>
              <p style={{fontSize:18,color:C.amber,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{r.pct}%</p>
              <p style={{fontSize:11,color:C.muted2,fontFamily:"'DM Mono',monospace",marginTop:4}}>{fBRL(renda*r.pct/100)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── ListaLancamentos ──────────────────────────────────────
function ListaLancamentos({gastosMes,entradasMes,carregando,onDelGasto,onDelEntrada}){
  const [aba,setAba]=useState("gastos");
  const totalG=gastosMes.reduce((s,g)=>s+g.valor,0);
  const totalE=entradasMes.reduce((s,e)=>s+e.valor,0);
  return(
    <Card style={{padding:"20px 22px",display:"flex",flexDirection:"column",minHeight:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:3,background:C.border,borderRadius:10,padding:3}}>
          {[{id:"gastos",label:"Gastos"},{id:"entradas",label:"Entradas"}].map(a=>(
            <button key={a.id} onClick={()=>setAba(a.id)} style={{padding:"6px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontFamily:"'DM Mono',monospace",transition:"all .2s",background:aba===a.id?C.border2:"transparent",color:aba===a.id?C.white:C.muted}}>{a.label}</button>
          ))}
        </div>
        <span style={{fontSize:13,color:C.amber,fontFamily:"'DM Mono',monospace"}}>
          {aba==="gastos"?`${gastosMes.length} itens · ${fBRL(totalG)}`:`${entradasMes.length} itens · ${fBRL(totalE)}`}
        </span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 24px",gap:8,padding:"0 0 10px",borderBottom:`1px solid ${C.border}`}}>
        {["Descrição","Categoria","Data","Valor",""].map((h,i)=>(
          <span key={i} style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</span>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",marginTop:4}}>
        {carregando&&<p style={{color:C.muted,fontSize:14,textAlign:"center",padding:"24px 0"}}>Carregando...</p>}
        {aba==="gastos"&&(
          <>
            {!carregando&&gastosMes.length===0&&<p style={{color:C.muted,fontSize:14,textAlign:"center",padding:"24px 0"}}>Nenhum gasto este mês</p>}
            {[...gastosMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(g=>{
              const cat=CATS_GASTO.find(c=>c.nome===g.categoria)||CATS_GASTO[6];
              return(
                <div key={g.id} className="row-t" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 24px",gap:8,padding:"12px 0",borderBottom:`1px solid ${C.border}18`,alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:16}}>{cat.emoji}</span><span style={{fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.descricao}</span></div>
                  <span style={{padding:"3px 9px",borderRadius:20,fontSize:11,background:C.border2,color:C.muted,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"inline-block"}}>{g.categoria}</span>
                  <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{new Date(g.data+"T12:00:00").toLocaleDateString("pt-BR")}</span>
                  <span style={{fontSize:14,color:C.white,fontFamily:"'DM Mono',monospace",textAlign:"right"}}>{fBRL(g.valor)}</span>
                  <button onClick={()=>onDelGasto(g.id)} className="del" style={{opacity:0,background:"transparent",border:"none",color:C.danger,fontSize:17,cursor:"pointer",transition:"opacity .2s"}}>×</button>
                </div>
              );
            })}
          </>
        )}
        {aba==="entradas"&&(
          <>
            {!carregando&&entradasMes.length===0&&<p style={{color:C.muted,fontSize:14,textAlign:"center",padding:"24px 0"}}>Nenhuma entrada este mês</p>}
            {[...entradasMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(e=>{
              const cat=CATS_ENTRADA.find(c=>c.nome===e.categoria)||CATS_ENTRADA[4];
              return(
                <div key={e.id} className="row-t" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 24px",gap:8,padding:"12px 0",borderBottom:`1px solid ${C.border}18`,alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:16}}>{cat.emoji}</span><span style={{fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.descricao}</span></div>
                  <span style={{padding:"3px 9px",borderRadius:20,fontSize:11,background:C.amberLo,color:C.amber,fontFamily:"'DM Mono',monospace"}}>{e.categoria}</span>
                  <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{new Date(e.data+"T12:00:00").toLocaleDateString("pt-BR")}</span>
                  <span style={{fontSize:14,color:C.amber,fontFamily:"'DM Mono',monospace",textAlign:"right"}}>{fBRL(e.valor)}</span>
                  <button onClick={()=>onDelEntrada(e.id)} className="del" style={{opacity:0,background:"transparent",border:"none",color:C.danger,fontSize:17,cursor:"pointer",transition:"opacity .2s"}}>×</button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </Card>
  );
}

// ── Modal mobile ──────────────────────────────────────────
function Modal({tipo,onClose,onSave}){
  const hoje=new Date().toISOString().split("T")[0];
  const cats=tipo==="gasto"?CATS_GASTO:CATS_ENTRADA;
  const [form,setForm]=useState({descricao:tipo==="gasto"?"":cats[0].nome,valor:"",categoria:cats[0].nome,data:hoje});
  const salvar=()=>{
    if(!form.valor||isNaN(parseFloat(form.valor)))return;
    if(tipo==="gasto"&&!form.descricao)return;
    onSave({...form,valor:parseFloat(form.valor)});
  };
  return(
    <div style={{position:"fixed",inset:0,background:"#000000e0",zIndex:100,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.border2}`,borderRadius:"22px 22px 0 0",padding:24,width:"100%",display:"flex",flexDirection:"column",gap:14}} onClick={e=>e.stopPropagation()}>
        {/* handle */}
        <div style={{width:36,height:4,background:C.border2,borderRadius:99,margin:"-8px auto 0"}}/>
        <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:tipo==="gasto"?C.white:C.amber,marginTop:4}}>{tipo==="gasto"?"Novo gasto":"Nova entrada"}</p>
        {tipo==="gasto"&&<input className="inp" placeholder="Descrição" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} autoFocus/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <input className="inp" placeholder="Valor (R$)" type="number" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} autoFocus={tipo==="entrada"}/>
          <input className="inp" type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {cats.map(c=>(
            <button key={c.nome} onClick={()=>setForm({...form,categoria:c.nome,...(tipo==="entrada"?{descricao:c.nome}:{})})}
              style={{padding:"7px 14px",borderRadius:22,border:`1px solid ${form.categoria===c.nome?C.amber:C.border2}`,background:form.categoria===c.nome?C.amberLo:"transparent",color:form.categoria===c.nome?C.amber:C.muted,fontSize:13,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all .15s"}}>
              {c.emoji} {c.nome}
            </button>
          ))}
        </div>
        <button onClick={salvar} style={{background:tipo==="gasto"?C.white:C.amber,color:C.bg,fontWeight:700,padding:"15px",borderRadius:12,border:"none",fontSize:16,cursor:"pointer",marginTop:2}}>
          Salvar {tipo}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MOBILE
// ══════════════════════════════════════════════════════════
function MobileApp({gastos,entradas,carregando,onAddGasto,onAddEntrada,onDelGasto,onDelEntrada}){
  const hoje=new Date();
  const [mes,setMes]=useState(hoje.getMonth());
  const [ano,setAno]=useState(hoje.getFullYear());
  const [modal,setModal]=useState(null);
  const [aba,setAba]=useState("resumo");

  const gastosMes  =useMemo(()=>gastos.filter(g=>{const d=new Date(g.data+"T12:00:00");return d.getMonth()===mes&&d.getFullYear()===ano;}),[gastos,mes,ano]);
  const entradasMes=useMemo(()=>entradas.filter(e=>{const d=new Date(e.data+"T12:00:00");return d.getMonth()===mes&&d.getFullYear()===ano;}),[entradas,mes,ano]);
  const totalG=gastosMes.reduce((s,g)=>s+g.valor,0);
  const totalE=entradasMes.reduce((s,e)=>s+e.valor,0);
  const saldo=totalE-totalG;
  const pct=totalE>0?Math.min((totalG/totalE)*100,100):0;
  const saude=getSaude(totalE>0?(totalG/totalE)*100:0,saldo);
  const corB=pct>85?C.danger:pct>60?C.warn:C.amber;
  const mudar=(d)=>{let m=mes+d,a=ano;if(m<0){m=11;a--;}if(m>11){m=0;a++;}setMes(m);setAno(a);};

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,paddingBottom:90,fontFamily:"'Georgia',serif"}}>
      {/* Header */}
      <div style={{padding:"22px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,lineHeight:1}}>Finanças <span style={{color:C.amber}}>Pessoais</span></h1>
          <p style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:3}}>{MESES[mes]} {ano}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:carregando?C.warn:C.amber,boxShadow:`0 0 8px ${carregando?C.warn:C.amber}`}}/>
          <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{carregando?"sync...":"ao vivo"}</span>
        </div>
      </div>

      {/* Mês nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px 0"}}>
        <button onClick={()=>mudar(-1)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:17,lineHeight:1}}>←</button>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:600}}>{MESES[mes]}</span>
        <button onClick={()=>mudar(1)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:17,lineHeight:1}}>→</button>
      </div>

      {/* Cards topo */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,padding:"14px 18px 0"}}>
        {[
          {label:"Entradas",valor:totalE,cor:C.amber},
          {label:"Gastos",valor:totalG,cor:C.white},
          {label:"Saldo",valor:saldo,cor:saldo>=0?C.amber:C.danger},
        ].map(item=>(
          <div key={item.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 12px"}}>
            <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.label}</p>
            <p style={{fontSize:14,fontWeight:700,color:item.cor,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{fBRL(item.valor)}</p>
          </div>
        ))}
      </div>

      {/* Barra */}
      <div style={{margin:"12px 18px 0",background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:saude.cor,boxShadow:`0 0 6px ${saude.cor}`}}/>
            <span style={{fontSize:13,color:saude.cor,fontFamily:"'DM Mono',monospace",fontWeight:600}}>{saude.label}</span>
          </div>
          <span style={{fontSize:13,color:corB,fontFamily:"'DM Mono',monospace"}}>{pct.toFixed(1)}%</span>
        </div>
        <div style={{background:C.border,borderRadius:99,height:7}}>
          <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${C.amberMid},${corB})`,height:"100%",borderRadius:99,transition:"width .6s"}}/>
        </div>
        <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:7}}>{saude.msg}</p>
      </div>

      {/* Abas */}
      <div style={{display:"flex",margin:"14px 18px 0",background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:4,gap:3}}>
        {[{id:"resumo",label:"Resumo"},{id:"gastos",label:"Gastos"},{id:"entradas",label:"Entradas"},{id:"cats",label:"Categ."}].map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)} style={{flex:1,padding:"9px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace",transition:"all .2s",background:aba===a.id?C.border2:"transparent",color:aba===a.id?C.white:C.muted}}>{a.label}</button>
        ))}
      </div>

      {/* Conteúdo abas */}
      <div style={{margin:"12px 18px 0",background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:16}}>
        {aba==="cats"&&<BarChart gastos={gastosMes}/>}
        {aba==="resumo"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <p style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>regra 50 · 30 · 20</p>
              <div style={{display:"flex",gap:8}}>
                {[{label:"Essencial",pct:50},{label:"Lazer",pct:30},{label:"Reserva",pct:20}].map(r=>(
                  <div key={r.label} style={{flex:1,background:C.border,borderRadius:10,padding:"10px 0",textAlign:"center"}}>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:4}}>{r.label}</p>
                    <p style={{fontSize:16,color:C.amber,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{r.pct}%</p>
                    <p style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginTop:3}}>{fBRL(totalE*r.pct/100)}</p>
                  </div>
                ))}
              </div>
            </div>
            <AnualChart gastos={gastos} entradas={entradas}/>
          </div>
        )}
        {aba==="gastos"&&(
          <>
            {!carregando&&gastosMes.length===0&&<p style={{color:C.muted,fontSize:14,textAlign:"center",padding:"18px 0"}}>Nenhum gasto este mês</p>}
            {[...gastosMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(g=>{
              const cat=CATS_GASTO.find(c=>c.nome===g.categoria)||CATS_GASTO[6];
              return(
                <div key={g.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{width:36,height:36,borderRadius:10,background:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.emoji}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.descricao}</p>
                    <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:2}}>{new Date(g.data+"T12:00:00").toLocaleDateString("pt-BR")} · {g.categoria}</p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{fontSize:14,color:C.white,fontFamily:"'DM Mono',monospace"}}>{fBRL(g.valor)}</p>
                  </div>
                  <button onClick={()=>onDelGasto(g.id)} style={{background:"transparent",border:"none",color:C.muted2,fontSize:20,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
                </div>
              );
            })}
          </>
        )}
        {aba==="entradas"&&(
          <>
            {!carregando&&entradasMes.length===0&&<p style={{color:C.muted,fontSize:14,textAlign:"center",padding:"18px 0"}}>Nenhuma entrada este mês</p>}
            {[...entradasMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(e=>{
              const cat=CATS_ENTRADA.find(c=>c.nome===e.categoria)||CATS_ENTRADA[4];
              return(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{width:36,height:36,borderRadius:10,background:C.amberLo,border:`1px solid ${C.amber}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.emoji}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.descricao}</p>
                    <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:2}}>{new Date(e.data+"T12:00:00").toLocaleDateString("pt-BR")} · {e.categoria}</p>
                  </div>
                  <p style={{fontSize:14,color:C.amber,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{fBRL(e.valor)}</p>
                  <button onClick={()=>onDelEntrada(e.id)} style={{background:"transparent",border:"none",color:C.muted2,fontSize:20,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* FABs */}
      <div style={{position:"fixed",bottom:96,right:18,display:"flex",flexDirection:"column",alignItems:"center",gap:8,zIndex:50}}>
        <span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>entrada</span>
        <button onClick={()=>setModal("entrada")} style={{width:52,height:52,borderRadius:"50%",background:C.amber,border:"none",color:C.bg,fontSize:24,cursor:"pointer",boxShadow:`0 4px 24px ${C.amber}55`,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>+</button>
        <button onClick={()=>setModal("gasto")} style={{width:52,height:52,borderRadius:"50%",background:C.white,border:"none",color:C.bg,fontSize:24,cursor:"pointer",boxShadow:"0 4px 24px #ffffff22",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>−</button>
        <span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>gasto</span>
      </div>

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",padding:"10px 0 18px",zIndex:40}}>
        {[{emoji:"📊",label:"Resumo"},{emoji:"💸",label:"Gastos"},{emoji:"💰",label:"Entradas"},{emoji:"📈",label:"Gráficos"}].map((item,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:20}}>{item.emoji}</span>
            <span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{item.label}</span>
          </div>
        ))}
      </div>

      {modal&&<Modal tipo={modal} onClose={()=>setModal(null)} onSave={async(d)=>{if(modal==="gasto")await onAddGasto(d);else await onAddEntrada(d);setModal(null);}}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DESKTOP
// ══════════════════════════════════════════════════════════
const lbl={fontSize:12,color:"#505050",fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:7};

function DesktopApp({gastos,entradas,carregando,onAddGasto,onAddEntrada,onDelGasto,onDelEntrada}){
  const hoje=new Date();
  const [mes,setMes]=useState(hoje.getMonth());
  const [ano,setAno]=useState(hoje.getFullYear());
  const [abaForm,setAbaForm]=useState("gasto");
  const [showForm,setShowForm]=useState(false);
  const [formG,setFormG]=useState({descricao:"",valor:"",categoria:"Alimentação",data:hoje.toISOString().split("T")[0]});
  const [formE,setFormE]=useState({descricao:"Salário",valor:"",categoria:"Salário",data:hoje.toISOString().split("T")[0]});

  const gastosMes  =useMemo(()=>gastos.filter(g=>{const d=new Date(g.data+"T12:00:00");return d.getMonth()===mes&&d.getFullYear()===ano;}),[gastos,mes,ano]);
  const entradasMes=useMemo(()=>entradas.filter(e=>{const d=new Date(e.data+"T12:00:00");return d.getMonth()===mes&&d.getFullYear()===ano;}),[entradas,mes,ano]);
  const totalG=gastosMes.reduce((s,g)=>s+g.valor,0);
  const totalE=entradasMes.reduce((s,e)=>s+e.valor,0);
  const saldo=totalE-totalG;
  const pctReal=totalE>0?(totalG/totalE)*100:0;
  const saude=getSaude(pctReal,saldo);
  const corB=pctReal>85?C.danger:pctReal>60?C.warn:C.amber;
  const mudar=(d)=>{let m=mes+d,a=ano;if(m<0){m=11;a--;}if(m>11){m=0;a++;}setMes(m);setAno(a);};
  const diasMes=gastosMes.length>0?Math.max(...gastosMes.map(g=>new Date(g.data+"T12:00:00").getDate())):1;
  const mediaDia=diasMes>0?totalG/diasMes:0;

  const salvarGasto=async()=>{
    if(!formG.descricao||!formG.valor||isNaN(parseFloat(formG.valor)))return;
    await onAddGasto({...formG,valor:parseFloat(formG.valor)});
    setFormG({descricao:"",valor:"",categoria:"Alimentação",data:hoje.toISOString().split("T")[0]});
    setShowForm(false);
  };
  const salvarEntrada=async()=>{
    if(!formE.valor||isNaN(parseFloat(formE.valor)))return;
    await onAddEntrada({...formE,valor:parseFloat(formE.valor)});
    setFormE({descricao:"Salário",valor:"",categoria:"Salário",data:hoje.toISOString().split("T")[0]});
    setShowForm(false);
  };

  return(
    <div style={{height:"100vh",background:C.bg,color:C.text,fontFamily:"'Georgia',serif",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Topbar */}
      <div style={{flexShrink:0,borderBottom:`1px solid ${C.border}`,padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,letterSpacing:"-0.5px",lineHeight:1,whiteSpace:"nowrap"}}>
            Finanças <span style={{color:C.amber}}>Pessoais</span>
          </h1>
          <div style={{width:1,height:20,background:C.border}}/>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:carregando?C.warn:C.amber,boxShadow:`0 0 8px ${carregando?C.warn:C.amber}`}}/>
            <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{carregando?"sincronizando...":"ao vivo"}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>mudar(-1)} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.muted,borderRadius:9,padding:"7px 14px",cursor:"pointer",fontSize:15,lineHeight:1}}>←</button>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,minWidth:150,textAlign:"center",whiteSpace:"nowrap"}}>{MESES[mes]} {ano}</span>
          <button onClick={()=>mudar(1)} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.muted,borderRadius:9,padding:"7px 14px",cursor:"pointer",fontSize:15,lineHeight:1}}>→</button>
          <div style={{width:1,height:20,background:C.border}}/>
          <button onClick={()=>{setAbaForm("gasto");setShowForm(abaForm==="gasto"?!showForm:true);}} style={{background:showForm&&abaForm==="gasto"?C.border2:C.white,color:C.bg,fontWeight:700,padding:"8px 18px",borderRadius:10,border:"none",fontSize:13,cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap"}}>
            {showForm&&abaForm==="gasto"?"✕ Fechar":"− Gasto"}
          </button>
          <button onClick={()=>{setAbaForm("entrada");setShowForm(abaForm==="entrada"?!showForm:true);}} style={{background:showForm&&abaForm==="entrada"?C.border2:C.amber,color:C.bg,fontWeight:700,padding:"8px 18px",borderRadius:10,border:"none",fontSize:13,cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap"}}>
            {showForm&&abaForm==="entrada"?"✕ Fechar":"+ Entrada"}
          </button>
        </div>
      </div>

      <div style={{flex:1,padding:"20px 24px",display:"flex",flexDirection:"column",gap:16,overflowY:"auto",minHeight:0}}>


        {/* ── Formulário ── */}
        {showForm&&(
          <Card amber style={{padding:22}}>
            <div style={{display:"flex",gap:3,marginBottom:18,width:"fit-content",background:C.border,borderRadius:10,padding:3}}>
              {[{id:"gasto",label:"− Gasto"},{id:"entrada",label:"+ Entrada"}].map(t=>(
                <button key={t.id} onClick={()=>setAbaForm(t.id)} style={{padding:"7px 22px",borderRadius:8,border:"none",cursor:"pointer",fontSize:14,fontFamily:"'DM Mono',monospace",fontWeight:600,transition:"all .2s",background:abaForm===t.id?(t.id==="entrada"?C.amber:C.white):"transparent",color:abaForm===t.id?C.bg:C.muted}}>{t.label}</button>
              ))}
            </div>
            {abaForm==="gasto"?(
              <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:2,minWidth:160}}><label style={lbl}>descrição</label><input className="inp" placeholder="Ex: Supermercado" value={formG.descricao} onChange={e=>setFormG({...formG,descricao:e.target.value})} onKeyDown={e=>e.key==="Enter"&&salvarGasto()} autoFocus/></div>
                <div style={{flex:1,minWidth:100}}><label style={lbl}>valor</label><input className="inp" placeholder="0,00" type="number" value={formG.valor} onChange={e=>setFormG({...formG,valor:e.target.value})} onKeyDown={e=>e.key==="Enter"&&salvarGasto()}/></div>
                <div style={{flex:1,minWidth:120}}><label style={lbl}>data</label><input className="inp" type="date" value={formG.data} onChange={e=>setFormG({...formG,data:e.target.value})}/></div>
                <div style={{flex:1,minWidth:140}}><label style={lbl}>categoria</label><select className="inp" value={formG.categoria} onChange={e=>setFormG({...formG,categoria:e.target.value})}>{CATS_GASTO.map(c=><option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}</select></div>
                <button onClick={salvarGasto} style={{background:C.white,color:C.bg,fontWeight:700,padding:"11px 24px",borderRadius:10,border:"none",cursor:"pointer",fontSize:14,whiteSpace:"nowrap"}}>Salvar ↵</button>
              </div>
            ):(
              <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:2,minWidth:160}}><label style={lbl}>descrição</label><input className="inp" placeholder="Ex: Salário março" value={formE.descricao} onChange={e=>setFormE({...formE,descricao:e.target.value})} onKeyDown={e=>e.key==="Enter"&&salvarEntrada()} autoFocus/></div>
                <div style={{flex:1,minWidth:100}}><label style={lbl}>valor</label><input className="inp" placeholder="0,00" type="number" value={formE.valor} onChange={e=>setFormE({...formE,valor:e.target.value})} onKeyDown={e=>e.key==="Enter"&&salvarEntrada()}/></div>
                <div style={{flex:1,minWidth:120}}><label style={lbl}>data</label><input className="inp" type="date" value={formE.data} onChange={e=>setFormE({...formE,data:e.target.value})}/></div>
                <div style={{flex:1,minWidth:140}}><label style={lbl}>categoria</label><select className="inp" value={formE.categoria} onChange={e=>setFormE({...formE,categoria:e.target.value,descricao:e.target.value})}>{CATS_ENTRADA.map(c=><option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}</select></div>
                <button onClick={salvarEntrada} style={{background:C.amber,color:C.bg,fontWeight:700,padding:"11px 24px",borderRadius:10,border:"none",cursor:"pointer",fontSize:14,whiteSpace:"nowrap"}}>Salvar ↵</button>
              </div>
            )}
          </Card>
        )}

        {/* ── Banner saúde ── */}
        <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 24px",background:saude.cor+"10",border:`1px solid ${saude.cor}33`,borderRadius:14,width:"100%",boxSizing:"border-box"}}>
          <div style={{width:46,height:46,borderRadius:"50%",background:saude.cor+"20",border:`2px solid ${saude.cor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{saude.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4,flexWrap:"wrap"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:saude.cor,whiteSpace:"nowrap"}}>Saúde Financeira: {saude.label}</span>
              <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace",background:C.border,padding:"2px 10px",borderRadius:20,whiteSpace:"nowrap"}}>{pctReal.toFixed(1)}% comprometido</span>
            </div>
            <p style={{fontSize:13,color:C.muted,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{saude.msg}</p>
          </div>
          <div style={{textAlign:"right",flexShrink:0,marginLeft:"auto"}}>
            <p style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:3}}>saldo do mês</p>
            <p style={{fontSize:24,fontWeight:700,color:saldo>=0?C.amber:C.danger,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{fBRL(saldo)}</p>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14}}>
          {[
            {label:"Entradas",    valor:totalE,      cor:C.amber,               sub:`${entradasMes.length} registro(s)`},
            {label:"Total gasto", valor:totalG,      cor:C.white,               sub:`${gastosMes.length} lançamento(s)`},
            {label:"Saldo",       valor:saldo,        cor:saldo>=0?C.amber:C.danger, sub:saldo>=0?"positivo ✦":"negativo ⚠"},
            {label:"Maior gasto", valor:gastosMes.length?Math.max(...gastosMes.map(g=>g.valor)):0, cor:C.muted, sub:gastosMes.length?[...gastosMes].sort((a,b)=>b.valor-a.valor)[0]?.descricao||"—":"—"},
            {label:"Média/dia",   valor:mediaDia,     cor:C.muted,              sub:`base: ${diasMes} dia${diasMes>1?"s":""}`},
          ].map(item=>(
            <Card key={item.label} style={{padding:"18px 20px"}}>
              <Label>{item.label}</Label>
              <p style={{fontSize:18,fontWeight:700,color:item.cor,fontFamily:"'DM Mono',monospace",marginBottom:6,lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fBRL(item.valor)}</p>
              <p style={{fontSize:12,color:C.muted2,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.sub}</p>
            </Card>
          ))}
        </div>

        {/* ── Barra comprometimento ── */}
        <Card style={{padding:"16px 22px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:9}}>
            <span style={{fontSize:14,color:C.muted,fontFamily:"'DM Mono',monospace"}}>comprometimento da renda · {MESES[mes]}</span>
            <span style={{fontSize:13,color:corB,fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap"}}>{fBRL(totalG)} de {fBRL(totalE)}</span>
          </div>
          <div style={{background:C.border,borderRadius:99,height:10,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",left:"60%",top:0,bottom:0,width:1,background:C.border2,zIndex:1}}/>
            <div style={{position:"absolute",left:"80%",top:0,bottom:0,width:1,background:C.border2,zIndex:1}}/>
            <div style={{width:`${Math.min(pctReal,100)}%`,background:`linear-gradient(90deg,${C.amberMid},${corB})`,height:"100%",transition:"width .6s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            {["0% — livre","60% — ótimo","80% — alerta","100% — crítico"].map(l=>(
              <span key={l} style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>{l}</span>
            ))}
          </div>
        </Card>

        {/* ── Grid principal: 3 colunas ── */}
        {/* Col 1: categorias + anual | Col 2: lançamentos (alto) | Col 3: saúde detalhada */}
        <div style={{display:"grid",gridTemplateColumns:"22% 1fr 22%",gap:16,minHeight:0}}>

          {/* Col 1 */}
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <Card style={{padding:"20px 22px"}}>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:18}}>Gastos por categoria</p>
              <BarChart gastos={gastosMes}/>
            </Card>
            <Card style={{padding:"20px 22px"}}>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:18}}>Visão anual · {ano}</p>
              <AnualChart gastos={gastos} entradas={entradas}/>
            </Card>
          </div>

          {/* Col 2: lançamentos */}
          <Card style={{padding:"20px 22px",display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:18}}>Lançamentos de {MESES[mes]}</p>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 24px",gap:8,padding:"0 0 10px",borderBottom:`1px solid ${C.border}`}}>
              {["Descrição","Categoria","Data","Valor",""].map((h,i)=>(
                <span key={i} style={{fontSize:11,color:C.muted2,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</span>
              ))}
            </div>
            {/* Toggle */}
            <div style={{display:"flex",gap:3,margin:"12px 0",background:C.border,borderRadius:10,padding:3,width:"fit-content"}}>
              {[{id:"gastos",cor:C.white},{id:"entradas",cor:C.amber}].map(a=>(
                <button key={a.id} onClick={()=>{}} style={{padding:"5px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace",background:C.border2,color:a.cor,textTransform:"capitalize"}}>{a.id}</button>
              ))}
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              {carregando&&<p style={{color:C.muted,fontSize:14,textAlign:"center",padding:"24px 0"}}>Carregando...</p>}
              {/* Gastos */}
              {gastosMes.length===0&&entradasMes.length===0&&!carregando&&<p style={{color:C.muted,fontSize:14,textAlign:"center",padding:"24px 0"}}>Nenhum lançamento este mês</p>}
              {[...gastosMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(g=>{
                const cat=CATS_GASTO.find(c=>c.nome===g.categoria)||CATS_GASTO[6];
                return(
                  <div key={g.id} className="row-t" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 24px",gap:8,padding:"12px 0",borderBottom:`1px solid ${C.border}18`,alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:15}}>{cat.emoji}</span><span style={{fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.descricao}</span></div>
                    <span style={{padding:"3px 9px",borderRadius:20,fontSize:11,background:C.border2,color:C.muted,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"inline-block"}}>{g.categoria}</span>
                    <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{new Date(g.data+"T12:00:00").toLocaleDateString("pt-BR")}</span>
                    <span style={{fontSize:14,color:C.white,fontFamily:"'DM Mono',monospace",textAlign:"right"}}>{fBRL(g.valor)}</span>
                    <button onClick={()=>onDelGasto(g.id)} className="del" style={{opacity:0,background:"transparent",border:"none",color:C.danger,fontSize:17,cursor:"pointer",transition:"opacity .2s"}}>×</button>
                  </div>
                );
              })}
              {/* Entradas */}
              {entradasMes.length>0&&(
                <>
                  <div style={{padding:"14px 0 8px"}}><span style={{fontSize:11,color:C.amber,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>entradas</span></div>
                  {[...entradasMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(e=>{
                    const cat=CATS_ENTRADA.find(c=>c.nome===e.categoria)||CATS_ENTRADA[4];
                    return(
                      <div key={e.id} className="row-t" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 24px",gap:8,padding:"12px 0",borderBottom:`1px solid ${C.border}18`,alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:15}}>{cat.emoji}</span><span style={{fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.descricao}</span></div>
                        <span style={{padding:"3px 9px",borderRadius:20,fontSize:11,background:C.amberLo,color:C.amber,fontFamily:"'DM Mono',monospace"}}>{e.categoria}</span>
                        <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{new Date(e.data+"T12:00:00").toLocaleDateString("pt-BR")}</span>
                        <span style={{fontSize:14,color:C.amber,fontFamily:"'DM Mono',monospace",textAlign:"right"}}>{fBRL(e.valor)}</span>
                        <button onClick={()=>onDelEntrada(e.id)} className="del" style={{opacity:0,background:"transparent",border:"none",color:C.danger,fontSize:17,cursor:"pointer",transition:"opacity .2s"}}>×</button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </Card>

          {/* Col 3: saúde detalhada */}
          <PainelSaude pct={pctReal} saldo={saldo} gastosMes={gastosMes} renda={totalE}/>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════
export default function App(){
  const [gastos,   setGastos]   = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const isMobile = useIsMobile();

  useEffect(()=>{
    let ok1=false,ok2=false;
    const u1=onSnapshot(collection(db,"gastos"),  snap=>{setGastos(snap.docs.map(d=>({id:d.id,...d.data()})));ok1=true;if(ok1&&ok2)setCarregando(false);});
    const u2=onSnapshot(collection(db,"entradas"),snap=>{setEntradas(snap.docs.map(d=>({id:d.id,...d.data()})));ok2=true;if(ok1&&ok2)setCarregando(false);});
    return()=>{u1();u2();};
  },[]);

  const onAddGasto   =(d)=>addDoc(collection(db,"gastos"),  d);
  const onAddEntrada =(d)=>addDoc(collection(db,"entradas"),d);
  const onDelGasto   =(id)=>deleteDoc(doc(db,"gastos",  id));
  const onDelEntrada =(id)=>deleteDoc(doc(db,"entradas",id));
  const props={gastos,entradas,carregando,onAddGasto,onAddEntrada,onDelGasto,onDelEntrada};

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;}
        body{background:#080808;color:#f2f2f2;}
        input,select,button{outline:none;font-family:inherit;}
        .inp{background:#181818;border:1px solid #252525;border-radius:10px;padding:10px 14px;color:#f2f2f2;font-size:15px;width:100%;transition:border .2s;font-family:'DM Mono',monospace;}
        .inp:focus{border-color:#f59e0b;}
        .inp::placeholder{color:#404040;}
        .row-t:hover .del{opacity:1!important;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#0d0d0d;}
        ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px;}
        option{background:#181818;color:#f2f2f2;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5);}
      `}</style>
      {isMobile?<MobileApp {...props}/>:<DesktopApp {...props}/>}
    </>
  );
}