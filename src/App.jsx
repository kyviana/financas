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

const AMBER = "#f59e0b";
const AMBER_BRIGHT = "#fbbf24";
const AMBER_DIM = "#78350f";

const CAT_GASTOS = [
  { nome: "Alimentação", emoji: "🍽️" },
  { nome: "Transporte", emoji: "🚌" },
  { nome: "Lazer", emoji: "🎮" },
  { nome: "Saúde", emoji: "💊" },
  { nome: "Moradia", emoji: "🏠" },
  { nome: "Educação", emoji: "📚" },
  { nome: "Outros", emoji: "📦" },
];

const CAT_ENTRADAS = [
  { nome: "Salário", emoji: "💼" },
  { nome: "Freela", emoji: "🖥️" },
  { nome: "Investimento", emoji: "📈" },
  { nome: "Presente", emoji: "🎁" },
  { nome: "Outros", emoji: "💰" },
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const fBRL = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fShort = (v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`;

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

function saude(pct) {
  if (pct <= 60) return { label: "Saudável", cor: "#ffffff", bg: "#ffffff18", icon: "✦", msg: "Ótimo controle! Você está bem abaixo do limite." };
  if (pct <= 80) return { label: "Razoável", cor: AMBER, bg: AMBER + "22", icon: "◈", msg: "Atenção: mais da metade da renda já foi comprometida." };
  if (pct <= 95) return { label: "Alerta", cor: "#f97316", bg: "#f9731622", icon: "⚠", msg: "Gastos elevados! Considere revisar suas despesas." };
  return { label: "Crítico", cor: "#ef4444", bg: "#ef444422", icon: "✕", msg: "Gastos ultrapassaram (ou estão próximos de) sua renda!" };
}

// ─── BARCHART ─────────────────────────────────────────────
function BarChart({ gastos }) {
  const totais = CAT_GASTOS.map(cat => ({
    ...cat,
    total: gastos.filter(g => g.categoria === cat.nome).reduce((s, g) => s + g.valor, 0),
  })).filter(t => t.total > 0).sort((a, b) => b.total - a.total);
  const max = Math.max(...totais.map(t => t.total), 1);
  if (!totais.length) return <p style={emptyStyle}>Nenhum gasto registrado</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {totais.map(t => (
        <div key={t.nome} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 22, textAlign: "center", fontSize: 13 }}>{t.emoji}</span>
          <span style={{ width: 90, fontSize: 12, color: "#666", fontFamily: "'DM Mono', monospace" }}>{t.nome}</span>
          <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 4, height: 16, overflow: "hidden" }}>
            <div style={{ width: `${(t.total / max) * 100}%`, background: `linear-gradient(90deg, ${AMBER_DIM}, ${AMBER})`, height: "100%", borderRadius: 4, transition: "width 0.7s cubic-bezier(.4,0,.2,1)" }} />
          </div>
          <span style={{ width: 82, fontSize: 11, color: AMBER, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{fBRL(t.total)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── ANUAL ────────────────────────────────────────────────
function AnualChart({ gastos, entradas }) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const dados = MESES_SHORT.map((m, i) => {
    const g = gastos.filter(x => { const d = new Date(x.data+"T12:00:00"); return d.getMonth()===i && d.getFullYear()===ano; }).reduce((s,x) => s+x.valor, 0);
    const e = entradas.filter(x => { const d = new Date(x.data+"T12:00:00"); return d.getMonth()===i && d.getFullYear()===ano; }).reduce((s,x) => s+x.valor, 0);
    return { mes: m, indice: i, gastos: g, entradas: e };
  });
  const max = Math.max(...dados.map(d => Math.max(d.gastos, d.entradas)), 1);
  const mesAtual = hoje.getMonth();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 130, padding: "0 2px" }}>
      {dados.map(d => {
        const hG = Math.max((d.gastos / max) * 100, d.gastos > 0 ? 3 : 0);
        const hE = Math.max((d.entradas / max) * 100, d.entradas > 0 ? 3 : 0);
        const isCurrent = d.indice === mesAtual;
        return (
          <div key={d.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", height: 100, display: "flex", alignItems: "flex-end", gap: 1 }}>
              <div title={`Entradas: ${fBRL(d.entradas)}`} style={{ flex: 1, height: `${hE}%`, minHeight: d.entradas > 0 ? 3 : 0, background: isCurrent ? AMBER : AMBER+"55", borderRadius: "3px 3px 1px 1px", transition: "height 0.6s" }} />
              <div title={`Gastos: ${fBRL(d.gastos)}`} style={{ flex: 1, height: `${hG}%`, minHeight: d.gastos > 0 ? 3 : 0, background: isCurrent ? "#fff" : "#ffffff33", borderRadius: "3px 3px 1px 1px", transition: "height 0.6s" }} />
            </div>
            <span style={{ fontSize: 9, color: isCurrent ? "#e2e8f0" : "#444", fontFamily: "'DM Mono', monospace", fontWeight: isCurrent ? 700 : 400 }}>{d.mes}</span>
          </div>
        );
      })}
    </div>
  );
}

const emptyStyle = { color: "#444", textAlign: "center", fontSize: 13, padding: "20px 0" };

// ─── MODAL MOBILE ─────────────────────────────────────────
function ModalMobile({ tipo, onClose, onSave }) {
  const hoje = new Date().toISOString().split("T")[0];
  const cats = tipo === "gasto" ? CAT_GASTOS : CAT_ENTRADAS;
  const [form, setForm] = useState({ descricao: tipo === "entrada" ? cats[0].nome : "", valor: "", categoria: cats[0].nome, data: hoje });
  const salvar = () => {
    if (!form.valor || isNaN(parseFloat(form.valor))) return;
    onSave({ ...form, descricao: form.descricao || form.categoria, valor: parseFloat(form.valor) });
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000dd", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: tipo === "entrada" ? AMBER : "#fff" }}>
            {tipo === "entrada" ? "Nova entrada" : "Novo gasto"}
          </p>
          <button onClick={onClose} style={{ background: "#222", color: "#888", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        {tipo === "gasto" && <input className="inp" placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} autoFocus />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input className="inp" placeholder="Valor (R$)" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} autoFocus={tipo === "entrada"} />
          <input className="inp" type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cats.map(c => (
            <button key={c.nome} onClick={() => setForm({ ...form, categoria: c.nome, descricao: tipo === "entrada" ? c.nome : form.descricao })}
              style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${form.categoria === c.nome ? AMBER : "#333"}`, background: form.categoria === c.nome ? AMBER+"22" : "transparent", color: form.categoria === c.nome ? AMBER : "#666", fontSize: 12, cursor: "pointer", transition: "all .15s" }}>
              {c.emoji} {c.nome}
            </button>
          ))}
        </div>
        <button onClick={salvar} style={{ background: tipo === "entrada" ? `linear-gradient(135deg, ${AMBER_DIM}, ${AMBER})` : "#fff", color: tipo === "entrada" ? "#000" : "#000", fontWeight: 700, padding: 14, borderRadius: 12, border: "none", fontSize: 15, cursor: "pointer" }}>
          Salvar
        </button>
      </div>
    </div>
  );
}

