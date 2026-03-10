import { useState, useMemo, useEffect, useRef } from "react";
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
  bg:"#080808",surface:"#101010",surface2:"#141414",border:"#1f1f1f",border2:"#282828",
  text:"#f2f2f2",muted:"#606060",muted2:"#383838",
  amber:"#f59e0b",amberLo:"#f59e0b1a",amberMid:"#f59e0b44",
  warn:"#fb923c",danger:"#ef4444",white:"#ffffff",
};
const CATS_GASTO   = [{nome:"Alimentação",emoji:"🍽️"},{nome:"Transporte",emoji:"🚌"},{nome:"Lazer",emoji:"🎮"},{nome:"Saúde",emoji:"💊"},{nome:"Moradia",emoji:"🏠"},{nome:"Educação",emoji:"📚"},{nome:"Outros",emoji:"📦"}];
const CATS_ENTRADA = [{nome:"Salário",emoji:"💼"},{nome:"Freelance",emoji:"💻"},{nome:"Investimento",emoji:"📈"},{nome:"Presente",emoji:"🎁"},{nome:"Outros",emoji:"📦"}];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MS    = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const fBRL   = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fShort = v => v>=1000?`R$${(v/1000).toFixed(1)}k`:`R$${v.toFixed(0)}`;
const toDate = s => new Date(s+"T12:00:00");
const today  = () => new Date().toISOString().split("T")[0];

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
function Card({children,style={},amber=false}){
  return <div style={{background:C.surface,border:`1px solid ${amber?C.amber+"33":C.border}`,borderRadius:16,...style}}>{children}</div>;
}
function Lbl({children}){
  return <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{children}</p>;
}

// ── BarChart ──────────────────────────────────────────────
function BarChart({gastos}){
  const totais=CATS_GASTO.map(c=>({...c,total:gastos.filter(g=>g.categoria===c.nome).reduce((s,g)=>s+g.valor,0)})).filter(t=>t.total>0).sort((a,b)=>b.total-a.total);
  const max=Math.max(...totais.map(t=>t.total),1);
  if(!totais.length) return <p style={{color:C.muted,textAlign:"center",fontSize:13,padding:"20px 0"}}>Nenhum gasto registrado</p>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {totais.map(t=>(
        <div key={t.nome} style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:20,textAlign:"center",fontSize:13}}>{t.emoji}</span>
          <span style={{width:82,fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.nome}</span>
          <div style={{flex:1,background:C.border,borderRadius:4,height:14,overflow:"hidden"}}>
            <div style={{width:`${(t.total/max)*100}%`,background:`linear-gradient(90deg,${C.amberMid},${C.amber})`,height:"100%",borderRadius:4,transition:"width .7s cubic-bezier(.4,0,.2,1)"}}/>
          </div>
          <span style={{width:76,fontSize:11,color:C.amber,textAlign:"right",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{fBRL(t.total)}</span>
        </div>
      ))}
    </div>
  );
}

