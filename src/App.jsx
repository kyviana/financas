import { useState, useMemo, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

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

const CATEGORIAS = [
  { nome: "Alimentação", emoji: "🍽️", cor: "#4ade80" },
  { nome: "Transporte", emoji: "🚌", cor: "#60a5fa" },
  { nome: "Lazer", emoji: "🎮", cor: "#f472b6" },
  { nome: "Saúde", emoji: "💊", cor: "#fb923c" },
  { nome: "Moradia", emoji: "🏠", cor: "#a78bfa" },
  { nome: "Educação", emoji: "📚", cor: "#facc15" },
  { nome: "Outros", emoji: "📦", cor: "#94a3b8" },
];

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const formatBRL = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatBRLShort = (v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

function BarChart({ gastos }) {
  const totais = CATEGORIAS.map((cat) => ({
    ...cat,
    total: gastos.filter((g) => g.categoria === cat.nome).reduce((s, g) => s + g.valor, 0),
  })).filter(t => t.total > 0).sort((a, b) => b.total - a.total);
  const max = Math.max(...totais.map((t) => t.total), 1);
  if (totais.length === 0) return <p style={{ color: "#475569", textAlign: "center", fontSize: 13, padding: "20px 0" }}>Nenhum gasto registrado</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {totais.map((t) => (
        <div key={t.nome} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 24, textAlign: "center", fontSize: 14 }}>{t.emoji}</span>
          <span style={{ width: 85, fontSize: 11, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>{t.nome}</span>
          <div style={{ flex: 1, background: "#1e293b", borderRadius: 6, height: 18, overflow: "hidden" }}>
            <div style={{ width: `${(t.total / max) * 100}%`, background: `linear-gradient(90deg, ${t.cor}66, ${t.cor})`, height: "100%", borderRadius: 6, transition: "width 0.7s cubic-bezier(.4,0,.2,1)" }} />
          </div>
          <span style={{ width: 80, fontSize: 11, color: t.cor, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{formatBRL(t.total)}</span>
        </div>
      ))}
    </div>
  );
}

function AnualChart({ gastos, renda }) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const dados = MESES_SHORT.map((m, i) => ({
    mes: m, indice: i,
    total: gastos.filter(g => { const d = new Date(g.data + "T12:00:00"); return d.getMonth() === i && d.getFullYear() === ano; }).reduce((s, g) => s + g.valor, 0),
  }));
  const max = Math.max(...dados.map(d => d.total), renda, 1);
  const mesAtual = hoje.getMonth();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "0 4px" }}>
      {dados.map((d) => {
        const h = Math.max((d.total / max) * 100, d.total > 0 ? 4 : 0);
        const isCurrent = d.indice === mesAtual;
        const cor = d.total > renda ? "#f87171" : d.total > renda * 0.8 ? "#fb923c" : "#4ade80";
        return (
          <div key={d.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 9, color: d.total > 0 ? "#94a3b8" : "#334155", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{d.total > 0 ? formatBRLShort(d.total) : ""}</span>
            <div style={{ width: "100%", height: 80, display: "flex", alignItems: "flex-end" }}>
              <div style={{ width: "100%", height: `${h}%`, minHeight: d.total > 0 ? 4 : 0, background: isCurrent ? `linear-gradient(180deg, ${cor}, ${cor}88)` : `${cor}44`, borderRadius: "4px 4px 2px 2px", border: isCurrent ? `1px solid ${cor}` : "none", transition: "height 0.6s cubic-bezier(.4,0,.2,1)" }} />
            </div>
            <span style={{ fontSize: 9, color: isCurrent ? "#e2e8f0" : "#475569", fontFamily: "'DM Mono', monospace", fontWeight: isCurrent ? 700 : 400 }}>{d.mes}</span>
          </div>
        );
      })}
    </div>
  );
}