// ─── MOBILE ───────────────────────────────────────────────
function MobileApp({ gastos, entradas, carregando, onAddGasto, onAddEntrada, onDelGasto, onDelEntrada }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [aba, setAba] = useState("gastos");
  const [modal, setModal] = useState(null);

  const gastosMes = useMemo(() => gastos.filter(g => { const d = new Date(g.data+"T12:00:00"); return d.getMonth()===mes && d.getFullYear()===ano; }), [gastos, mes, ano]);
  const entradasMes = useMemo(() => entradas.filter(e => { const d = new Date(e.data+"T12:00:00"); return d.getMonth()===mes && d.getFullYear()===ano; }), [entradas, mes, ano]);

  const totalGastos = gastosMes.reduce((s, g) => s + g.valor, 0);
  const totalEntradas = entradasMes.reduce((s, e) => s + e.valor, 0);
  const saldo = totalEntradas - totalGastos;
  const pct = totalEntradas > 0 ? Math.min((totalGastos / totalEntradas) * 100, 110) : 0;
  const corBarra = pct > 95 ? "#ef4444" : pct > 80 ? "#f97316" : AMBER;

  const mudarMes = (d) => {
    let m = mes + d, a = ano;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", paddingBottom: 80, fontFamily: "'Georgia', serif" }}>
      <div style={{ padding: "20px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>
          Finanças <span style={{ color: AMBER }}>Pessoais</span>
        </h1>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: carregando ? "#f97316" : AMBER, boxShadow: `0 0 8px ${carregando ? "#f97316" : AMBER}` }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 0" }}>
        <button onClick={() => mudarMes(-1)} style={btnNav}>←</button>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600, color: "#fff" }}>{MESES_SHORT[mes]} {ano}</span>
        <button onClick={() => mudarMes(1)} style={btnNav}>→</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 16px 0" }}>
        {[
          { label: "Entradas", valor: totalEntradas, cor: AMBER },
          { label: "Gastos", valor: totalGastos, cor: "#fff" },
          { label: "Saldo", valor: saldo, cor: saldo >= 0 ? AMBER_BRIGHT : "#ef4444" },
        ].map(item => (
          <div key={item.label} style={card}>
            <p style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", marginBottom: 5 }}>{item.label}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: item.cor, fontFamily: "'DM Mono', monospace" }}>{fBRL(item.valor)}</p>
          </div>
        ))}
      </div>

      <div style={{ margin: "10px 16px 0", ...card, padding: "10px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace" }}>comprometido</span>
          <span style={{ fontSize: 11, color: corBarra, fontFamily: "'DM Mono', monospace" }}>{pct.toFixed(1)}%</span>
        </div>
        <div style={{ background: "#1a1a1a", borderRadius: 99, height: 5 }}>
          <div style={{ width: `${Math.min(pct,100)}%`, background: corBarra, height: "100%", borderRadius: 99, transition: "width 0.6s" }} />
        </div>
      </div>

      <div style={{ display: "flex", margin: "12px 16px 0", background: "#111", border: "1px solid #222", borderRadius: 12, padding: 4, gap: 4 }}>
        {[{ id: "gastos", label: "Gastos" }, { id: "entradas", label: "Entradas" }, { id: "cats", label: "Categorias" }].map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace", transition: "all .2s", background: aba === a.id ? "#222" : "transparent", color: aba === a.id ? "#fff" : "#555" }}>{a.label}</button>
        ))}
      </div>

      <div style={{ margin: "10px 16px 0", ...card }}>
        {aba === "cats" && <BarChart gastos={gastosMes} />}
        {aba !== "cats" && (() => {
          const lista = aba === "gastos" ? gastosMes : entradasMes;
          const cats = aba === "gastos" ? CAT_GASTOS : CAT_ENTRADAS;
          const onDel = aba === "gastos" ? onDelGasto : onDelEntrada;
          return (
            <>
              {carregando && <p style={emptyStyle}>Carregando...</p>}
              {!carregando && lista.length === 0 && <p style={emptyStyle}>Nenhum registro este mês</p>}
              {[...lista].sort((a,b) => new Date(b.data)-new Date(a.data)).map(g => {
                const cat = cats.find(c => c.nome === g.categoria) || cats[cats.length-1];
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <span style={{ fontSize: 17 }}>{cat.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#ddd" }}>{g.descricao}</p>
                      <p style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace" }}>{new Date(g.data+"T12:00:00").toLocaleDateString("pt-BR")} · {g.categoria}</p>
                    </div>
                    <span style={{ fontSize: 13, color: aba === "entradas" ? AMBER : "#fff", fontFamily: "'DM Mono', monospace" }}>{fBRL(g.valor)}</span>
                    <button onClick={() => onDel(g.id)} style={{ background: "transparent", border: "none", color: "#444", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>

      {/* FABs */}
      <div style={{ position: "fixed", bottom: 88, right: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => setModal("entrada")} style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${AMBER_DIM}, ${AMBER})`, border: "none", color: "#000", fontSize: 20, cursor: "pointer", boxShadow: `0 4px 20px ${AMBER}55`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
        <button onClick={() => setModal("gasto")} style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff", border: "none", color: "#000", fontSize: 20, cursor: "pointer", boxShadow: "0 4px 20px #ffffff33", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
      </div>
      <div style={{ position: "fixed", bottom: 64, right: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 9, color: AMBER, fontFamily: "'DM Mono', monospace" }}>entrada</span>
        <span style={{ fontSize: 9, color: "#fff", fontFamily: "'DM Mono', monospace", marginTop: 14 }}>gasto</span>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#111", borderTop: "1px solid #222", display: "flex", padding: "8px 0 16px" }}>
        {[{ emoji: "📊", label: "Resumo" }, { emoji: "📋", label: "Registros" }, { emoji: "📈", label: "Anual" }].map((item, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 18 }}>{item.emoji}</span>
            <span style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {modal && <ModalMobile tipo={modal} onClose={() => setModal(null)} onSave={async (dados) => { modal === "gasto" ? await onAddGasto(dados) : await onAddEntrada(dados); setModal(null); }} />}
    </div>
  );
}

// ─── DESKTOP ──────────────────────────────────────────────
function DesktopApp({ gastos, entradas, carregando, onAddGasto, onAddEntrada, onDelGasto, onDelEntrada }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [painel, setPainel] = useState("gasto"); // "gasto" | "entrada"
  const [formG, setFormG] = useState({ descricao: "", valor: "", categoria: "Alimentação", data: hoje.toISOString().split("T")[0] });
  const [formE, setFormE] = useState({ descricao: "Salário", valor: "", categoria: "Salário", data: hoje.toISOString().split("T")[0] });

  const gastosMes = useMemo(() => gastos.filter(g => { const d = new Date(g.data+"T12:00:00"); return d.getMonth()===mes && d.getFullYear()===ano; }), [gastos, mes, ano]);
  const entradasMes = useMemo(() => entradas.filter(e => { const d = new Date(e.data+"T12:00:00"); return d.getMonth()===mes && d.getFullYear()===ano; }), [entradas, mes, ano]);

  const totalGastos = gastosMes.reduce((s, g) => s + g.valor, 0);
  const totalEntradas = entradasMes.reduce((s, e) => s + e.valor, 0);
  const saldo = totalEntradas - totalGastos;
  const pct = totalEntradas > 0 ? Math.min((totalGastos / totalEntradas) * 100, 110) : 0;
  const saúde = saude(pct);
  const corBarra = pct > 95 ? "#ef4444" : pct > 80 ? "#f97316" : AMBER;

  const mudarMes = (d) => {
    let m = mes + d, a = ano;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a);
  };

  const salvarGasto = async () => {
    if (!formG.descricao || !formG.valor || isNaN(parseFloat(formG.valor))) return;
    await onAddGasto({ ...formG, valor: parseFloat(formG.valor) });
    setFormG({ descricao: "", valor: "", categoria: "Alimentação", data: hoje.toISOString().split("T")[0] });
  };

  const salvarEntrada = async () => {
    if (!formE.valor || isNaN(parseFloat(formE.valor))) return;
    await onAddEntrada({ ...formE, descricao: formE.descricao || formE.categoria, valor: parseFloat(formE.valor) });
    setFormE({ descricao: formE.categoria, valor: "", categoria: formE.categoria, data: hoje.toISOString().split("T")[0] });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#e2e8f0", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column" }}>

      {/* TOPBAR */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "18px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
            Finanças <span style={{ color: AMBER }}>Pessoais</span>
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: carregando ? "#f97316" : AMBER, boxShadow: `0 0 8px ${carregando ? "#f97316" : AMBER}` }} />
            <span style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono', monospace" }}>{carregando ? "sincronizando..." : "ao vivo"}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => mudarMes(-1)} style={btnNav}>←</button>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, minWidth: 200, textAlign: "center", color: "#fff" }}>{MESES[mes]} {ano}</span>
          <button onClick={() => mudarMes(1)} style={btnNav}>→</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPainel(painel === "entrada" ? null : "entrada")} style={{ background: painel === "entrada" ? `linear-gradient(135deg, ${AMBER_DIM}, ${AMBER})` : "#111", color: painel === "entrada" ? "#000" : AMBER, fontWeight: 700, padding: "9px 18px", borderRadius: 10, border: `1px solid ${painel === "entrada" ? "transparent" : "#333"}`, fontSize: 13, cursor: "pointer", transition: "all .2s" }}>
            + Entrada
          </button>
          <button onClick={() => setPainel(painel === "gasto" ? null : "gasto")} style={{ background: painel === "gasto" ? "#fff" : "#111", color: "#000", fontWeight: 700, padding: "9px 18px", borderRadius: 10, border: `1px solid ${painel === "gasto" ? "transparent" : "#333"}`, fontSize: 13, cursor: "pointer", transition: "all .2s" }}>
            − Gasto
          </button>
        </div>
      </div>

      {/* FORM PANEL */}
      {painel === "gasto" && (
        <div style={{ background: "#0e0e0e", borderBottom: "1px solid #1a1a1a", padding: "16px 36px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label style={lbl}>descrição</label>
            <input className="inp" placeholder="Ex: Supermercado" value={formG.descricao} onChange={e => setFormG({...formG, descricao: e.target.value})} onKeyDown={e => e.key === "Enter" && salvarGasto()} autoFocus />
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <label style={lbl}>valor</label>
            <input className="inp" placeholder="0,00" type="number" value={formG.valor} onChange={e => setFormG({...formG, valor: e.target.value})} onKeyDown={e => e.key === "Enter" && salvarGasto()} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={lbl}>data</label>
            <input className="inp" type="date" value={formG.data} onChange={e => setFormG({...formG, data: e.target.value})} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={lbl}>categoria</label>
            <select className="inp" value={formG.categoria} onChange={e => setFormG({...formG, categoria: e.target.value})}>
              {CAT_GASTOS.map(c => <option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}
            </select>
          </div>
          <button onClick={salvarGasto} style={{ background: "#fff", color: "#000", fontWeight: 700, padding: "10px 22px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>Salvar ↵</button>
        </div>
      )}
      {painel === "entrada" && (
        <div style={{ background: "#0e0e0e", borderBottom: `1px solid ${AMBER}33`, padding: "16px 36px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label style={lbl}>descrição</label>
            <input className="inp" placeholder="Ex: Salário de Março" value={formE.descricao} onChange={e => setFormE({...formE, descricao: e.target.value})} onKeyDown={e => e.key === "Enter" && salvarEntrada()} autoFocus />
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <label style={lbl}>valor</label>
            <input className="inp" placeholder="0,00" type="number" value={formE.valor} onChange={e => setFormE({...formE, valor: e.target.value})} onKeyDown={e => e.key === "Enter" && salvarEntrada()} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={lbl}>data</label>
            <input className="inp" type="date" value={formE.data} onChange={e => setFormE({...formE, data: e.target.value})} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={lbl}>categoria</label>
            <select className="inp" value={formE.categoria} onChange={e => setFormE({...formE, categoria: e.target.value, descricao: e.target.value})}>
              {CAT_ENTRADAS.map(c => <option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}
            </select>
          </div>
          <button onClick={salvarEntrada} style={{ background: `linear-gradient(135deg, ${AMBER_DIM}, ${AMBER})`, color: "#000", fontWeight: 700, padding: "10px 22px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>Salvar ↵</button>
        </div>
      )}

      <div style={{ flex: 1, padding: "24px 36px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ALERTA DE SAÚDE */}
        <div style={{ background: saúde.bg, border: `1px solid ${saúde.cor}44`, borderRadius: 14, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 28, color: saúde.cor, lineHeight: 1 }}>{saúde.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: saúde.cor, fontWeight: 700 }}>Saúde Financeira: {saúde.label}</span>
              <span style={{ background: saúde.cor + "22", color: saúde.cor, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontFamily: "'DM Mono', monospace" }}>{pct.toFixed(1)}% comprometido</span>
            </div>
            <p style={{ fontSize: 14, color: "#888" }}>{saúde.msg}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>saldo do mês</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: saldo >= 0 ? AMBER : "#ef4444", fontFamily: "'DM Mono', monospace" }}>{fBRL(saldo)}</p>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          {[
            { label: "Entradas", valor: totalEntradas, cor: AMBER, sub: `${entradasMes.length} registro(s)` },
            { label: "Total gasto", valor: totalGastos, cor: "#fff", sub: `${gastosMes.length} lançamento(s)` },
            { label: "Saldo", valor: saldo, cor: saldo >= 0 ? AMBER_BRIGHT : "#ef4444", sub: saldo >= 0 ? "positivo ✦" : "negativo ✕" },
            { label: "Maior gasto", valor: gastosMes.length ? Math.max(...gastosMes.map(g => g.valor)) : 0, cor: "#aaa", sub: gastosMes.length ? gastosMes.find(g => g.valor === Math.max(...gastosMes.map(x => x.valor)))?.descricao ?? "—" : "—" },
            { label: "Média/dia", valor: totalGastos / (hoje.getDate()), cor: "#666", sub: `base: ${hoje.getDate()} dias` },
          ].map(item => (
            <div key={item.label} style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px 20px" }}>
              <p style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>{item.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: item.cor, fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{fBRL(item.valor)}</p>
              <p style={{ fontSize: 11, color: "#333", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sub}</p>
            </div>
          ))}
        </div>

        {/* BARRA */}
        <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 14, padding: "16px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#555", fontFamily: "'DM Mono', monospace" }}>comprometimento da renda · {MESES[mes]}</span>
            <span style={{ fontSize: 13, color: corBarra, fontFamily: "'DM Mono', monospace" }}>{fBRL(totalGastos)} de {fBRL(totalEntradas)}</span>
          </div>
          <div style={{ background: "#1a1a1a", borderRadius: 99, height: 10 }}>
            <div style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${corBarra}88, ${corBarra})`, height: "100%", borderRadius: 99, transition: "width 0.6s" }} />
          </div>
        </div>

        {/* GRID PRINCIPAL */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.7fr", gap: 18 }}>

          {/* Esquerda */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 14, padding: 22 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, marginBottom: 18, color: "#fff" }}>Gastos por categoria</p>
              <BarChart gastos={gastosMes} />
            </div>
            <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 14, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#fff" }}>Visão anual · {ano}</p>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace" }}><span style={{ width: 10, height: 10, background: AMBER, borderRadius: 2, display: "inline-block" }} />entradas</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace" }}><span style={{ width: 10, height: 10, background: "#fff", borderRadius: 2, display: "inline-block" }} />gastos</span>
                </div>
              </div>
              <AnualChart gastos={gastos} entradas={entradas} />
            </div>

            {/* Entradas do mês */}
            <div style={{ background: "#0e0e0e", border: `1px solid ${AMBER}22`, borderRadius: 14, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: AMBER }}>Entradas do mês</p>
                <span style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono', monospace" }}>{entradasMes.length} registro(s)</span>
              </div>
              {entradasMes.length === 0 && <p style={emptyStyle}>Nenhuma entrada registrada</p>}
              {[...entradasMes].sort((a,b) => new Date(b.data)-new Date(a.data)).map(e => {
                const cat = CAT_ENTRADAS.find(c => c.nome === e.categoria) || CAT_ENTRADAS[4];
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #111" }}>
                    <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: "#ccc" }}>{e.descricao}</p>
                      <p style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>{new Date(e.data+"T12:00:00").toLocaleDateString("pt-BR")} · {e.categoria}</p>
                    </div>
                    <span style={{ fontSize: 14, color: AMBER, fontFamily: "'DM Mono', monospace" }}>{fBRL(e.valor)}</span>
                    <button onClick={() => onDelEntrada(e.id)} className="del-btn" style={{ opacity: 0, background: "transparent", border: "none", color: "#555", fontSize: 16, cursor: "pointer", padding: "0 4px", transition: "opacity .2s" }}>×</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Direita — Lançamentos */}
          <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#fff" }}>Lançamentos de gastos</p>
              <span style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono', monospace" }}>{gastosMes.length} itens · {fBRL(totalGastos)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 90px 32px", gap: 8, padding: "0 0 10px", borderBottom: "1px solid #1a1a1a" }}>
              {["Descrição","Categoria","Data","Valor",""].map((h,i) => (
                <span key={i} style={{ fontSize: 11, color: "#333", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: 1 }}>{h}</span>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", marginTop: 6 }}>
              {carregando && <p style={emptyStyle}>Carregando...</p>}
              {!carregando && gastosMes.length === 0 && <p style={emptyStyle}>Nenhum lançamento este mês</p>}
              {[...gastosMes].sort((a,b) => new Date(b.data)-new Date(a.data)).map(g => {
                const cat = CAT_GASTOS.find(c => c.nome === g.categoria) || CAT_GASTOS[6];
                return (
                  <div key={g.id} className="row-t" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 90px 32px", gap: 8, padding: "11px 0", borderBottom: "1px solid #111", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15 }}>{cat.emoji}</span>
                      <span style={{ fontSize: 14, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.descricao}</span>
                    </div>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, background: AMBER+"18", color: AMBER, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.categoria}</span>
                    <span style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono', monospace" }}>{new Date(g.data+"T12:00:00").toLocaleDateString("pt-BR")}</span>
                    <span style={{ fontSize: 14, color: "#fff", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{fBRL(g.valor)}</span>
                    <button onClick={() => onDelGasto(g.id)} className="del-btn" style={{ opacity: 0, background: "transparent", border: "none", color: "#555", fontSize: 16, cursor: "pointer", padding: "0 4px", transition: "opacity .2s" }}>×</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ESTILOS COMPARTILHADOS ───────────────────────────────
const card = { background: "#111", border: "1px solid #1a1a1a", borderRadius: 14, padding: "14px 16px" };
const btnNav = { background: "#111", border: "1px solid #222", color: "#666", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 15 };
const lbl = { fontSize: 11, color: "#444", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 6 };

// ─── ROOT ─────────────────────────────────────────────────
export default function App() {
  const [gastos, setGastos] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "gastos"), snap => { setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setCarregando(false); });
    const u2 = onSnapshot(collection(db, "entradas"), snap => setEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const onAddGasto = (d) => addDoc(collection(db, "gastos"), d);
  const onAddEntrada = (d) => addDoc(collection(db, "entradas"), d);
  const onDelGasto = (id) => deleteDoc(doc(db, "gastos", id));
  const onDelEntrada = (id) => deleteDoc(doc(db, "entradas", id));

  const props = { gastos, entradas, carregando, onAddGasto, onAddEntrada, onDelGasto, onDelEntrada };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, button { outline: none; font-family: inherit; }
        body { background: #080808; }
        .inp { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 10px 14px; color: #e2e8f0; font-size: 14px; width: 100%; transition: border .2s; font-family: 'DM Mono', monospace; }
        .inp:focus { border-color: ${AMBER}; }
        .row-t:hover .del-btn { opacity: 1 !important; }
        .row-t:hover { background: #111; }
      `}</style>
      {isMobile ? <MobileApp {...props} /> : <DesktopApp {...props} />}
    </>
  );
}