// ── AnualChart ────────────────────────────────────────────
function AnualChart({gastos,entradas,ano}){
  const mc=new Date().getMonth(), ay=new Date().getFullYear();
  const dados=MS.map((m,i)=>({
    m,i,
    renda:entradas.filter(e=>{const d=toDate(e.data);return d.getMonth()===i&&d.getFullYear()===ano;}).reduce((s,e)=>s+e.valor,0),
    gasto:gastos.filter(g=>{const d=toDate(g.data);return d.getMonth()===i&&d.getFullYear()===ano;}).reduce((s,g)=>s+g.valor,0),
  }));
  const max=Math.max(...dados.map(d=>Math.max(d.renda,d.gasto)),1);
  return(
    <div>
      <div style={{display:"flex",gap:14,marginBottom:12}}>
        {[{cor:C.amber,label:"entradas"},{cor:"#555",label:"gastos"}].map(l=>(
          <div key={l.label} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:9,height:9,background:l.cor,borderRadius:2}}/><span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{l.label}</span></div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:3,height:90}}>
        {dados.map(d=>{
          const hR=Math.max((d.renda/max)*72,d.renda>0?3:0);
          const hG=Math.max((d.gasto/max)*72,d.gasto>0?3:0);
          const cur=d.i===mc&&ano===ay;
          return(
            <div key={d.m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{width:"100%",height:72,display:"flex",alignItems:"flex-end",gap:1}}>
                <div style={{flex:1,height:hR,background:cur?C.amber:C.amberMid,borderRadius:"3px 3px 1px 1px",transition:"height .6s"}}/>
                <div style={{flex:1,height:hG,background:cur?"#666":C.muted2,borderRadius:"3px 3px 1px 1px",transition:"height .6s"}}/>
              </div>
              <span style={{fontSize:9,color:cur?C.white:C.muted2,fontFamily:"'DM Mono',monospace",fontWeight:cur?700:400}}>{d.m}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LineChart (evolução dia a dia) ────────────────────────
function LineChart({gastos,entradas,dataIni,dataFim}){
  const ref=useRef(null);
  const ini=new Date(dataIni+"T00:00:00"), fim=new Date(dataFim+"T23:59:59");
  const dias=[];
  for(let d=new Date(ini);d<=fim;d.setDate(d.getDate()+1)) dias.push(d.toISOString().split("T")[0]);
  if(dias.length===0) return null;

  let acGasto=0,acEntrada=0;
  const pts=dias.map(dia=>{
    acGasto  +=gastos.filter(g=>g.data===dia).reduce((s,g)=>s+g.valor,0);
    acEntrada+=entradas.filter(e=>e.data===dia).reduce((s,e)=>s+e.valor,0);
    return{dia,acGasto,acEntrada};
  });

  const maxVal=Math.max(...pts.map(p=>Math.max(p.acGasto,p.acEntrada)),1);
  const W=600,H=120,pad=8;

  const pathG=pts.map((p,i)=>{
    const x=pad+(i/(pts.length-1||1))*(W-pad*2);
    const y=H-pad-(p.acGasto/maxVal)*(H-pad*2);
    return `${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const pathE=pts.map((p,i)=>{
    const x=pad+(i/(pts.length-1||1))*(W-pad*2);
    const y=H-pad-(p.acEntrada/maxVal)*(H-pad*2);
    return `${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return(
    <div ref={ref} style={{width:"100%",overflowX:"auto"}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,display:"block"}}>
        <path d={pathE} fill="none" stroke={C.amber} strokeWidth="2" strokeLinejoin="round"/>
        <path d={pathG} fill="none" stroke="#666" strokeWidth="2" strokeLinejoin="round"/>
        {pts.length<=31&&pts.map((p,i)=>{
          const x=pad+(i/(pts.length-1||1))*(W-pad*2);
          const yG=H-pad-(p.acGasto/maxVal)*(H-pad*2);
          const yE=H-pad-(p.acEntrada/maxVal)*(H-pad*2);
          return(
            <g key={p.dia}>
              <circle cx={x} cy={yG} r="3" fill="#666"/>
              <circle cx={x} cy={yE} r="3" fill={C.amber}/>
            </g>
          );
        })}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <span style={{fontSize:9,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>{dataIni}</span>
        <span style={{fontSize:9,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>{dataFim}</span>
      </div>
    </div>
  );
}

// ── PainelSaude ───────────────────────────────────────────
function PainelSaude({pct,saldo,gastosMes,renda}){
  const s=getSaude(pct,saldo);
  const top=CATS_GASTO.map(c=>({...c,total:gastosMes.filter(g=>g.categoria===c.nome).reduce((a,g)=>a+g.valor,0)})).sort((a,b)=>b.total-a.total).filter(c=>c.total>0).slice(0,3);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{padding:"16px 18px",background:s.cor+"14",border:`1px solid ${s.cor}44`,borderRadius:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:s.cor+"22",border:`2px solid ${s.cor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{s.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>saúde financeira</p>
            <p style={{fontSize:18,fontWeight:700,color:s.cor,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{s.label}</p>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:2}}>comprometido</p>
            <p style={{fontSize:15,fontWeight:700,color:s.cor,fontFamily:"'DM Mono',monospace"}}>{pct.toFixed(1)}%</p>
          </div>
        </div>
        <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",lineHeight:1.5,borderLeft:`3px solid ${s.cor}44`,paddingLeft:10}}>{s.msg}</p>
      </div>
      <Card style={{padding:"14px 18px"}}>
        <Lbl>comprometimento</Lbl>
        <div style={{background:C.border,borderRadius:99,height:8,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",left:"60%",top:0,bottom:0,width:1,background:C.border2}}/>
          <div style={{position:"absolute",left:"80%",top:0,bottom:0,width:1,background:C.border2}}/>
          <div style={{width:`${Math.min(pct,100)}%`,background:`linear-gradient(90deg,${C.amber},${s.cor})`,height:"100%",transition:"width .6s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
          {["livre","60%","80%","crítico"].map(l=><span key={l} style={{fontSize:9,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>{l}</span>)}
        </div>
      </Card>
      {top.length>0&&(
        <Card style={{padding:"14px 18px"}}>
          <Lbl>maiores gastos</Lbl>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {top.map((c,i)=>(
              <div key={c.nome} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",width:16}}>#{i+1}</span>
                <span style={{fontSize:15}}>{c.emoji}</span>
                <span style={{flex:1,fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nome}</span>
                <span style={{fontSize:12,color:C.amber,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{fBRL(c.total)}</span>
                {renda>0&&<span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",width:30,textAlign:"right"}}>{((c.total/renda)*100).toFixed(0)}%</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card style={{padding:"14px 18px"}}>
        <Lbl>regra 50 · 30 · 20</Lbl>
        <div style={{display:"flex",gap:6}}>
          {[{label:"Essencial",pct:50},{label:"Lazer",pct:30},{label:"Reserva",pct:20}].map(r=>(
            <div key={r.label} style={{flex:1,background:C.border,borderRadius:9,padding:"9px 0",textAlign:"center"}}>
              <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:4}}>{r.label}</p>
              <p style={{fontSize:16,color:C.amber,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{r.pct}%</p>
              <p style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginTop:3}}>{fBRL(renda*r.pct/100)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PAINEL PERÍODO
// ══════════════════════════════════════════════════════════
function PainelPeriodo({gastos,entradas,onClose}){
  const hoje=today();
  const primeiroDiaMes=hoje.slice(0,8)+"01";
  const [dataIni,setDataIni]=useState(primeiroDiaMes);
  const [dataFim,setDataFim]=useState(hoje);
  const [abaP,setAbaP]=useState("periodo");

  // Período selecionado
  const gP=useMemo(()=>gastos.filter(g=>g.data>=dataIni&&g.data<=dataFim),[gastos,dataIni,dataFim]);
  const eP=useMemo(()=>entradas.filter(e=>e.data>=dataIni&&e.data<=dataFim),[entradas,dataIni,dataFim]);
  const totalGP=gP.reduce((s,g)=>s+g.valor,0);
  const totalEP=eP.reduce((s,e)=>s+e.valor,0);
  const saldoP=totalEP-totalGP;
  const pctP=totalEP>0?(totalGP/totalEP)*100:0;
  const saudeP=getSaude(pctP,saldoP);

  // Período anterior (mesma duração)
  const durMs=new Date(dataFim+"T00:00:00")-new Date(dataIni+"T00:00:00");
  const antFim=new Date(new Date(dataIni+"T00:00:00")-1).toISOString().split("T")[0];
  const antIni=new Date(new Date(dataIni+"T00:00:00")-durMs-86400000).toISOString().split("T")[0];
  const gAnt=gastos.filter(g=>g.data>=antIni&&g.data<=antFim);
  const eAnt=entradas.filter(e=>e.data>=antIni&&e.data<=antFim);
  const totalGAnt=gAnt.reduce((s,g)=>s+g.valor,0);
  const totalEAnt=eAnt.reduce((s,e)=>s+e.valor,0);
  const saldoAnt=totalEAnt-totalGAnt;
  const diffG=totalGAnt>0?((totalGP-totalGAnt)/totalGAnt*100):null;
  const diffE=totalEAnt>0?((totalEP-totalEAnt)/totalEAnt*100):null;
  const diffS=saldoAnt!==0?((saldoP-saldoAnt)/Math.abs(saldoAnt)*100):null;

  // Levantamento anual/semestral
  const anoAtual=new Date().getFullYear();
  const [periodoLev,setPeriodoLev]=useState("anual");
  const mesesLev=periodoLev==="anual"?12:6;
  const mesInicio=periodoLev==="semestral"?new Date().getMonth()-5:0;
  const dadosMeses=Array.from({length:mesesLev},(_,i)=>{
    const idx=(mesInicio+i+12)%12;
    const ano=mesInicio+i<0?anoAtual-1:anoAtual;
    const renda=entradas.filter(e=>{const d=toDate(e.data);return d.getMonth()===idx&&d.getFullYear()===ano;}).reduce((s,e)=>s+e.valor,0);
    const gasto=gastos.filter(g=>{const d=toDate(g.data);return d.getMonth()===idx&&d.getFullYear()===ano;}).reduce((s,g)=>s+g.valor,0);
    const saldo=renda-gasto;
    const pct=renda>0?(gasto/renda)*100:0;
    return{mes:MS[idx],idx,ano,renda,gasto,saldo,pct};
  });
  const maxLev=Math.max(...dadosMeses.map(d=>Math.max(d.renda,d.gasto)),1);
  const totalRendaLev=dadosMeses.reduce((s,d)=>s+d.renda,0);
  const totalGastoLev=dadosMeses.reduce((s,d)=>s+d.gasto,0);
  const totalSaldoLev=totalRendaLev-totalGastoLev;

  const atalhos=[
    {label:"Este mês",  ini:primeiroDiaMes, fim:hoje},
    {label:"7 dias",    ini:new Date(Date.now()-6*86400000).toISOString().split("T")[0], fim:hoje},
    {label:"30 dias",   ini:new Date(Date.now()-29*86400000).toISOString().split("T")[0], fim:hoje},
    {label:"90 dias",   ini:new Date(Date.now()-89*86400000).toISOString().split("T")[0], fim:hoje},
    {label:"Este ano",  ini:`${anoAtual}-01-01`, fim:hoje},
  ];

  const DiffBadge=({val})=>{
    if(val===null) return <span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>—</span>;
    const pos=val>=0;
    return <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:pos?C.amber:C.danger,background:pos?C.amberLo:C.danger+"18",padding:"1px 7px",borderRadius:20}}>{pos?"+":""}{val.toFixed(1)}%</span>;
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"stretch",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{width:"min(900px,92vw)",background:C.bg,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>

        {/* Header painel */}
        <div style={{padding:"20px 28px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,background:C.surface}}>
          <div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,lineHeight:1}}>Análise <span style={{color:C.amber}}>Avançada</span></h2>
            <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:4}}>filtro por período · levantamento anual/semestral</p>
          </div>
          <button onClick={onClose} style={{background:C.border,border:"none",color:C.muted,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:18,lineHeight:1}}>✕</button>
        </div>

        {/* Abas */}
        <div style={{display:"flex",gap:3,padding:"16px 28px 0",background:C.surface,flexShrink:0}}>
          {[{id:"periodo",label:"📅 Por Período"},{id:"levantamento",label:"📊 Levantamento"}].map(a=>(
            <button key={a.id} onClick={()=>setAbaP(a.id)} style={{padding:"9px 20px",borderRadius:"10px 10px 0 0",border:`1px solid ${C.border}`,borderBottom:"none",cursor:"pointer",fontSize:13,fontFamily:"'DM Mono',monospace",fontWeight:600,transition:"all .2s",background:abaP===a.id?C.bg:C.surface2,color:abaP===a.id?C.white:C.muted}}>{a.label}</button>
          ))}
        </div>

        <div style={{flex:1,padding:"24px 28px",display:"flex",flexDirection:"column",gap:20}}>

          {/* ── ABA PERÍODO ── */}
          {abaP==="periodo"&&(
            <>
              {/* Filtro datas */}
              <Card style={{padding:"18px 22px"}}>
                <div style={{display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div>
                    <label style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>data inicial</label>
                    <input className="inp" type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)} style={{width:160}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>data final</label>
                    <input className="inp" type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} style={{width:160}}/>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {atalhos.map(a=>(
                      <button key={a.label} onClick={()=>{setDataIni(a.ini);setDataFim(a.fim);}} style={{padding:"8px 14px",borderRadius:9,border:`1px solid ${C.border2}`,background:dataIni===a.ini&&dataFim===a.fim?C.amberLo:"transparent",color:dataIni===a.ini&&dataFim===a.fim?C.amber:C.muted,fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all .15s",whiteSpace:"nowrap"}}>{a.label}</button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* KPIs período */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                {[
                  {label:"Entradas",valor:totalEP,ant:totalEAnt,diff:diffE,cor:C.amber},
                  {label:"Gastos",  valor:totalGP,ant:totalGAnt,diff:diffG,cor:C.white,inv:true},
                  {label:"Saldo",   valor:saldoP, ant:saldoAnt, diff:diffS,cor:saldoP>=0?C.amber:C.danger},
                ].map(item=>(
                  <Card key={item.label} style={{padding:"18px 20px"}}>
                    <Lbl>{item.label}</Lbl>
                    <p style={{fontSize:22,fontWeight:700,color:item.cor,fontFamily:"'DM Mono',monospace",marginBottom:8,lineHeight:1}}>{fBRL(item.valor)}</p>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>vs anterior: {fBRL(item.ant)}</span>
                      <DiffBadge val={item.inv?item.diff!==null?-item.diff:null:item.diff}/>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Status período */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <Card style={{padding:"18px 20px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:saudeP.cor+"22",border:`2px solid ${saudeP.cor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{saudeP.icon}</div>
                    <div>
                      <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>saúde do período</p>
                      <p style={{fontSize:18,fontWeight:700,color:saudeP.cor,fontFamily:"'Playfair Display',serif",lineHeight:1.1}}>{saudeP.label}</p>
                    </div>
                    <div style={{marginLeft:"auto",textAlign:"right"}}>
                      <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>comprometido</p>
                      <p style={{fontSize:16,fontWeight:700,color:saudeP.cor,fontFamily:"'DM Mono',monospace"}}>{pctP.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div style={{background:C.border,borderRadius:99,height:8,overflow:"hidden",position:"relative"}}>
                    <div style={{position:"absolute",left:"60%",top:0,bottom:0,width:1,background:C.border2}}/>
                    <div style={{position:"absolute",left:"80%",top:0,bottom:0,width:1,background:C.border2}}/>
                    <div style={{width:`${Math.min(pctP,100)}%`,background:`linear-gradient(90deg,${C.amber},${saudeP.cor})`,height:"100%",transition:"width .6s"}}/>
                  </div>
                  <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:8,lineHeight:1.5}}>{saudeP.msg}</p>
                </Card>

                {/* Categorias período */}
                <Card style={{padding:"18px 20px"}}>
                  <Lbl>gastos por categoria</Lbl>
                  <BarChart gastos={gP}/>
                </Card>
              </div>

              {/* Gráfico evolução */}
              <Card style={{padding:"18px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <Lbl>evolução acumulada</Lbl>
                  <div style={{display:"flex",gap:12}}>
                    {[{cor:C.amber,label:"entradas acum."},{cor:"#666",label:"gastos acum."}].map(l=>(
                      <div key={l.label} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:2,background:l.cor,borderRadius:1}}/><span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{l.label}</span></div>
                    ))}
                  </div>
                </div>
                <LineChart gastos={gastos} entradas={entradas} dataIni={dataIni} dataFim={dataFim}/>
              </Card>

              {/* Comparativo período anterior */}
              <Card style={{padding:"18px 22px"}}>
                <Lbl>comparativo com período anterior ({antIni} → {antFim})</Lbl>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    {label:"Gastos",    atual:totalGP,  ant:totalGAnt},
                    {label:"Entradas",  atual:totalEP,  ant:totalEAnt},
                    {label:"Saldo",     atual:saldoP,   ant:saldoAnt},
                    {label:"Lançamentos", atual:gP.length, ant:gAnt.length, isCount:true},
                  ].map(item=>(
                    <div key={item.label} style={{background:C.border,borderRadius:10,padding:"12px 14px"}}>
                      <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{item.label}</p>
                      <div style={{display:"flex",gap:16,alignItems:"flex-end"}}>
                        <div>
                          <p style={{fontSize:9,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:2}}>atual</p>
                          <p style={{fontSize:16,fontWeight:700,color:C.white,fontFamily:"'DM Mono',monospace"}}>{item.isCount?item.atual:fBRL(item.atual)}</p>
                        </div>
                        <div style={{color:C.muted2,fontSize:14,marginBottom:2}}>→</div>
                        <div>
                          <p style={{fontSize:9,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:2}}>anterior</p>
                          <p style={{fontSize:14,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{item.isCount?item.ant:fBRL(item.ant)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* ── ABA LEVANTAMENTO ── */}
          {abaP==="levantamento"&&(
            <>
              {/* Toggle anual/semestral */}
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{display:"flex",gap:3,background:C.border,borderRadius:10,padding:3}}>
                  {[{id:"anual",label:"Anual (12 meses)"},{id:"semestral",label:"Semestral (6 meses)"}].map(t=>(
                    <button key={t.id} onClick={()=>setPeriodoLev(t.id)} style={{padding:"7px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontFamily:"'DM Mono',monospace",fontWeight:600,transition:"all .2s",background:periodoLev===t.id?C.amber:"transparent",color:periodoLev===t.id?C.bg:C.muted}}>{t.label}</button>
                  ))}
                </div>
                <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{periodoLev==="anual"?`Janeiro – Dezembro ${anoAtual}`:`Últimos 6 meses`}</span>
              </div>

              {/* KPIs totais levantamento */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {[
                  {label:"Total entradas", valor:totalRendaLev, cor:C.amber},
                  {label:"Total gastos",   valor:totalGastoLev, cor:C.white},
                  {label:"Saldo período",  valor:totalSaldoLev, cor:totalSaldoLev>=0?C.amber:C.danger},
                  {label:"Média mensal",   valor:totalGastoLev/mesesLev, cor:C.muted},
                ].map(item=>(
                  <Card key={item.label} style={{padding:"14px 16px"}}>
                    <Lbl>{item.label}</Lbl>
                    <p style={{fontSize:18,fontWeight:700,color:item.cor,fontFamily:"'DM Mono',monospace",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fBRL(item.valor)}</p>
                  </Card>
                ))}
              </div>

              {/* Gráfico + Tabela lado a lado */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

                {/* Gráfico barras agrupadas */}
                <Card style={{padding:"18px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <p style={{fontFamily:"'Playfair Display',serif",fontSize:16}}>Evolução mensal</p>
                    <div style={{display:"flex",gap:10}}>
                      {[{cor:C.amber,label:"entradas"},{cor:"#555",label:"gastos"}].map(l=>(
                        <div key={l.label} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,background:l.cor,borderRadius:2}}/><span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{l.label}</span></div>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:4,height:140}}>
                    {dadosMeses.map((d,i)=>{
                      const hR=Math.max((d.renda/maxLev)*112,d.renda>0?3:0);
                      const hG=Math.max((d.gasto/maxLev)*112,d.gasto>0?3:0);
                      const cur=d.idx===new Date().getMonth()&&d.ano===anoAtual;
                      return(
                        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}} title={`${d.mes}: entradas ${fBRL(d.renda)}, gastos ${fBRL(d.gasto)}`}>
                          <div style={{width:"100%",height:112,display:"flex",alignItems:"flex-end",gap:1}}>
                            <div style={{flex:1,height:hR,background:cur?C.amber:C.amberMid,borderRadius:"3px 3px 1px 1px",transition:"height .6s"}}/>
                            <div style={{flex:1,height:hG,background:cur?"#777":C.muted2,borderRadius:"3px 3px 1px 1px",transition:"height .6s"}}/>
                          </div>
                          <span style={{fontSize:9,color:cur?C.white:C.muted2,fontFamily:"'DM Mono',monospace",fontWeight:cur?700:400}}>{d.mes}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Tabela meses */}
                <Card style={{padding:"18px 20px",display:"flex",flexDirection:"column"}}>
                  <p style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:14}}>Tabela mensal</p>
                  <div style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr 1fr 50px",gap:6,padding:"0 0 8px",borderBottom:`1px solid ${C.border}`}}>
                    {["Mês","Entradas","Gastos","Saldo","%"].map((h,i)=>(
                      <span key={i} style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</span>
                    ))}
                  </div>
                  <div style={{flex:1,overflowY:"auto"}}>
                    {dadosMeses.map((d,i)=>{
                      const cur=d.idx===new Date().getMonth()&&d.ano===anoAtual;
                      const corS=d.saldo>=0?C.amber:C.danger;
                      const corP=d.pct>85?C.danger:d.pct>60?C.warn:C.amber;
                      return(
                        <div key={i} style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr 1fr 50px",gap:6,padding:"9px 0",borderBottom:`1px solid ${C.border}18`,background:cur?C.amber+"08":"transparent",borderRadius:cur?6:0}}>
                          <span style={{fontSize:12,color:cur?C.amber:C.muted,fontFamily:"'DM Mono',monospace",fontWeight:cur?700:400}}>{d.mes}</span>
                          <span style={{fontSize:12,color:C.amber,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.renda>0?fShort(d.renda):"—"}</span>
                          <span style={{fontSize:12,color:C.white,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.gasto>0?fShort(d.gasto):"—"}</span>
                          <span style={{fontSize:12,color:corS,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.renda>0||d.gasto>0?fShort(d.saldo):"—"}</span>
                          <span style={{fontSize:11,color:corP,fontFamily:"'DM Mono',monospace"}}>{d.pct>0?`${d.pct.toFixed(0)}%`:"—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Categorias acumuladas no período */}
              <Card style={{padding:"18px 22px"}}>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:16}}>Gastos por categoria — {periodoLev==="anual"?"ano todo":"últimos 6 meses"}</p>
                <BarChart gastos={gastos.filter(g=>{const d=toDate(g.data);return d.getFullYear()===anoAtual&&(periodoLev==="anual"||d.getMonth()>=(new Date().getMonth()-5+12)%12);})}/>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MODAL MOBILE
// ══════════════════════════════════════════════════════════
function Modal({tipo,onClose,onSave}){
  const cats=tipo==="gasto"?CATS_GASTO:CATS_ENTRADA;
  const [form,setForm]=useState({descricao:tipo==="gasto"?"":cats[0].nome,valor:"",categoria:cats[0].nome,data:today()});
  const salvar=()=>{
    if(!form.valor||isNaN(parseFloat(form.valor)))return;
    if(tipo==="gasto"&&!form.descricao)return;
    onSave({...form,valor:parseFloat(form.valor)});
  };
  return(
    <div style={{position:"fixed",inset:0,background:"#000000e0",zIndex:100,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.border2}`,borderRadius:"22px 22px 0 0",padding:24,width:"100%",display:"flex",flexDirection:"column",gap:14}} onClick={e=>e.stopPropagation()}>
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
  const [showPeriodo,setShowPeriodo]=useState(false);

  const gastosMes  =useMemo(()=>gastos.filter(g=>{const d=toDate(g.data);return d.getMonth()===mes&&d.getFullYear()===ano;}),[gastos,mes,ano]);
  const entradasMes=useMemo(()=>entradas.filter(e=>{const d=toDate(e.data);return d.getMonth()===mes&&d.getFullYear()===ano;}),[entradas,mes,ano]);
  const totalG=gastosMes.reduce((s,g)=>s+g.valor,0);
  const totalE=entradasMes.reduce((s,e)=>s+e.valor,0);
  const saldo=totalE-totalG;
  const pct=totalE>0?Math.min((totalG/totalE)*100,100):0;
  const saude=getSaude(totalE>0?(totalG/totalE)*100:0,saldo);
  const corB=pct>85?C.danger:pct>60?C.warn:C.amber;
  const mudar=(d)=>{let m=mes+d,a=ano;if(m<0){m=11;a--;}if(m>11){m=0;a++;}setMes(m);setAno(a);};

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,paddingBottom:90,fontFamily:"'Georgia',serif"}}>
      <div style={{padding:"20px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,lineHeight:1}}>Finanças <span style={{color:C.amber}}>Pessoais</span></h1>
          <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:3}}>{MESES[mes]} {ano}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setShowPeriodo(true)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.amber,borderRadius:9,padding:"7px 12px",cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>📊 Análise</button>
          <div style={{width:7,height:7,borderRadius:"50%",background:carregando?C.warn:C.amber,boxShadow:`0 0 8px ${carregando?C.warn:C.amber}`}}/>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px 0"}}>
        <button onClick={()=>mudar(-1)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:17,lineHeight:1}}>←</button>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600}}>{MESES[mes]}</span>
        <button onClick={()=>mudar(1)} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.muted,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:17,lineHeight:1}}>→</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,padding:"12px 18px 0"}}>
        {[{label:"Entradas",valor:totalE,cor:C.amber},{label:"Gastos",valor:totalG,cor:C.white},{label:"Saldo",valor:saldo,cor:saldo>=0?C.amber:C.danger}].map(item=>(
          <div key={item.label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:"12px 10px"}}>
            <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.08em"}}>{item.label}</p>
            <p style={{fontSize:13,fontWeight:700,color:item.cor,fontFamily:"'DM Mono',monospace",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fBRL(item.valor)}</p>
          </div>
        ))}
      </div>
      <div style={{margin:"10px 18px 0",background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:"13px 15px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:saude.cor,boxShadow:`0 0 6px ${saude.cor}`}}/>
            <span style={{fontSize:12,color:saude.cor,fontFamily:"'DM Mono',monospace",fontWeight:600}}>{saude.label}</span>
          </div>
          <span style={{fontSize:12,color:corB,fontFamily:"'DM Mono',monospace"}}>{pct.toFixed(1)}%</span>
        </div>
        <div style={{background:C.border,borderRadius:99,height:6}}>
          <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${C.amberMid},${corB})`,height:"100%",borderRadius:99,transition:"width .6s"}}/>
        </div>
        <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:6}}>{saude.msg}</p>
      </div>
      <div style={{display:"flex",margin:"13px 18px 0",background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:3,gap:3}}>
        {[{id:"resumo",label:"Resumo"},{id:"gastos",label:"Gastos"},{id:"entradas",label:"Entradas"},{id:"cats",label:"Categ."}].map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)} style={{flex:1,padding:"8px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace",transition:"all .2s",background:aba===a.id?C.border2:"transparent",color:aba===a.id?C.white:C.muted}}>{a.label}</button>
        ))}
      </div>
      <div style={{margin:"10px 18px 0",background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:15}}>
        {aba==="cats"&&<BarChart gastos={gastosMes}/>}
        {aba==="resumo"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>regra 50 · 30 · 20</p>
              <div style={{display:"flex",gap:7}}>
                {[{label:"Essencial",pct:50},{label:"Lazer",pct:30},{label:"Reserva",pct:20}].map(r=>(
                  <div key={r.label} style={{flex:1,background:C.border,borderRadius:10,padding:"10px 0",textAlign:"center"}}>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:4}}>{r.label}</p>
                    <p style={{fontSize:15,color:C.amber,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{r.pct}%</p>
                    <p style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginTop:3}}>{fBRL(totalE*r.pct/100)}</p>
                  </div>
                ))}
              </div>
            </div>
            <AnualChart gastos={gastos} entradas={entradas} ano={new Date().getFullYear()}/>
          </div>
        )}
        {aba==="gastos"&&(
          <>
            {!carregando&&gastosMes.length===0&&<p style={{color:C.muted,fontSize:13,textAlign:"center",padding:"16px 0"}}>Nenhum gasto este mês</p>}
            {[...gastosMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(g=>{
              const cat=CATS_GASTO.find(c=>c.nome===g.categoria)||CATS_GASTO[6];
              return(
                <div key={g.id} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{width:34,height:34,borderRadius:9,background:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{cat.emoji}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.descricao}</p>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:2}}>{toDate(g.data).toLocaleDateString("pt-BR")} · {g.categoria}</p>
                  </div>
                  <p style={{fontSize:13,color:C.white,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{fBRL(g.valor)}</p>
                  <button onClick={()=>onDelGasto(g.id)} style={{background:"transparent",border:"none",color:C.muted2,fontSize:20,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
                </div>
              );
            })}
          </>
        )}
        {aba==="entradas"&&(
          <>
            {!carregando&&entradasMes.length===0&&<p style={{color:C.muted,fontSize:13,textAlign:"center",padding:"16px 0"}}>Nenhuma entrada este mês</p>}
            {[...entradasMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(e=>{
              const cat=CATS_ENTRADA.find(c=>c.nome===e.categoria)||CATS_ENTRADA[4];
              return(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{width:34,height:34,borderRadius:9,background:C.amberLo,border:`1px solid ${C.amber}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{cat.emoji}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.descricao}</p>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:2}}>{toDate(e.data).toLocaleDateString("pt-BR")} · {e.categoria}</p>
                  </div>
                  <p style={{fontSize:13,color:C.amber,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{fBRL(e.valor)}</p>
                  <button onClick={()=>onDelEntrada(e.id)} style={{background:"transparent",border:"none",color:C.muted2,fontSize:20,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
                </div>
              );
            })}
          </>
        )}
      </div>
      <div style={{position:"fixed",bottom:96,right:18,display:"flex",flexDirection:"column",alignItems:"center",gap:7,zIndex:50}}>
        <span style={{fontSize:9,color:C.muted,fontFamily:"'DM Mono',monospace"}}>entrada</span>
        <button onClick={()=>setModal("entrada")} style={{width:50,height:50,borderRadius:"50%",background:C.amber,border:"none",color:C.bg,fontSize:22,cursor:"pointer",boxShadow:`0 4px 20px ${C.amber}55`,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>+</button>
        <button onClick={()=>setModal("gasto")} style={{width:50,height:50,borderRadius:"50%",background:C.white,border:"none",color:C.bg,fontSize:22,cursor:"pointer",boxShadow:"0 4px 20px #ffffff22",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>−</button>
        <span style={{fontSize:9,color:C.muted,fontFamily:"'DM Mono',monospace"}}>gasto</span>
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",padding:"9px 0 16px",zIndex:40}}>
        {[{emoji:"📊",label:"Resumo"},{emoji:"💸",label:"Gastos"},{emoji:"💰",label:"Entradas"},{emoji:"📈",label:"Gráficos"}].map((item,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:19}}>{item.emoji}</span>
            <span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{item.label}</span>
          </div>
        ))}
      </div>
      {modal&&<Modal tipo={modal} onClose={()=>setModal(null)} onSave={async(d)=>{if(modal==="gasto")await onAddGasto(d);else await onAddEntrada(d);setModal(null);}}/>}
      {showPeriodo&&<PainelPeriodo gastos={gastos} entradas={entradas} onClose={()=>setShowPeriodo(false)}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DESKTOP
// ══════════════════════════════════════════════════════════
const lbl={fontSize:11,color:"#505050",fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:7};

function DesktopApp({gastos,entradas,carregando,onAddGasto,onAddEntrada,onDelGasto,onDelEntrada}){
  const hoje=new Date();
  const [mes,setMes]=useState(hoje.getMonth());
  const [ano,setAno]=useState(hoje.getFullYear());
  const [abaForm,setAbaForm]=useState("gasto");
  const [showForm,setShowForm]=useState(false);
  const [showPeriodo,setShowPeriodo]=useState(false);
  const [formG,setFormG]=useState({descricao:"",valor:"",categoria:"Alimentação",data:today()});
  const [formE,setFormE]=useState({descricao:"Salário",valor:"",categoria:"Salário",data:today()});

  const gastosMes  =useMemo(()=>gastos.filter(g=>{const d=toDate(g.data);return d.getMonth()===mes&&d.getFullYear()===ano;}),[gastos,mes,ano]);
  const entradasMes=useMemo(()=>entradas.filter(e=>{const d=toDate(e.data);return d.getMonth()===mes&&d.getFullYear()===ano;}),[entradas,mes,ano]);
  const totalG=gastosMes.reduce((s,g)=>s+g.valor,0);
  const totalE=entradasMes.reduce((s,e)=>s+e.valor,0);
  const saldo=totalE-totalG;
  const pctReal=totalE>0?(totalG/totalE)*100:0;
  const saude=getSaude(pctReal,saldo);
  const corB=pctReal>85?C.danger:pctReal>60?C.warn:C.amber;
  const mudar=(d)=>{let m=mes+d,a=ano;if(m<0){m=11;a--;}if(m>11){m=0;a++;}setMes(m);setAno(a);};
  const diasMes=gastosMes.length>0?Math.max(...gastosMes.map(g=>toDate(g.data).getDate())):1;
  const mediaDia=diasMes>0?totalG/diasMes:0;

  const salvarGasto=async()=>{
    if(!formG.descricao||!formG.valor||isNaN(parseFloat(formG.valor)))return;
    await onAddGasto({...formG,valor:parseFloat(formG.valor)});
    setFormG({descricao:"",valor:"",categoria:"Alimentação",data:today()});
    setShowForm(false);
  };
  const salvarEntrada=async()=>{
    if(!formE.valor||isNaN(parseFloat(formE.valor)))return;
    await onAddEntrada({...formE,valor:parseFloat(formE.valor)});
    setFormE({descricao:"Salário",valor:"",categoria:"Salário",data:today()});
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
          <button onClick={()=>setShowPeriodo(true)} style={{background:"transparent",border:`1px solid ${C.amber}55`,color:C.amber,fontWeight:600,padding:"7px 16px",borderRadius:9,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Mono',monospace"}}>📊 Análise</button>
          <div style={{width:1,height:20,background:C.border}}/>
          <button onClick={()=>{setAbaForm("gasto");setShowForm(abaForm==="gasto"?!showForm:true);}} style={{background:showForm&&abaForm==="gasto"?C.border2:C.white,color:C.bg,fontWeight:700,padding:"8px 18px",borderRadius:10,border:"none",fontSize:13,cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap"}}>
            {showForm&&abaForm==="gasto"?"✕ Fechar":"− Gasto"}
          </button>
          <button onClick={()=>{setAbaForm("entrada");setShowForm(abaForm==="entrada"?!showForm:true);}} style={{background:showForm&&abaForm==="entrada"?C.border2:C.amber,color:C.bg,fontWeight:700,padding:"8px 18px",borderRadius:10,border:"none",fontSize:13,cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap"}}>
            {showForm&&abaForm==="entrada"?"✕ Fechar":"+ Entrada"}
          </button>
        </div>
      </div>

      <div style={{flex:1,padding:"18px 24px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto",minHeight:0}}>

        {/* Formulário */}
        {showForm&&(
          <Card amber style={{padding:20}}>
            <div style={{display:"flex",gap:3,marginBottom:16,width:"fit-content",background:C.border,borderRadius:10,padding:3}}>
              {[{id:"gasto",label:"− Gasto"},{id:"entrada",label:"+ Entrada"}].map(t=>(
                <button key={t.id} onClick={()=>setAbaForm(t.id)} style={{padding:"6px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontFamily:"'DM Mono',monospace",fontWeight:600,transition:"all .2s",background:abaForm===t.id?(t.id==="entrada"?C.amber:C.white):"transparent",color:abaForm===t.id?C.bg:C.muted}}>{t.label}</button>
              ))}
            </div>
            {abaForm==="gasto"?(
              <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:2,minWidth:140}}><label style={lbl}>descrição</label><input className="inp" placeholder="Ex: Supermercado" value={formG.descricao} onChange={e=>setFormG({...formG,descricao:e.target.value})} onKeyDown={e=>e.key==="Enter"&&salvarGasto()} autoFocus/></div>
                <div style={{flex:1,minWidth:90}}><label style={lbl}>valor</label><input className="inp" placeholder="0,00" type="number" value={formG.valor} onChange={e=>setFormG({...formG,valor:e.target.value})} onKeyDown={e=>e.key==="Enter"&&salvarGasto()}/></div>
                <div style={{flex:1,minWidth:110}}><label style={lbl}>data</label><input className="inp" type="date" value={formG.data} onChange={e=>setFormG({...formG,data:e.target.value})}/></div>
                <div style={{flex:1,minWidth:130}}><label style={lbl}>categoria</label><select className="inp" value={formG.categoria} onChange={e=>setFormG({...formG,categoria:e.target.value})}>{CATS_GASTO.map(c=><option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}</select></div>
                <button onClick={salvarGasto} style={{background:C.white,color:C.bg,fontWeight:700,padding:"10px 22px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>Salvar ↵</button>
              </div>
            ):(
              <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:2,minWidth:140}}><label style={lbl}>descrição</label><input className="inp" placeholder="Ex: Salário março" value={formE.descricao} onChange={e=>setFormE({...formE,descricao:e.target.value})} onKeyDown={e=>e.key==="Enter"&&salvarEntrada()} autoFocus/></div>
                <div style={{flex:1,minWidth:90}}><label style={lbl}>valor</label><input className="inp" placeholder="0,00" type="number" value={formE.valor} onChange={e=>setFormE({...formE,valor:e.target.value})} onKeyDown={e=>e.key==="Enter"&&salvarEntrada()}/></div>
                <div style={{flex:1,minWidth:110}}><label style={lbl}>data</label><input className="inp" type="date" value={formE.data} onChange={e=>setFormE({...formE,data:e.target.value})}/></div>
                <div style={{flex:1,minWidth:130}}><label style={lbl}>categoria</label><select className="inp" value={formE.categoria} onChange={e=>setFormE({...formE,categoria:e.target.value,descricao:e.target.value})}>{CATS_ENTRADA.map(c=><option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}</select></div>
                <button onClick={salvarEntrada} style={{background:C.amber,color:C.bg,fontWeight:700,padding:"10px 22px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>Salvar ↵</button>
              </div>
            )}
          </Card>
        )}

        {/* Banner saúde */}
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",background:saude.cor+"10",border:`1px solid ${saude.cor}33`,borderRadius:14,width:"100%",boxSizing:"border-box",flexShrink:0}}>
          <div style={{width:42,height:42,borderRadius:"50%",background:saude.cor+"20",border:`2px solid ${saude.cor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{saude.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3,flexWrap:"wrap"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:saude.cor,whiteSpace:"nowrap"}}>Saúde Financeira: {saude.label}</span>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",background:C.border,padding:"2px 9px",borderRadius:20,whiteSpace:"nowrap"}}>{pctReal.toFixed(1)}% comprometido</span>
            </div>
            <p style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{saude.msg}</p>
          </div>
          <div style={{textAlign:"right",flexShrink:0,marginLeft:"auto"}}>
            <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:2}}>saldo do mês</p>
            <p style={{fontSize:22,fontWeight:700,color:saldo>=0?C.amber:C.danger,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{fBRL(saldo)}</p>
          </div>
        </div>

        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,flexShrink:0}}>
          {[
            {label:"Entradas",    valor:totalE,   cor:C.amber,                sub:`${entradasMes.length} registro(s)`},
            {label:"Total gasto", valor:totalG,   cor:C.white,                sub:`${gastosMes.length} lançamento(s)`},
            {label:"Saldo",       valor:saldo,     cor:saldo>=0?C.amber:C.danger, sub:saldo>=0?"positivo ✦":"negativo ⚠"},
            {label:"Maior gasto", valor:gastosMes.length?Math.max(...gastosMes.map(g=>g.valor)):0, cor:C.muted, sub:gastosMes.length?[...gastosMes].sort((a,b)=>b.valor-a.valor)[0]?.descricao||"—":"—"},
            {label:"Média/dia",   valor:mediaDia,  cor:C.muted,               sub:`base: ${diasMes} dia${diasMes>1?"s":""}`},
          ].map(item=>(
            <Card key={item.label} style={{padding:"16px 18px"}}>
              <Lbl>{item.label}</Lbl>
              <p style={{fontSize:18,fontWeight:700,color:item.cor,fontFamily:"'DM Mono',monospace",marginBottom:5,lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fBRL(item.valor)}</p>
              <p style={{fontSize:11,color:C.muted2,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.sub}</p>
            </Card>
          ))}
        </div>

        {/* Barra */}
        <Card style={{padding:"14px 20px",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,color:C.muted,fontFamily:"'DM Mono',monospace"}}>comprometimento da renda · {MESES[mes]}</span>
            <span style={{fontSize:13,color:corB,fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap"}}>{fBRL(totalG)} de {fBRL(totalE)}</span>
          </div>
          <div style={{background:C.border,borderRadius:99,height:9,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",left:"60%",top:0,bottom:0,width:1,background:C.border2}}/>
            <div style={{position:"absolute",left:"80%",top:0,bottom:0,width:1,background:C.border2}}/>
            <div style={{width:`${Math.min(pctReal,100)}%`,background:`linear-gradient(90deg,${C.amberMid},${corB})`,height:"100%",transition:"width .6s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
            {["0% — livre","60% — ótimo","80% — alerta","100% — crítico"].map(l=>(
              <span key={l} style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>{l}</span>
            ))}
          </div>
        </Card>

        {/* Grid 3 colunas */}
        <div style={{display:"grid",gridTemplateColumns:"22% 1fr 22%",gap:16,flex:1,minHeight:0}}>

          {/* Col 1 */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Card style={{padding:"18px 20px"}}>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:17,marginBottom:16}}>Gastos por categoria</p>
              <BarChart gastos={gastosMes}/>
            </Card>
            <Card style={{padding:"18px 20px"}}>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:17,marginBottom:14}}>Visão anual · {ano}</p>
              <AnualChart gastos={gastos} entradas={entradas} ano={ano}/>
            </Card>
          </div>

          {/* Col 2: lançamentos */}
          <Card style={{padding:"18px 20px",display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:17,marginBottom:14,flexShrink:0}}>Lançamentos de {MESES[mes]}</p>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 88px 24px",gap:6,padding:"0 0 8px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              {["Descrição","Categoria","Data","Valor",""].map((h,i)=>(
                <span key={i} style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</span>
              ))}
            </div>
            <div style={{flex:1,overflowY:"auto",marginTop:4}}>
              {carregando&&<p style={{color:C.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Carregando...</p>}
              {[...gastosMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(g=>{
                const cat=CATS_GASTO.find(c=>c.nome===g.categoria)||CATS_GASTO[6];
                return(
                  <div key={g.id} className="row-t" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 88px 24px",gap:6,padding:"10px 0",borderBottom:`1px solid ${C.border}18`,alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}><span style={{fontSize:14,flexShrink:0}}>{cat.emoji}</span><span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.descricao}</span></div>
                    <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,background:C.border2,color:C.muted,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{g.categoria}</span>
                    <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{toDate(g.data).toLocaleDateString("pt-BR")}</span>
                    <span style={{fontSize:13,color:C.white,fontFamily:"'DM Mono',monospace",textAlign:"right",whiteSpace:"nowrap"}}>{fBRL(g.valor)}</span>
                    <button onClick={()=>onDelGasto(g.id)} className="del" style={{opacity:0,background:"transparent",border:"none",color:C.danger,fontSize:16,cursor:"pointer",transition:"opacity .2s"}}>×</button>
                  </div>
                );
              })}
              {entradasMes.length>0&&(
                <>
                  <div style={{padding:"12px 0 6px"}}><span style={{fontSize:10,color:C.amber,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>entradas</span></div>
                  {[...entradasMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(e=>{
                    const cat=CATS_ENTRADA.find(c=>c.nome===e.categoria)||CATS_ENTRADA[4];
                    return(
                      <div key={e.id} className="row-t" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 88px 24px",gap:6,padding:"10px 0",borderBottom:`1px solid ${C.border}18`,alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}><span style={{fontSize:14,flexShrink:0}}>{cat.emoji}</span><span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.descricao}</span></div>
                        <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,background:C.amberLo,color:C.amber,fontFamily:"'DM Mono',monospace",display:"block"}}>{e.categoria}</span>
                        <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{toDate(e.data).toLocaleDateString("pt-BR")}</span>
                        <span style={{fontSize:13,color:C.amber,fontFamily:"'DM Mono',monospace",textAlign:"right",whiteSpace:"nowrap"}}>{fBRL(e.valor)}</span>
                        <button onClick={()=>onDelEntrada(e.id)} className="del" style={{opacity:0,background:"transparent",border:"none",color:C.danger,fontSize:16,cursor:"pointer",transition:"opacity .2s"}}>×</button>
                      </div>
                    );
                  })}
                </>
              )}
              {gastosMes.length===0&&entradasMes.length===0&&!carregando&&<p style={{color:C.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Nenhum lançamento este mês</p>}
            </div>
          </Card>

          {/* Col 3 */}
          <PainelSaude pct={pctReal} saldo={saldo} gastosMes={gastosMes} renda={totalE}/>
        </div>
      </div>

      {showPeriodo&&<PainelPeriodo gastos={gastos} entradas={entradas} onClose={()=>setShowPeriodo(false)}/>}
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
        html,body{height:100%;background:#080808;}
        input,select,button{outline:none;font-family:inherit;}
        .inp{background:#181818;border:1px solid #252525;border-radius:10px;padding:10px 14px;color:#f2f2f2;font-size:14px;width:100%;transition:border .2s;font-family:'DM Mono',monospace;}
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