function Modal({ onClose, onSave }) {
  const hoje = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "Alimentação", data: hoje });
  const salvar = () => {
    if (!form.descricao || !form.valor || isNaN(parseFloat(form.valor))) return;
    onSave({ ...form, valor: parseFloat(form.valor) });
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#4ade80" }}>Novo gasto</p>
          <button onClick={onClose} style={{ background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <input className="input-style" placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input className="input-style" placeholder="Valor (R$)" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
          <input className="input-style" type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIAS.map(c => (
            <button key={c.nome} onClick={() => setForm({ ...form, categoria: c.nome })} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${form.categoria === c.nome ? c.cor : "#1e293b"}`, background: form.categoria === c.nome ? c.cor + "22" : "transparent", color: form.categoria === c.nome ? c.cor : "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all .15s" }}>{c.emoji} {c.nome}</button>
          ))}
        </div>
        <button onClick={salvar} style={{ background: "linear-gradient(135deg, #16a34a, #4ade80)", color: "#052e16", fontWeight: 700, padding: "14px", borderRadius: 12, border: "none", fontSize: 15, cursor: "pointer", marginTop: 4 }}>Salvar gasto</button>
      </div>
    </div>
  );
}

function MobileApp({ gastos, renda, carregando, onAdd, onDelete, onRendaChange }) {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("lista");

  const gastosMes = useMemo(() => gastos.filter(g => {
    const d = new Date(g.data + "T12:00:00");
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }), [gastos, mesAtual, anoAtual]);

  const total = gastosMes.reduce((s, g) => s + g.valor, 0);
  const saldo = renda - total;
  const pct = renda > 0 ? Math.min((total / renda) * 100, 100) : 0;
  const corBarra = pct > 85 ? "#f87171" : pct > 60 ? "#fb923c" : "#4ade80";

  const mudarMes = (dir) => {
    let m = mesAtual + dir, a = anoAtual;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMesAtual(m); setAnoAtual(a);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", color: "#e2e8f0", paddingBottom: 80, fontFamily: "'Georgia', serif" }}>
      <div style={{ padding: "20px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>Controle <span style={{ color: "#4ade80" }}>Financeiro</span></h1>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: carregando ? "#fb923c" : "#4ade80", boxShadow: `0 0 8px ${carregando ? "#fb923c" : "#4ade80"}` }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 0" }}>
        <button onClick={() => mudarMes(-1)} style={{ background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16 }}>←</button>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600 }}>{MESES_SHORT[mesAtual]} {anoAtual}</span>
        <button onClick={() => mudarMes(1)} style={{ background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16 }}>→</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px 16px 0" }}>
        {[{ label: "Gastos", valor: total, cor: "#fb923c" }, { label: "Saldo", valor: saldo, cor: saldo >= 0 ? "#4ade80" : "#f87171" }].map(item => (
          <div key={item.label} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "14px 16px" }}>
            <p style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>{item.label}</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: item.cor, fontFamily: "'DM Mono', monospace" }}>{formatBRL(item.valor)}</p>
          </div>
        ))}
      </div>

      <div style={{ margin: "10px 16px 0", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace" }}>renda mensal</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#60a5fa", fontFamily: "'DM Mono', monospace", cursor: "pointer" }}
          onClick={() => { const v = prompt("Nova renda:", renda); if (v && !isNaN(parseFloat(v))) onRendaChange(parseFloat(v)); }}>
          {formatBRL(renda)} ✎
        </span>
      </div>

      <div style={{ margin: "10px 16px 0", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>uso da renda</span>
          <span style={{ fontSize: 11, color: corBarra, fontFamily: "'DM Mono', monospace" }}>{pct.toFixed(1)}%</span>
        </div>
        <div style={{ background: "#1e293b", borderRadius: 99, height: 6 }}>
          <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${corBarra}88, ${corBarra})`, height: "100%", borderRadius: 99, transition: "width 0.6s" }} />
        </div>
      </div>

      <div style={{ display: "flex", margin: "14px 16px 0", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 4, gap: 4 }}>
        {[{ id: "lista", label: "Lançamentos" }, { id: "cats", label: "Categorias" }].map(aba => (
          <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono', monospace", transition: "all .2s", background: abaAtiva === aba.id ? "#1e293b" : "transparent", color: abaAtiva === aba.id ? "#e2e8f0" : "#475569" }}>{aba.label}</button>
        ))}
      </div>

      <div style={{ margin: "12px 16px 0", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 16 }}>
        {abaAtiva === "lista" && (
          <>
            {carregando && <p style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Carregando...</p>}
            {!carregando && gastosMes.length === 0 && <p style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Nenhum lançamento este mês</p>}
            {[...gastosMes].sort((a, b) => new Date(b.data) - new Date(a.data)).map(g => {
              const cat = CATEGORIAS.find(c => c.nome === g.categoria) || CATEGORIAS[6];
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
                  <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{g.descricao}</p>
                    <p style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{new Date(g.data + "T12:00:00").toLocaleDateString("pt-BR")} · {g.categoria}</p>
                  </div>
                  <span style={{ fontSize: 13, color: "#fb923c", fontFamily: "'DM Mono', monospace" }}>{formatBRL(g.valor)}</span>
                  <button onClick={() => onDelete(g.id)} style={{ background: "transparent", border: "none", color: "#475569", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>
                </div>
              );
            })}
          </>
        )}
        {abaAtiva === "cats" && <BarChart gastos={gastosMes} />}
      </div>

      <button onClick={() => setShowModal(true)} style={{ position: "fixed", bottom: 88, right: 20, width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #16a34a, #4ade80)", border: "none", color: "#052e16", fontSize: 28, cursor: "pointer", boxShadow: "0 4px 24px #4ade8066", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0f172a", borderTop: "1px solid #1e293b", display: "flex", padding: "8px 0 16px" }}>
        {[{ emoji: "📊", label: "Resumo" }, { emoji: "📋", label: "Gastos" }].map((item, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 20 }}>{item.emoji}</span>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {showModal && <Modal onClose={() => setShowModal(false)} onSave={async (dados) => { await onAdd(dados); setShowModal(false); }} />}
    </div>
  );
}

function DesktopApp({ gastos, renda, carregando, onAdd, onDelete, onRendaChange }) {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editandoRenda, setEditandoRenda] = useState(false);
  const [rendaTemp, setRendaTemp] = useState("");
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "Alimentação", data: hoje.toISOString().split("T")[0] });

  const gastosMes = useMemo(() => gastos.filter(g => {
    const d = new Date(g.data + "T12:00:00");
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }), [gastos, mesAtual, anoAtual]);

  const total = gastosMes.reduce((s, g) => s + g.valor, 0);
  const saldo = renda - total;
  const pct = renda > 0 ? Math.min((total / renda) * 100, 100) : 0;
  const corBarra = pct > 85 ? "#f87171" : pct > 60 ? "#fb923c" : "#4ade80";

  const mudarMes = (dir) => {
    let m = mesAtual + dir, a = anoAtual;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMesAtual(m); setAnoAtual(a);
  };

  const salvarGasto = async () => {
    if (!form.descricao || !form.valor || isNaN(parseFloat(form.valor))) return;
    await onAdd({ ...form, valor: parseFloat(form.valor) });
    setForm({ descricao: "", valor: "", categoria: "Alimentação", data: hoje.toISOString().split("T")[0] });
    setShowForm(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", color: "#e2e8f0", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column" }}>
      {/* Topbar */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>Controle <span style={{ color: "#4ade80" }}>Financeiro</span></h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: carregando ? "#fb923c" : "#4ade80", boxShadow: `0 0 8px ${carregando ? "#fb923c" : "#4ade80"}` }} />
            <span style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{carregando ? "sincronizando..." : "sincronizado"}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => mudarMes(-1)} style={{ background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>←</button>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, minWidth: 180, textAlign: "center" }}>{MESES[mesAtual]} {anoAtual}</span>
          <button onClick={() => mudarMes(1)} style={{ background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>→</button>
          <button onClick={() => setShowForm(!showForm)} style={{ background: "linear-gradient(135deg, #16a34a, #4ade80)", color: "#052e16", fontWeight: 700, padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 13, cursor: "pointer" }}>
            {showForm ? "✕ Cancelar" : "+ Novo gasto"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
        {showForm && (
          <div style={{ background: "#0f172a", border: "1px solid #4ade8033", borderRadius: 16, padding: 20, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 6 }}>descrição</label>
              <input className="input-style" placeholder="Ex: Supermercado" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} onKeyDown={e => e.key === "Enter" && salvarGasto()} autoFocus />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 6 }}>valor</label>
              <input className="input-style" placeholder="0,00" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} onKeyDown={e => e.key === "Enter" && salvarGasto()} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 6 }}>data</label>
              <input className="input-style" type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 6 }}>categoria</label>
              <select className="input-style" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}
              </select>
            </div>
            <button onClick={salvarGasto} style={{ background: "linear-gradient(135deg, #16a34a, #4ade80)", color: "#052e16", fontWeight: 700, padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>Salvar ↵</button>
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { label: "Renda", valor: renda, cor: "#60a5fa", editar: true },
            { label: "Total gasto", valor: total, cor: "#fb923c" },
            { label: "Saldo", valor: saldo, cor: saldo >= 0 ? "#4ade80" : "#f87171" },
            { label: "Lançamentos", valor: gastosMes.length, cor: "#a78bfa", isCount: true },
          ].map(item => (
            <div key={item.label} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "16px 20px" }}>
              <p style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>{item.label}</p>
              {item.editar && editandoRenda ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input-style" style={{ fontSize: 13 }} value={rendaTemp} onChange={e => setRendaTemp(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { onRendaChange(parseFloat(rendaTemp)); setEditandoRenda(false); } }} autoFocus />
                  <button onClick={() => { onRendaChange(parseFloat(rendaTemp)); setEditandoRenda(false); }} style={{ background: "#1e293b", border: "none", color: "#4ade80", borderRadius: 8, padding: "0 10px", cursor: "pointer" }}>ok</button>
                </div>
              ) : (
                <p style={{ fontSize: 20, fontWeight: 700, color: item.cor, fontFamily: "'DM Mono', monospace", cursor: item.editar ? "pointer" : "default" }}
                  onClick={() => { if (item.editar) { setRendaTemp(String(renda)); setEditandoRenda(true); } }}
                  title={item.editar ? "Clique para editar" : ""}>
                  {item.isCount ? item.valor : formatBRL(item.valor)}{item.editar && <span style={{ fontSize: 12, marginLeft: 6, color: "#334155" }}>✎</span>}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Barra */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "14px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>uso da renda em {MESES[mesAtual]}</span>
            <span style={{ fontSize: 12, color: corBarra, fontFamily: "'DM Mono', monospace" }}>{pct.toFixed(1)}% de {formatBRL(renda)}</span>
          </div>
          <div style={{ background: "#1e293b", borderRadius: 99, height: 8 }}>
            <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${corBarra}88, ${corBarra})`, height: "100%", borderRadius: 99, transition: "width 0.6s" }} />
          </div>
        </div>

        {/* Grid principal */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 20 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, marginBottom: 16 }}>Por categoria</p>
              <BarChart gastos={gastosMes} />
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 20 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, marginBottom: 16 }}>Visão anual · {anoAtual}</p>
              <AnualChart gastos={gastos} renda={renda} />
            </div>
          </div>

          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16 }}>Lançamentos</p>
              <span style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{gastosMes.length} itens</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 32px", gap: 8, padding: "0 0 8px", borderBottom: "1px solid #1e293b" }}>
              {["Descrição","Categoria","Data","Valor",""].map((h, i) => (
                <span key={i} style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: 1 }}>{h}</span>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", marginTop: 4 }}>
              {carregando && <p style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Carregando...</p>}
              {!carregando && gastosMes.length === 0 && <p style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Nenhum lançamento este mês</p>}
              {[...gastosMes].sort((a, b) => new Date(b.data) - new Date(a.data)).map(g => {
                const cat = CATEGORIAS.find(c => c.nome === g.categoria) || CATEGORIAS[6];
                return (
                  <div key={g.id} className="row-table" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 32px", gap: 8, padding: "10px 0", borderBottom: "1px solid #0f1a2e", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.descricao}</span>
                    </div>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 10, background: cat.cor + "22", color: cat.cor, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.categoria}</span>
                    <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>{new Date(g.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                    <span style={{ fontSize: 13, color: "#fb923c", fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{formatBRL(g.valor)}</span>
                    <button onClick={() => onDelete(g.id)} className="del-btn" style={{ opacity: 0, background: "transparent", border: "none", color: "#f87171", fontSize: 16, cursor: "pointer", padding: "0 4px", transition: "opacity .2s" }}>×</button>
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

export default function App() {
  const [gastos, setGastos] = useState([]);
  const [renda, setRenda] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "gastos"), (snap) => {
      setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDoc(doc(db, "config", "renda")).then(d => { if (d.exists()) setRenda(d.data().valor); });
  }, []);

  const onAdd = (dados) => addDoc(collection(db, "gastos"), dados);
  const onDelete = (id) => deleteDoc(doc(db, "gastos", id));
  const onRendaChange = async (val) => {
    const v = isNaN(val) ? renda : val;
    setRenda(v);
    await setDoc(doc(db, "config", "renda"), { valor: v });
  };

  const props = { gastos, renda, carregando, onAdd, onDelete, onRendaChange };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, button { outline: none; font-family: inherit; }
        .input-style { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 10px 14px; color: #e2e8f0; font-size: 14px; width: 100%; transition: border .2s; font-family: 'DM Mono', monospace; }
        .input-style:focus { border-color: #4ade80; }
        .row-table:hover .del-btn { opacity: 1 !important; }
      `}</style>
      {isMobile ? <MobileApp {...props} /> : <DesktopApp {...props} />}
    </>
  );
}