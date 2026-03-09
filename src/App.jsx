import { useState, useMemo } from "react";

const CATEGORIAS = [
  { nome: "Alimentação", emoji: "🍽️", cor: "#4ade80" },
  { nome: "Transporte", emoji: "🚌", cor: "#60a5fa" },
  { nome: "Lazer", emoji: "🎮", cor: "#f472b6" },
  { nome: "Saúde", emoji: "💊", cor: "#fb923c" },
  { nome: "Moradia", emoji: "🏠", cor: "#a78bfa" },
  { nome: "Educação", emoji: "📚", cor: "#facc15" },
  { nome: "Outros", emoji: "📦", cor: "#94a3b8" },
];

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const formatBRL = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function BarChart({ categorias, gastos }) {
  const totais = categorias.map((cat) => ({
    ...cat,
    total: gastos.filter((g) => g.categoria === cat.nome).reduce((s, g) => s + g.valor, 0),
  }));
  const max = Math.max(...totais.map((t) => t.total), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {totais.filter(t => t.total > 0).sort((a, b) => b.total - a.total).map((t) => (
        <div key={t.nome} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 28, textAlign: "center", fontSize: 16 }}>{t.emoji}</span>
          <span style={{ width: 90, fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{t.nome}</span>
          <div style={{ flex: 1, background: "#1e293b", borderRadius: 6, height: 20, overflow: "hidden" }}>
            <div
              style={{
                width: `${(t.total / max) * 100}%`,
                background: `linear-gradient(90deg, ${t.cor}88, ${t.cor})`,
                height: "100%",
                borderRadius: 6,
                transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
              }}
            />
          </div>
          <span style={{ width: 90, fontSize: 12, color: t.cor, textAlign: "right", fontFamily: "monospace" }}>
            {formatBRL(t.total)}
          </span>
        </div>
      ))}
      {totais.every(t => t.total === 0) && (
        <p style={{ color: "#475569", textAlign: "center", fontSize: 13 }}>Nenhum gasto registrado ainda</p>
      )}
    </div>
  );
}

