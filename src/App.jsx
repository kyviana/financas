import { useState, useMemo, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";

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

// ── OFX Parser ────────────────────────────────────────────
function parseOFX(texto) {
  const transacoes = [];
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || [];
  blocos.forEach(b => {
    const get = tag => { const m = b.match(new RegExp(`<${tag}>([^<]*)`)); return m ? m[1].trim() : ""; };
    const tipo  = get("TRNTYPE");
    const dtRaw = get("DTPOSTED");
    const valor = parseFloat(get("TRNAMT").replace(",","."));
    const nome  = get("NAME");
    const memo  = get("MEMO");
    // Ignorar saldos internos e datas inválidas
    if(nome==="Saldo do dia"||nome==="Saldo Anterior") return;
    if(!dtRaw||dtRaw.startsWith("0002")) return;
    if(isNaN(valor)||valor===0) return;
    // Converter data YYYYMMDD → YYYY-MM-DD
    const ano=dtRaw.slice(0,4), mes=dtRaw.slice(4,6), dia=dtRaw.slice(6,8);
    const data=`${ano}-${mes}-${dia}`;
    // Usar data do memo se disponível (BB registra a data real no memo)
    let dataReal=data;
    const memoData=memo.match(/^(\d{2})\/(\d{2})/);
    if(memoData) {
      dataReal=`${ano}-${memoData[2]}-${memoData[1]}`;
    }
    transacoes.push({ tipo, valor:Math.abs(valor), nome, memo, data:dataReal, dataOriginal:data });
  });
  return transacoes;
}

// ── Sugestor de categoria ─────────────────────────────────
function sugerirCategoria(nome, memo, tipo) {
  if(tipo==="CREDIT") {
    const t=(nome+" "+memo).toUpperCase();
    if(t.includes("SALARIO")||t.includes("SALÁRIO")||t.includes("FOLHA")) return{col:"entrada",cat:"Salário"};
    if(t.includes("FREELANCE")||t.includes("SERVICO")||t.includes("SERVIÇO")) return{col:"entrada",cat:"Freelance"};
    if(t.includes("INVESTIMENTO")||t.includes("RENDIMENTO")||t.includes("CDB")||t.includes("POUPANÇA")) return{col:"entrada",cat:"Investimento"};
    if(t.includes("DEP DINHEIRO")||t.includes("DEPOSITO")||t.includes("DEPÓSITO")||t.includes("ATM")) return{col:"entrada",cat:"Outros"};
    if(t.includes("TRANSFERENCIA")||t.includes("TRANSFERÊNCIA")||t.includes("PIX")) return{col:"entrada",cat:"Outros"};
    return{col:"entrada",cat:"Outros"};
  }
  const t=(nome+" "+memo).toUpperCase();
  if(t.includes("SUPERMERCADO")||t.includes("MERCADO")||t.includes("ACAI")||t.includes("AÇAÍ")||t.includes("PIZZA")||t.includes("HAMBURGU")||t.includes("BURGER")||t.includes("RESTAUR")||t.includes("LANCH")||t.includes("PADARIA")||t.includes("ASSAI")||t.includes("ATACAD")||t.includes("LAGOA")) return{col:"gasto",cat:"Alimentação"};
  if(t.includes("UBER")||t.includes("POSTO")||t.includes("COMBUSTIVEL")||t.includes("COMBUSTÍVEL")||t.includes("ONIBUS")||t.includes("ÔNIBUS")||t.includes("TAXI")||t.includes("99POP")||t.includes("TRANSPORT")) return{col:"gasto",cat:"Transporte"};
  if(t.includes("FARMACIA")||t.includes("FARMÁCIA")||t.includes("FARMA")||t.includes("DROGARIA")||t.includes("MEDICO")||t.includes("MÉDICO")||t.includes("HOSPITAL")||t.includes("CLINICA")||t.includes("CLÍNICA")) return{col:"gasto",cat:"Saúde"};
  if(t.includes("BRISANET")||t.includes("INTERNET")||t.includes("CLARO")||t.includes("VIVO")||t.includes("TIM")||t.includes("OI")||t.includes("TELEFO")||t.includes("PRE-PAGO")||t.includes("GLOBO")) return{col:"gasto",cat:"Moradia"};
  if(t.includes("BOLETO")||t.includes("AGUA")||t.includes("ÁGUA")||t.includes("LUZ")||t.includes("ENERGIA")||t.includes("ALUGUEL")||t.includes("CONDOM")) return{col:"gasto",cat:"Moradia"};
  if(t.includes("ESCOLA")||t.includes("FACUL")||t.includes("CURSO")||t.includes("LIVRO")||t.includes("EDUCAC")||t.includes("EDUCAÇ")) return{col:"gasto",cat:"Educação"};
  if(t.includes("CINEMA")||t.includes("THEATER")||t.includes("SHOW")||t.includes("JOGO")||t.includes("SPOTIFY")||t.includes("NETFLIX")||t.includes("AMAZON")) return{col:"gasto",cat:"Lazer"};
  if(t.includes("TARIFA")||t.includes("IOF")||t.includes("ANUIDADE")) return{col:"gasto",cat:"Outros"};
  return{col:"gasto",cat:"Outros"};
}

// ── PainelImportOFX ───────────────────────────────────────
function PainelImportOFX({onClose,onSalvar}){
  const [etapa,setEtapa]=useState("upload"); // upload | revisar | salvando | concluido
  const [itens,setItens]=useState([]);
  const [selecionados,setSelecionados]=useState({});
  const [salvando,setSalvando]=useState(false);
  const [progresso,setProgresso]=useState(0);
  const inputRef=useRef(null);

  const lerArquivo=(file)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      const texto=e.target.result;
      const transacoes=parseOFX(texto);
      const comCat=transacoes.map((t,i)=>({
        ...t,
        id:i,
        ...sugerirCategoria(t.nome,t.memo,t.tipo),
        descricao: t.memo||t.nome,
      }));
      setItens(comCat);
      // Selecionar todos por padrão
      const sel={};
      comCat.forEach(t=>sel[t.id]=true);
      setSelecionados(sel);
      setEtapa("revisar");
    };
    reader.readAsText(file,"UTF-8");
  };

  const onDrop=(e)=>{
    e.preventDefault();
    const file=e.dataTransfer?.files[0]||e.target.files[0];
    if(file) lerArquivo(file);
  };

  const toggleItem=(id)=>setSelecionados(s=>({...s,[id]:!s[id]}));
  const toggleTodos=(col)=>{
    const doCol=itens.filter(i=>i.col===col);
    const todosOn=doCol.every(i=>selecionados[i.id]);
    const novo={...selecionados};
    doCol.forEach(i=>novo[i.id]=!todosOn);
    setSelecionados(novo);
  };

  const atualizarItem=(id,campo,valor)=>{
    setItens(its=>its.map(it=>it.id===id?{...it,[campo]:valor}:it));
  };

  const salvar=async()=>{
    setSalvando(true);
    setEtapa("salvando");
    const paraGasto =itens.filter(i=>selecionados[i.id]&&i.col==="gasto");
    const paraEntrada=itens.filter(i=>selecionados[i.id]&&i.col==="entrada");
    const total=paraGasto.length+paraEntrada.length;
    let feitos=0;
    for(const g of paraGasto){
      await onSalvar("gasto",{descricao:g.descricao,valor:g.valor,categoria:g.cat,data:g.data});
      feitos++;setProgresso(Math.round((feitos/total)*100));
    }
    for(const e of paraEntrada){
      await onSalvar("entrada",{descricao:e.descricao,valor:e.valor,categoria:e.cat,data:e.data});
      feitos++;setProgresso(Math.round((feitos/total)*100));
    }
    setEtapa("concluido");
    setSalvando(false);
  };

  const gastosP =itens.filter(i=>i.col==="gasto");
  const entradasP=itens.filter(i=>i.col==="entrada");
  const totalGSel=gastosP.filter(i=>selecionados[i.id]).reduce((s,i)=>s+i.valor,0);
  const totalESel=entradasP.filter(i=>selecionados[i.id]).reduce((s,i)=>s+i.valor,0);
  const qtdSel=Object.values(selecionados).filter(Boolean).length;

  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"stretch",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{width:"min(820px,95vw)",background:C.bg,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"18px 26px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,background:C.surface}}>
          <div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,lineHeight:1}}>Importar <span style={{color:C.amber}}>OFX / Extrato</span></h2>
            <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:4}}>Banco do Brasil · revise antes de salvar</p>
          </div>
          <button onClick={onClose} style={{background:C.border,border:"none",color:C.muted,borderRadius:10,padding:"7px 13px",cursor:"pointer",fontSize:18,lineHeight:1}}>✕</button>
        </div>

        {/* Etapa: upload */}
        {etapa==="upload"&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
            <div
              onDrop={onDrop} onDragOver={e=>e.preventDefault()}
              onClick={()=>inputRef.current?.click()}
              style={{border:`2px dashed ${C.amber}55`,borderRadius:20,padding:"60px 40px",textAlign:"center",cursor:"pointer",transition:"all .2s",width:"100%",maxWidth:440}}
            >
              <div style={{fontSize:48,marginBottom:16}}>📂</div>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:10}}>Arraste o arquivo OFX aqui</p>
              <p style={{fontSize:13,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:20}}>ou clique para selecionar</p>
              <p style={{fontSize:11,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>Suportado: .ofx · Banco do Brasil e outros</p>
              <input ref={inputRef} type="file" accept=".ofx,.OFX" style={{display:"none"}} onChange={onDrop}/>
            </div>
          </div>
        )}

        {/* Etapa: revisar */}
        {etapa==="revisar"&&(
          <>
            {/* Resumo */}
            <div style={{flexShrink:0,padding:"14px 26px",background:C.surface2,borderBottom:`1px solid ${C.border}`,display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:16}}>
                <div><span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>SELECIONADOS </span><span style={{fontSize:14,color:C.white,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{qtdSel} itens</span></div>
                <div><span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>ENTRADAS </span><span style={{fontSize:14,color:C.amber,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fBRL(totalESel)}</span></div>
                <div><span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>GASTOS </span><span style={{fontSize:14,color:C.white,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fBRL(totalGSel)}</span></div>
              </div>
              <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                <button onClick={()=>setEtapa("upload")} style={{background:"transparent",border:`1px solid ${C.border2}`,color:C.muted,padding:"7px 16px",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:"'DM Mono',monospace"}}>← Voltar</button>
                <button onClick={salvar} disabled={qtdSel===0} style={{background:qtdSel>0?C.amber:"#333",color:C.bg,fontWeight:700,padding:"8px 22px",borderRadius:10,border:"none",cursor:qtdSel>0?"pointer":"not-allowed",fontSize:13,whiteSpace:"nowrap"}}>
                  Salvar {qtdSel} lançamento{qtdSel!==1?"s":""}
                </button>
              </div>
            </div>

            <div style={{flex:1,overflowY:"auto",padding:"0 26px 24px"}}>
              {/* Entradas */}
              {entradasP.length>0&&(
                <div style={{marginTop:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <span style={{fontSize:13,color:C.amber,fontFamily:"'DM Mono',monospace",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>💰 Entradas ({entradasP.length})</span>
                    <button onClick={()=>toggleTodos("entrada")} style={{fontSize:11,color:C.muted,background:"transparent",border:`1px solid ${C.border2}`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                      {entradasP.every(i=>selecionados[i.id])?"Desmarcar todas":"Marcar todas"}
                    </button>
                  </div>
                  {entradasP.map(item=>(
                    <ItemRevisao key={item.id} item={item} sel={selecionados[item.id]} onToggle={()=>toggleItem(item.id)} onUpdate={(c,v)=>atualizarItem(item.id,c,v)} tipo="entrada"/>
                  ))}
                </div>
              )}
              {/* Gastos */}
              {gastosP.length>0&&(
                <div style={{marginTop:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <span style={{fontSize:13,color:C.white,fontFamily:"'DM Mono',monospace",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>💸 Gastos ({gastosP.length})</span>
                    <button onClick={()=>toggleTodos("gasto")} style={{fontSize:11,color:C.muted,background:"transparent",border:`1px solid ${C.border2}`,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
                      {gastosP.every(i=>selecionados[i.id])?"Desmarcar todos":"Marcar todos"}
                    </button>
                  </div>
                  {gastosP.map(item=>(
                    <ItemRevisao key={item.id} item={item} sel={selecionados[item.id]} onToggle={()=>toggleItem(item.id)} onUpdate={(c,v)=>atualizarItem(item.id,c,v)} tipo="gasto"/>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Etapa: salvando */}
        {etapa==="salvando"&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,padding:40}}>
            <div style={{fontSize:40}}>⏳</div>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:20}}>Salvando lançamentos...</p>
            <div style={{width:300,background:C.border,borderRadius:99,height:10}}>
              <div style={{width:`${progresso}%`,background:C.amber,height:"100%",borderRadius:99,transition:"width .3s"}}/>
            </div>
            <p style={{fontSize:13,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{progresso}% concluído</p>
          </div>
        )}

        {/* Etapa: concluido */}
        {etapa==="concluido"&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,padding:40,textAlign:"center"}}>
            <div style={{fontSize:56}}>✅</div>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:C.amber}}>Importação concluída!</p>
            <p style={{fontSize:14,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{qtdSel} lançamentos salvos no Firebase</p>
            <p style={{fontSize:13,color:C.muted2,fontFamily:"'DM Mono',monospace"}}>O app já foi atualizado em tempo real.</p>
            <button onClick={onClose} style={{background:C.amber,color:C.bg,fontWeight:700,padding:"12px 32px",borderRadius:12,border:"none",cursor:"pointer",fontSize:15,marginTop:10}}>Fechar e ver no app</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRevisao({item,sel,onToggle,onUpdate,tipo}){
  const cats=tipo==="gasto"?CATS_GASTO:CATS_ENTRADA;
  const corBorda=sel?(tipo==="entrada"?C.amber+"44":C.border2):C.border;
  return(
    <div style={{display:"grid",gridTemplateColumns:"28px 1fr 110px 120px 90px",gap:10,padding:"10px 14px",marginBottom:6,background:sel?C.surface:C.surface2,border:`1px solid ${corBorda}`,borderRadius:12,alignItems:"center",opacity:sel?1:0.45,transition:"all .15s"}}>
      <input type="checkbox" checked={!!sel} onChange={onToggle} style={{width:16,height:16,cursor:"pointer",accentColor:C.amber}}/>
      <div style={{minWidth:0}}>
        <input value={item.descricao} onChange={e=>onUpdate("descricao",e.target.value)}
          style={{background:"transparent",border:"none",color:C.text,fontSize:13,width:"100%",fontFamily:"inherit",outline:"none",borderBottom:`1px solid ${C.border2}`,paddingBottom:2}}/>
        <p style={{fontSize:10,color:C.muted2,fontFamily:"'DM Mono',monospace",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.data.split("-").reverse().join("/")} · {item.nome}</p>
      </div>
      <select value={item.cat} onChange={e=>onUpdate("cat",e.target.value)}
        style={{background:C.border,border:`1px solid ${C.border2}`,borderRadius:8,padding:"5px 8px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>
        {cats.map(c=><option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}
      </select>
      <input type="date" value={item.data} onChange={e=>onUpdate("data",e.target.value)}
        style={{background:C.border,border:`1px solid ${C.border2}`,borderRadius:8,padding:"5px 8px",color:C.text,fontSize:11,fontFamily:"'DM Mono',monospace"}}/>
      <span style={{fontSize:13,fontWeight:700,color:tipo==="entrada"?C.amber:C.white,fontFamily:"'DM Mono',monospace",textAlign:"right",whiteSpace:"nowrap"}}>{fBRL(item.valor)}</span>
    </div>
  );
}

// ── ItemLancamento com edição inline ─────────────────────
function ItemLancamento({item,tipo,onDel,onUpdate}){
  const [aberto,setAberto]=useState(false);
  const [form,setForm]=useState({descricao:item.descricao,valor:String(item.valor),categoria:item.categoria,data:item.data});
  const cats=tipo==="gasto"?CATS_GASTO:CATS_ENTRADA;
  const cat=cats.find(c=>c.nome===item.categoria)||cats[cats.length-1];
  const corValor=tipo==="entrada"?C.amber:C.white;
  const corCat=tipo==="entrada"?{background:C.amberLo,color:C.amber}:{background:C.border2,color:C.muted};

  const salvar=async()=>{
    const v=parseFloat(form.valor.replace(",","."));
    if(isNaN(v)||v<=0) return;
    await onUpdate({descricao:form.descricao,valor:v,categoria:form.categoria,data:form.data});
    setAberto(false);
  };

  return(
    <div style={{borderBottom:`1px solid ${C.border}22`,marginBottom:2}}>
      {/* Linha normal */}
      <div onClick={()=>setAberto(a=>!a)} className="row-t"
        style={{display:"grid",gridTemplateColumns:"22px 1fr auto auto",gap:6,padding:"9px 4px",alignItems:"center",cursor:"pointer",borderRadius:8,transition:"background .15s",background:aberto?C.surface2:"transparent"}}>
        <span style={{fontSize:13,flexShrink:0}}>{cat.emoji}</span>
        <div style={{minWidth:0}}>
          <p style={{fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.descricao}</p>
          <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:1}}>{toDate(item.data).toLocaleDateString("pt-BR")} · <span style={{...corCat,padding:"1px 5px",borderRadius:8,fontSize:9}}>{item.categoria}</span></p>
        </div>
        <span style={{fontSize:12,color:corValor,fontFamily:"'DM Mono',monospace",fontWeight:700,whiteSpace:"nowrap"}}>{fBRL(item.valor)}</span>
        <button onClick={e=>{e.stopPropagation();onDel();}} style={{background:"transparent",border:"none",color:C.muted2,fontSize:16,cursor:"pointer",lineHeight:1,padding:"0 2px",transition:"color .15s"}}
          onMouseEnter={e=>e.currentTarget.style.color=C.danger}
          onMouseLeave={e=>e.currentTarget.style.color=C.muted2}>×</button>
      </div>

      {/* Edição inline */}
      {aberto&&(
        <div style={{background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:4}}>DESCRIÇÃO</p>
              <input className="inp" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} style={{fontSize:12,padding:"7px 10px"}}/>
            </div>
            <div>
              <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:4}}>VALOR (R$)</p>
              <input className="inp" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} style={{fontSize:12,padding:"7px 10px"}}/>
            </div>
            <div>
              <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:4}}>CATEGORIA</p>
              <select className="inp" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} style={{fontSize:12,padding:"7px 10px"}}>
                {cats.map(c=><option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}
              </select>
            </div>
            <div>
              <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:4}}>DATA</p>
              <input type="date" className="inp" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={{fontSize:12,padding:"7px 10px"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>onDel()} style={{background:"transparent",border:`1px solid ${C.danger}44`,color:C.danger,padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>🗑 Excluir</button>
            <button onClick={()=>setAberto(false)} style={{background:"transparent",border:`1px solid ${C.border2}`,color:C.muted,padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace"}}>Cancelar</button>
            <button onClick={salvar} style={{background:tipo==="entrada"?C.amber:C.white,color:C.bg,fontWeight:700,padding:"6px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12}}>Salvar</button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [showImport,setShowImport]=useState(false);

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
          <button onClick={()=>setShowImport(true)} style={{background:"transparent",border:`1px solid ${C.border2}`,color:C.muted,fontWeight:600,padding:"7px 16px",borderRadius:9,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Mono',monospace"}}>📥 Importar OFX</button>
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
      {showImport&&<PainelImportOFX onClose={()=>setShowImport(false)} onSalvar={async(tipo,d)=>{if(tipo==="gasto")await onAddGasto(d);else await onAddEntrada(d);}}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DESKTOP
// ══════════════════════════════════════════════════════════
// ── PainelReserva ─────────────────────────────────────────
function PainelReserva({onClose}){
  const [reserva,   setReserva]   = useState(null);
  const [meta,      setMeta]      = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [aba,       setAba]       = useState("visao"); // visao | atualizar | meta
  const [novoValor, setNovoValor] = useState("");
  const [novaMeta,  setNovaMeta]  = useState("");
  const [salvando,  setSalvando]  = useState(false);

  // Carregar dados do Firebase
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,"reserva"), snap=>{
      const docs=snap.docs.map(d=>({id:d.id,...d.data()}));
      const snapshots=docs.filter(d=>d.tipo==="snapshot").sort((a,b)=>new Date(b.data)-new Date(a.data));
      const metaDoc=docs.find(d=>d.tipo==="meta");
      if(snapshots.length>0){
        setReserva(snapshots[0].valor);
        setHistorico(snapshots.slice(0,12));
      }
      if(metaDoc) setMeta(metaDoc.valor);
      setLoading(false);
    });
    return()=>unsub();
  },[]);

  const salvarValor=async()=>{
    const v=parseFloat(novoValor.replace(",","."));
    if(isNaN(v)||v<0) return;
    setSalvando(true);
    const hoje=today();
    await addDoc(collection(db,"reserva"),{tipo:"snapshot",valor:v,data:hoje});
    setNovoValor("");
    setSalvando(false);
    setAba("visao");
  };

  const salvarMeta=async()=>{
    const v=parseFloat(novaMeta.replace(",","."));
    if(isNaN(v)||v<=0) return;
    setSalvando(true);
    // Buscar doc de meta existente para sobrescrever
    const snap=await import("firebase/firestore").then(({getDocs})=>getDocs(collection(db,"reserva")));
    const metaDoc=snap.docs.find(d=>d.data().tipo==="meta");
    if(metaDoc){
      await updateDoc(doc(db,"reserva",metaDoc.id),{valor:v});
    } else {
      await addDoc(collection(db,"reserva"),{tipo:"meta",valor:v});
    }
    setNovaMeta("");
    setSalvando(false);
    setAba("visao");
  };

  const pctMeta = meta&&reserva ? Math.min((reserva/meta)*100,100) : 0;
  const corMeta = pctMeta>=100?C.amber:pctMeta>=60?C.warn:"#4ade80";
  const anterior = historico.length>1?historico[1].valor:null;
  const variacao = reserva!=null&&anterior!=null?reserva-anterior:null;

  return(
    <div style={{position:"fixed",inset:0,background:"#000000bb",zIndex:200,display:"flex",alignItems:"stretch",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{width:"min(480px,92vw)",background:C.bg,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"20px 26px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,flexShrink:0}}>
          <div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>Reserva <span style={{color:C.amber}}>Financeira</span></h2>
            <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:3}}>saldo atual · meta · histórico</p>
          </div>
          <button onClick={onClose} style={{background:C.border,border:"none",color:C.muted,borderRadius:10,padding:"7px 13px",cursor:"pointer",fontSize:18,lineHeight:1}}>✕</button>
        </div>

        {/* Abas */}
        <div style={{display:"flex",gap:3,padding:"12px 26px",borderBottom:`1px solid ${C.border}`,background:C.surface,flexShrink:0}}>
          {[["visao","👁 Visão"],["atualizar","✏️ Atualizar"],["meta","🎯 Meta"]].map(([k,l])=>(
            <button key={k} onClick={()=>setAba(k)} style={{background:aba===k?C.amber:C.border,color:aba===k?C.bg:C.muted,border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace",fontWeight:aba===k?700:400,transition:"all .15s"}}>{l}</button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"24px 26px"}}>
          {loading&&<p style={{color:C.muted,textAlign:"center",padding:"40px 0",fontFamily:"'DM Mono',monospace"}}>Carregando...</p>}

          {/* Aba: Visão */}
          {!loading&&aba==="visao"&&(
            <div style={{display:"flex",flexDirection:"column",gap:20}}>

              {/* Valor atual */}
              <Card style={{padding:24,textAlign:"center"}}>
                {reserva!=null?(
                  <>
                    <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.1em"}}>Reserva atual</p>
                    <p style={{fontFamily:"'Playfair Display',serif",fontSize:38,fontWeight:700,color:C.amber,lineHeight:1}}>{fBRL(reserva)}</p>
                    {variacao!=null&&(
                      <p style={{fontSize:12,color:variacao>=0?"#4ade80":C.danger,fontFamily:"'DM Mono',monospace",marginTop:10}}>
                        {variacao>=0?"▲":"▼"} {fBRL(Math.abs(variacao))} desde o último registro
                      </p>
                    )}
                  </>
                ):(
                  <div>
                    <p style={{fontSize:32,marginBottom:12}}>🏦</p>
                    <p style={{color:C.muted,fontSize:14,fontFamily:"'DM Mono',monospace",marginBottom:16}}>Nenhum valor registrado ainda</p>
                    <button onClick={()=>setAba("atualizar")} style={{background:C.amber,color:C.bg,fontWeight:700,padding:"10px 24px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13}}>Registrar agora</button>
                  </div>
                )}
              </Card>

              {/* Barra de meta */}
              {meta&&reserva!=null&&(
                <Card style={{padding:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <p style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em"}}>🎯 Meta</p>
                    <p style={{fontSize:13,color:C.white,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fBRL(meta)}</p>
                  </div>
                  <div style={{background:C.border,borderRadius:99,height:12,marginBottom:10,overflow:"hidden"}}>
                    <div style={{width:`${pctMeta}%`,background:corMeta,height:"100%",borderRadius:99,transition:"width .6s ease"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{pctMeta.toFixed(1)}% atingido</span>
                    {pctMeta<100&&<span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>faltam {fBRL(meta-reserva)}</span>}
                    {pctMeta>=100&&<span style={{fontSize:11,color:C.amber,fontFamily:"'DM Mono',monospace"}}>✦ Meta atingida!</span>}
                  </div>
                </Card>
              )}

              {/* Sem meta */}
              {!meta&&reserva!=null&&(
                <button onClick={()=>setAba("meta")} style={{background:"transparent",border:`1px dashed ${C.border2}`,color:C.muted,borderRadius:12,padding:"14px",cursor:"pointer",fontSize:13,fontFamily:"'DM Mono',monospace",width:"100%"}}>
                  🎯 Definir uma meta de reserva
                </button>
              )}

              {/* Histórico */}
              {historico.length>0&&(
                <Card style={{padding:20}}>
                  <p style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Histórico de registros</p>
                  {historico.map((h,i)=>{
                    const varH=i<historico.length-1?h.valor-historico[i+1].valor:null;
                    return(
                      <div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<historico.length-1?`1px solid ${C.border}18`:"none"}}>
                        <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{toDate(h.data).toLocaleDateString("pt-BR")}</span>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {varH!=null&&<span style={{fontSize:10,color:varH>=0?"#4ade80":C.danger,fontFamily:"'DM Mono',monospace"}}>{varH>=0?"+":""}{fBRL(varH)}</span>}
                          <span style={{fontSize:13,color:i===0?C.amber:C.muted,fontFamily:"'DM Mono',monospace",fontWeight:i===0?700:400}}>{fBRL(h.valor)}</span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}
            </div>
          )}

          {/* Aba: Atualizar */}
          {!loading&&aba==="atualizar"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <Card style={{padding:20}}>
                <p style={{fontSize:13,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:20,lineHeight:1.6}}>
                  Informe o saldo atual da sua reserva. Um novo registro será salvo com a data de hoje.
                </p>
                {reserva!=null&&(
                  <div style={{background:C.surface2,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:12,color:C.muted,fontFamily:"'DM Mono',monospace"}}>Valor atual</span>
                    <span style={{fontSize:13,color:C.amber,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fBRL(reserva)}</span>
                  </div>
                )}
                <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Novo saldo (R$)</p>
                <input className="inp" placeholder="ex: 3500.00" value={novoValor}
                  onChange={e=>setNovoValor(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&salvarValor()}
                  style={{marginBottom:16,fontSize:20,textAlign:"center",letterSpacing:"0.05em"}}/>
                <button onClick={salvarValor} disabled={salvando||!novoValor}
                  style={{background:novoValor?C.amber:"#333",color:C.bg,fontWeight:700,padding:"12px",borderRadius:10,border:"none",cursor:novoValor?"pointer":"not-allowed",fontSize:14,width:"100%",transition:"background .2s"}}>
                  {salvando?"Salvando...":"Salvar registro"}
                </button>
              </Card>
            </div>
          )}

          {/* Aba: Meta */}
          {!loading&&aba==="meta"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <Card style={{padding:20}}>
                <p style={{fontSize:13,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:20,lineHeight:1.6}}>
                  {meta?`Meta atual: ${fBRL(meta)}. Digite um novo valor para alterar.`:"Defina quanto você quer ter guardado como reserva de emergência."}
                </p>
                <p style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Meta de reserva (R$)</p>
                <input className="inp" placeholder={meta?String(meta):"ex: 10000"} value={novaMeta}
                  onChange={e=>setNovaMeta(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&salvarMeta()}
                  style={{marginBottom:8,fontSize:20,textAlign:"center",letterSpacing:"0.05em"}}/>
                <p style={{fontSize:11,color:C.muted2,fontFamily:"'DM Mono',monospace",marginBottom:16,textAlign:"center"}}>💡 Especialistas recomendam 3 a 6 meses de despesas</p>
                <button onClick={salvarMeta} disabled={salvando||!novaMeta}
                  style={{background:novaMeta?C.amber:"#333",color:C.bg,fontWeight:700,padding:"12px",borderRadius:10,border:"none",cursor:novaMeta?"pointer":"not-allowed",fontSize:14,width:"100%",transition:"background .2s"}}>
                  {salvando?"Salvando...":"Definir meta"}
                </button>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DesktopApp({gastos,entradas,carregando,onAddGasto,onAddEntrada,onDelGasto,onDelEntrada,onUpdateGasto,onUpdateEntrada}){
  const hoje=new Date();
  const [mes,setMes]=useState(hoje.getMonth());
  const [ano,setAno]=useState(hoje.getFullYear());
  const [abaForm,setAbaForm]=useState("gasto");
  const [showForm,setShowForm]=useState(false);
  const [showPeriodo,setShowPeriodo]=useState(false);
  const [showImport,setShowImport]=useState(false);
  const [showReserva,setShowReserva]=useState(false);
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
          <button onClick={()=>setShowImport(true)} style={{background:"transparent",border:`1px solid ${C.border2}`,color:C.muted,fontWeight:600,padding:"7px 16px",borderRadius:9,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Mono',monospace"}}>📥 OFX</button>
          <button onClick={()=>setShowReserva(true)} style={{background:"transparent",border:`1px solid #4ade8033`,color:"#4ade80",fontWeight:600,padding:"7px 16px",borderRadius:9,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Mono',monospace"}}>🏦 Reserva</button>
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

          {/* Col 2: lançamentos lado a lado */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,minHeight:0,overflow:"hidden"}}>
            {/* Gastos */}
            <Card style={{padding:"16px 18px",display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexShrink:0}}>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:15}}>💸 Gastos <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>({gastosMes.length})</span></p>
                <span style={{fontSize:12,color:C.white,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fBRL(totalG)}</span>
              </div>
              <div style={{flex:1,overflowY:"auto"}}>
                {carregando&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:"16px 0"}}>Carregando...</p>}
                {gastosMes.length===0&&!carregando&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:"16px 0"}}>Nenhum gasto este mês</p>}
                {[...gastosMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(g=>(
                  <ItemLancamento key={g.id} item={g} tipo="gasto"
                    onDel={()=>onDelGasto(g.id)}
                    onUpdate={(d)=>onUpdateGasto(g.id,d)}/>
                ))}
              </div>
            </Card>
            {/* Entradas */}
            <Card style={{padding:"16px 18px",display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexShrink:0}}>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:15}}>💰 Entradas <span style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>({entradasMes.length})</span></p>
                <span style={{fontSize:12,color:C.amber,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{fBRL(totalE)}</span>
              </div>
              <div style={{flex:1,overflowY:"auto"}}>
                {carregando&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:"16px 0"}}>Carregando...</p>}
                {entradasMes.length===0&&!carregando&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:"16px 0"}}>Nenhuma entrada este mês</p>}
                {[...entradasMes].sort((a,b)=>new Date(b.data)-new Date(a.data)).map(e=>(
                  <ItemLancamento key={e.id} item={e} tipo="entrada"
                    onDel={()=>onDelEntrada(e.id)}
                    onUpdate={(d)=>onUpdateEntrada(e.id,d)}/>
                ))}
              </div>
            </Card>
          </div>

          {/* Col 3 */}
          <PainelSaude pct={pctReal} saldo={saldo} gastosMes={gastosMes} renda={totalE}/>
        </div>
      </div>

      {showPeriodo&&<PainelPeriodo gastos={gastos} entradas={entradas} onClose={()=>setShowPeriodo(false)}/>}
      {showImport&&<PainelImportOFX onClose={()=>setShowImport(false)} onSalvar={async(tipo,d)=>{if(tipo==="gasto")await onAddGasto(d);else await onAddEntrada(d);}}/>}
      {showReserva&&<PainelReserva onClose={()=>setShowReserva(false)}/>}
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
  const onUpdateGasto  =(id,d)=>updateDoc(doc(db,"gastos",  id),d);
  const onUpdateEntrada=(id,d)=>updateDoc(doc(db,"entradas",id),d);
  const props={gastos,entradas,carregando,onAddGasto,onAddEntrada,onDelGasto,onDelEntrada,onUpdateGasto,onUpdateEntrada};

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