export default function App() {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
  const [gastos, setGastos] = useState([
    { id: 1, descricao: "Supermercado", valor: 320, categoria: "Alimentação", data: `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-05` },
    { id: 2, descricao: "Uber", valor: 45, categoria: "Transporte", data: `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-07` },
    { id: 3, descricao: "Netflix", valor: 39.9, categoria: "Lazer", data: `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01` },
    { id: 4, descricao: "Aluguel", valor: 1200, categoria: "Moradia", data: `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-05` },
  ]);
  const [renda, setRenda] = useState(4000);
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "Alimentação", data: hoje.toISOString().split("T")[0] });
  const [editandoRenda, setEditandoRenda] = useState(false);
  const [rendaTemp, setRendaTemp] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

  const gastosMes = useMemo(() =>
    gastos.filter((g) => {
      const d = new Date(g.data + "T12:00:00");
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    }),
    [gastos, mesAtual, anoAtual]
  );

  const totalGastos = gastosMes.reduce((s, g) => s + g.valor, 0);
  const saldo = renda - totalGastos;
  const pct = Math.min((totalGastos / renda) * 100, 100);

  const addGasto = () => {
    if (!form.descricao || !form.valor || isNaN(parseFloat(form.valor))) return;
    setGastos([...gastos, { ...form, id: Date.now(), valor: parseFloat(form.valor) }]);
    setForm({ descricao: "", valor: "", categoria: "Alimentação", data: hoje.toISOString().split("T")[0] });
    setMostrarForm(false);
  };

  const removerGasto = (id) => setGastos(gastos.filter((g) => g.id !== id));

  const mudarMes = (dir) => {
    let m = mesAtual + dir;
    let a = anoAtual;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMesAtual(m);
    setAnoAtual(a);
  };

  const corSaldo = saldo >= 0 ? "#4ade80" : "#f87171";
  const corBarra = pct > 85 ? "#f87171" : pct > 60 ? "#fb923c" : "#4ade80";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f1e",
      fontFamily: "'Georgia', serif",
      color: "#e2e8f0",
      padding: "24px 16px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select { outline: none; }
        button { cursor: pointer; border: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0f172a; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 20px; }
        .btn-ghost { background: transparent; color: #64748b; padding: 6px 12px; border-radius: 8px; font-size: 13px; transition: all .2s; }
        .btn-ghost:hover { background: #1e293b; color: #e2e8f0; }
        .btn-primary { background: linear-gradient(135deg, #16a34a, #4ade80); color: #052e16; font-weight: 700; padding: 10px 20px; border-radius: 10px; font-size: 14px; transition: all .2s; letter-spacing: .3px; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px #4ade8044; }
        .input-style { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 10px 14px; color: #e2e8f0; font-size: 14px; width: 100%; transition: border .2s; font-family: 'DM Mono', monospace; }
        .input-style:focus { border-color: #4ade80; }
        .tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-family: 'DM Mono', monospace; }
        .row-gasto { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #1e293b; transition: background .15s; }
        .row-gasto:last-child { border-bottom: none; }
        .del-btn { opacity: 0; transition: opacity .2s; background: transparent; color: #f87171; font-size: 16px; padding: 2px 6px; border-radius: 6px; }
        .row-gasto:hover .del-btn { opacity: 1; }
      `}</style>

      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
              Controle <span style={{ color: "#4ade80" }}>Financeiro</span>
            </h1>
            <p style={{ color: "#475569", fontSize: 12, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>pessoal · {anoAtual}</p>
          </div>
          <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? "✕ Cancelar" : "+ Adicionar"}
          </button>
        </div>

        {/* Seletor de mês */}
        <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
          <button className="btn-ghost" onClick={() => mudarMes(-1)}>←</button>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600 }}>
            {MESES[mesAtual]} {anoAtual}
          </span>
          <button className="btn-ghost" onClick={() => mudarMes(1)}>→</button>
        </div>

        {/* Cards resumo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { label: "Renda", valor: renda, cor: "#60a5fa", editar: true },
            { label: "Gastos", valor: totalGastos, cor: "#fb923c" },
            { label: "Saldo", valor: saldo, cor: corSaldo },
          ].map((item) => (
            <div key={item.label} className="card" style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>{item.label}</p>
              {item.editar && editandoRenda ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    className="input-style"
                    style={{ textAlign: "center", fontSize: 13 }}
                    value={rendaTemp}
                    onChange={e => setRendaTemp(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { setRenda(parseFloat(rendaTemp) || renda); setEditandoRenda(false); }}}
                    autoFocus
                  />
                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => { setRenda(parseFloat(rendaTemp) || renda); setEditandoRenda(false); }}>ok</button>
                </div>
              ) : (
                <p
                  style={{ fontSize: 15, fontWeight: 700, color: item.cor, fontFamily: "'DM Mono', monospace", cursor: item.editar ? "pointer" : "default" }}
                  onClick={() => { if (item.editar) { setRendaTemp(String(renda)); setEditandoRenda(true); }}}
                  title={item.editar ? "Clique para editar" : ""}
                >
                  {formatBRL(item.valor)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Barra de progresso */}
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>uso da renda</span>
            <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: corBarra }}>{pct.toFixed(1)}%</span>
          </div>
          <div style={{ background: "#1e293b", borderRadius: 99, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${corBarra}88, ${corBarra})`, height: "100%", borderRadius: 99, transition: "width 0.6s cubic-bezier(.4,0,.2,1)" }} />
          </div>
        </div>

        {/* Formulário */}
        {mostrarForm && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid #4ade8033" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#4ade80" }}>Novo gasto</p>
            <input className="input-style" placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input className="input-style" placeholder="Valor (R$)" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
              <input className="input-style" type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </div>
            <select className="input-style" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
              {CATEGORIAS.map(c => <option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}
            </select>
            <button className="btn-primary" onClick={addGasto} style={{ alignSelf: "flex-end" }}>Salvar gasto</button>
          </div>
        )}

        {/* Gráfico por categoria */}
        <div className="card">
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, marginBottom: 16 }}>Por categoria</p>
          <BarChart categorias={CATEGORIAS} gastos={gastosMes} />
        </div>

        {/* Lista de gastos */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16 }}>Lançamentos</p>
            <span style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{gastosMes.length} itens</span>
          </div>
          {gastosMes.length === 0 && (
            <p style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Nenhum lançamento este mês</p>
          )}
          {[...gastosMes].sort((a, b) => new Date(b.data) - new Date(a.data)).map((g) => {
            const cat = CATEGORIAS.find(c => c.nome === g.categoria) || CATEGORIAS[6];
            return (
              <div key={g.id} className="row-gasto">
                <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{g.descricao}</p>
                  <p style={{ fontSize: 11, color: "#475569", fontFamily: "'DM Mono', monospace" }}>{new Date(g.data + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="tag" style={{ background: cat.cor + "22", color: cat.cor }}>{g.categoria}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#fb923c", minWidth: 90, textAlign: "right" }}>
                  {formatBRL(g.valor)}
                </span>
                <button className="del-btn" onClick={() => removerGasto(g.id)}>×</button>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#1e293b", fontFamily: "'DM Mono', monospace", paddingBottom: 8 }}>
          feito com claude ✦
        </p>
      </div>
    </div>
  );
}