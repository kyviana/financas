const TelegramBot = require("node-telegram-bot-api");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const cron = require("node-cron");

// ── Config ────────────────────────────────────────────────
const BOT_TOKEN   = process.env.BOT_TOKEN;
const CHAT_ID     = process.env.CHAT_ID;
const FUSO        = "America/Fortaleza"; // UTC-3

// Firebase Admin (usa variável de ambiente com o JSON da service account)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ── Categorias ────────────────────────────────────────────
const CATS_GASTO = [
  "Alimentação","Transporte","Lazer","Saúde","Moradia","Educação","Família","Contas","Empréstimo/Cartão","E-commerce","Outros"
];
const CATS_ENTRADA = [
  "Salário","Freelance","Investimento","Presente","Outros"
];
const EMOJIS_GASTO = {
  "Alimentação":"🍽️","Transporte":"🚌","Lazer":"🎮",
  "Saúde":"💊","Moradia":"🏠","Educação":"📚",
  "Família":"👨‍👩‍👧","Contas":"📄","Empréstimo/Cartão":"💳","E-commerce":"🛒","Outros":"📦"
};
const EMOJIS_ENTRADA = {
  "Salário":"💼","Freelance":"💻","Investimento":"📈",
  "Presente":"🎁","Outros":"📦"
};

// ── Estado por usuário ────────────────────────────────────
// Guarda o fluxo de conversa enquanto o usuário está registrando
const estado = {}; // { chatId: { etapa, tipo, descricao, valor, data } }

const fBRL = v => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const hoje = () => new Date().toLocaleDateString("pt-BR", { timeZone: FUSO });
const hojeISO = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: FUSO }));
  return d.toISOString().split("T")[0];
};

// ── Resumo do mês atual ───────────────────────────────────
async function getResumoMes() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: FUSO }));
  const mes = now.getMonth();
  const ano = now.getFullYear();

  const snapG = await db.collection("gastos").get();
  const snapE = await db.collection("entradas").get();

  const gastosMes   = snapG.docs.map(d => d.data()).filter(g => {
    const d = new Date(g.data + "T12:00:00");
    return d.getMonth() === mes && d.getFullYear() === ano;
  });
  const entradasMes = snapE.docs.map(d => d.data()).filter(e => {
    const d = new Date(e.data + "T12:00:00");
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const totalG = gastosMes.reduce((s, g) => s + g.valor, 0);
  const totalE = entradasMes.reduce((s, e) => s + e.valor, 0);
  const saldo  = totalE - totalG;
  const pct    = totalE > 0 ? (totalG / totalE) * 100 : 0;

  let statusEmoji = "✅";
  let statusTexto = "Saudável";
  if (pct > 100) { statusEmoji = "🔴"; statusTexto = "Estourado"; }
  else if (pct > 80) { statusEmoji = "⚠️"; statusTexto = "Crítico"; }
  else if (pct > 60) { statusEmoji = "🟡"; statusTexto = "Razoável"; }

  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  return { totalG, totalE, saldo, pct, statusEmoji, statusTexto, mes: meses[mes], ano, gastosMes };
}

// ── Lembrete diário às 21h ────────────────────────────────
// Cron no fuso de Fortaleza (UTC-3) → 21h local = 00:00 UTC
cron.schedule("0 0 * * *", async () => {
  try {
    const { totalG, totalE, saldo, pct, statusEmoji, statusTexto, mes } = await getResumoMes();
    const msg =
`💰 *Finanças Pessoais — Lembrete Noturno*

Boa noite! Você registrou todos os seus gastos de hoje? 😊

📅 *${hoje()}*
${statusEmoji} Status: *${statusTexto}* (${pct.toFixed(1)}% comprometido)
├ Entradas: ${fBRL(totalE)}
├ Gastos:   ${fBRL(totalG)}
└ Saldo:    ${saldo >= 0 ? "✅" : "❌"} *${fBRL(saldo)}*

Toque em um botão abaixo para registrar rapidinho 👇`;

    await bot.sendMessage(CHAT_ID, msg, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "➕ Registrar entrada", callback_data: "novo_entrada" },
          { text: "➖ Registrar gasto",   callback_data: "novo_gasto"   },
        ],[
          { text: "✅ Tudo registrado, obrigada!", callback_data: "tudo_ok" },
        ]]
      }
    });
  } catch (err) {
    console.error("Erro no lembrete:", err);
  }
}, { timezone: "UTC" }); // dispara meia-noite UTC = 21h Fortaleza

// ── /start ────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
`👋 Olá! Eu sou o bot do seu *Finanças Pessoais*!

Aqui você pode:
• Registrar gastos e entradas direto pelo Telegram
• Ver o resumo do mês
• Todo dia às *21h* recebo um lembrete automático

*Comandos disponíveis:*
/gasto — registrar um gasto
/entrada — registrar uma entrada
/resumo — ver resumo do mês atual
/hoje — ver gastos de hoje
/cancelar — cancelar o que estiver fazendo

Ou use os botões que aparecem nos lembretes! 🚀`,
    { parse_mode: "Markdown" }
  );
});

// ── /resumo ───────────────────────────────────────────────
bot.onText(/\/resumo/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const { totalG, totalE, saldo, pct, statusEmoji, statusTexto, mes, ano } = await getResumoMes();
    bot.sendMessage(chatId,
`📊 *Resumo de ${mes} ${ano}*

${statusEmoji} Saúde: *${statusTexto}* — ${pct.toFixed(1)}% comprometido

💰 Entradas: *${fBRL(totalE)}*
💸 Gastos:   *${fBRL(totalG)}*
💵 Saldo:    *${fBRL(saldo)}*

_Acesse o app para ver detalhes por categoria._`,
      { parse_mode: "Markdown" }
    );
  } catch(e) {
    bot.sendMessage(chatId, "❌ Erro ao buscar resumo. Tente novamente.");
  }
});

// ── /hoje ─────────────────────────────────────────────────
bot.onText(/\/hoje/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const { gastosMes } = await getResumoMes();
    const hj = hojeISO();
    const gastosHoje = gastosMes.filter(g => g.data === hj);
    if (gastosHoje.length === 0) {
      return bot.sendMessage(chatId, "📭 Nenhum gasto registrado hoje ainda.");
    }
    const total = gastosHoje.reduce((s, g) => s + g.valor, 0);
    const lista = gastosHoje.map(g =>
      `• ${EMOJIS_GASTO[g.categoria] || "📦"} ${g.descricao} — *${fBRL(g.valor)}*`
    ).join("\n");
    bot.sendMessage(chatId,
`📅 *Gastos de hoje (${hoje()})*\n\n${lista}\n\n💸 Total: *${fBRL(total)}*`,
      { parse_mode: "Markdown" }
    );
  } catch(e) {
    bot.sendMessage(chatId, "❌ Erro ao buscar gastos de hoje.");
  }
});

// ── /cancelar ─────────────────────────────────────────────
bot.onText(/\/cancelar/, (msg) => {
  delete estado[msg.chat.id];
  bot.sendMessage(msg.chat.id, "❌ Cancelado. Use /gasto ou /entrada para começar de novo.");
});

// ── Iniciar fluxo gasto ───────────────────────────────────
function iniciarGasto(chatId) {
  estado[chatId] = { etapa: "desc_gasto", tipo: "gasto", data: hojeISO() };
  bot.sendMessage(chatId,
    "➖ *Novo gasto*\n\nQual foi o gasto? _(ex: Almoço, Uber, Mercado)_",
    { parse_mode: "Markdown" }
  );
}

// ── Iniciar fluxo entrada ─────────────────────────────────
function iniciarEntrada(chatId) {
  estado[chatId] = { etapa: "cat_entrada", tipo: "entrada", data: hojeISO() };
  bot.sendMessage(chatId,
    "➕ *Nova entrada*\n\nQual o tipo da entrada?",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: CATS_ENTRADA.map(c => ([{
          text: `${EMOJIS_ENTRADA[c]} ${c}`,
          callback_data: `cat_entrada_${c}`
        }]))
      }
    }
  );
}

bot.onText(/\/gasto/,   (msg) => iniciarGasto(msg.chat.id));
bot.onText(/\/entrada/, (msg) => iniciarEntrada(msg.chat.id));

// ── Callback dos botões inline ────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data;
  await bot.answerCallbackQuery(query.id);

  if (data === "novo_gasto")    return iniciarGasto(chatId);
  if (data === "novo_entrada")  return iniciarEntrada(chatId);
  if (data === "tudo_ok") {
    return bot.sendMessage(chatId, "✅ Ótimo! Até amanhã às 21h 😊");
  }

  // Categoria entrada selecionada
  if (data.startsWith("cat_entrada_")) {
    const cat = data.replace("cat_entrada_", "");
    estado[chatId] = {
      etapa: "valor_entrada", tipo: "entrada",
      categoria: cat, descricao: cat, data: hojeISO()
    };
    bot.sendMessage(chatId,
      `${EMOJIS_ENTRADA[cat]} *${cat}*\n\nQual o valor? _(só o número, ex: 1500)_`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Categoria gasto selecionada
  if (data.startsWith("cat_gasto_")) {
    const cat = data.replace("cat_gasto_", "");
    estado[chatId].categoria = cat;
    estado[chatId].etapa = "data_confirm";
    const hj = hojeISO().split("-").reverse().join("/");
    bot.sendMessage(chatId,
      `${EMOJIS_GASTO[cat]} Categoria: *${cat}*\n\nA data é hoje (${hj})?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Sim, hoje",         callback_data: "data_hoje"   },
            { text: "📅 Não, outra data",   callback_data: "data_outra"  },
          ]]
        }
      }
    );
    return;
  }

  if (data === "data_hoje") {
    await salvarLancamento(chatId);
    return;
  }

  if (data === "data_outra") {
    estado[chatId].etapa = "data_manual";
    bot.sendMessage(chatId, "📅 Digite a data no formato *DD/MM/AAAA*:", { parse_mode: "Markdown" });
    return;
  }
});

// ── Fluxo de mensagens de texto ───────────────────────────
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text   = msg.text?.trim();
  if (!text || text.startsWith("/")) return;

  const s = estado[chatId];
  if (!s) {
    // Entrada rápida: "gasto 35 uber" ou "entrada 1500 salário"
    const matchG = text.match(/^(?:gasto|gastei)\s+([\d.,]+)\s+(.+)/i);
    const matchE = text.match(/^(?:entrada|recebi|ganhei)\s+([\d.,]+)(?:\s+(.+))?/i);
    if (matchG) {
      const valor = parseFloat(matchG[1].replace(",", "."));
      const desc  = matchG[2];
      await db.collection("gastos").add({ descricao: desc, valor, categoria: "Outros", data: hojeISO() });
      return bot.sendMessage(chatId,
        `✅ Gasto salvo!\n📦 *${desc}* — ${fBRL(valor)}\n_Categoria: Outros — edite no app se quiser._`,
        { parse_mode: "Markdown" }
      );
    }
    if (matchE) {
      const valor = parseFloat(matchE[1].replace(",", "."));
      const desc  = matchE[2] || "Entrada";
      await db.collection("entradas").add({ descricao: desc, valor, categoria: "Outros", data: hojeISO() });
      return bot.sendMessage(chatId,
        `✅ Entrada salva!\n💰 *${desc}* — ${fBRL(valor)}`,
        { parse_mode: "Markdown" }
      );
    }
    return bot.sendMessage(chatId,
      `💡 Use /gasto ou /entrada para registrar.\n\nOu envie direto:\n• _gasto 35 almoço_\n• _entrada 1500 salário_`,
      { parse_mode: "Markdown" }
    );
  }

  // ── Etapas do fluxo ──
  if (s.etapa === "desc_gasto") {
    s.descricao = text;
    s.etapa = "valor_gasto";
    bot.sendMessage(chatId, `📝 *${text}*\n\nQual o valor? _(só o número, ex: 35.50)_`, { parse_mode: "Markdown" });
    return;
  }

  if (s.etapa === "valor_gasto" || s.etapa === "valor_entrada") {
    const valor = parseFloat(text.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      return bot.sendMessage(chatId, "❌ Valor inválido. Digite só o número, ex: *35.50*", { parse_mode: "Markdown" });
    }
    s.valor = valor;
    if (s.etapa === "valor_entrada") {
      s.etapa = "data_confirm_entrada";
      const hj = hojeISO().split("-").reverse().join("/");
      bot.sendMessage(chatId,
        `💰 Valor: *${fBRL(valor)}*\n\nA data é hoje (${hj})?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Sim, hoje",       callback_data: "data_hoje"  },
              { text: "📅 Outra data",      callback_data: "data_outra" },
            ]]
          }
        }
      );
    } else {
      s.etapa = "cat_gasto";
      bot.sendMessage(chatId,
        `💰 Valor: *${fBRL(valor)}*\n\nQual a categoria?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: CATS_GASTO.map(c => ([{
              text: `${EMOJIS_GASTO[c]} ${c}`,
              callback_data: `cat_gasto_${c}`
            }]))
          }
        }
      );
    }
    return;
  }

  // Entrada rápida de data manual
  if (s.etapa === "data_manual" || s.etapa === "data_manual_entrada") {
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      return bot.sendMessage(chatId, "❌ Formato inválido. Use *DD/MM/AAAA*, ex: 15/01/2026", { parse_mode: "Markdown" });
    }
    s.data = `${match[3]}-${match[2]}-${match[1]}`;
    await salvarLancamento(chatId);
    return;
  }
});

// Tratar confirm data entrada via callback
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const s = estado[chatId];
  if (!s) return;
  if (query.data === "data_hoje" && s.etapa === "data_confirm_entrada") {
    await salvarLancamento(chatId);
  }
  if (query.data === "data_outra" && s.etapa === "data_confirm_entrada") {
    s.etapa = "data_manual_entrada";
    bot.sendMessage(chatId, "📅 Digite a data no formato *DD/MM/AAAA*:", { parse_mode: "Markdown" });
  }
});

// ── Salvar no Firebase ────────────────────────────────────
async function salvarLancamento(chatId) {
  const s = estado[chatId];
  try {
    if (s.tipo === "gasto") {
      await db.collection("gastos").add({
        descricao: s.descricao,
        valor:     s.valor,
        categoria: s.categoria,
        data:      s.data,
      });
      bot.sendMessage(chatId,
        `✅ *Gasto salvo com sucesso!*\n\n${EMOJIS_GASTO[s.categoria]} *${s.descricao}*\n💸 ${fBRL(s.valor)} — ${s.categoria}\n📅 ${s.data.split("-").reverse().join("/")}`,
        { parse_mode: "Markdown" }
      );
    } else {
      await db.collection("entradas").add({
        descricao: s.descricao,
        valor:     s.valor,
        categoria: s.categoria,
        data:      s.data,
      });
      bot.sendMessage(chatId,
        `✅ *Entrada salva com sucesso!*\n\n${EMOJIS_ENTRADA[s.categoria]} *${s.descricao}*\n💰 ${fBRL(s.valor)} — ${s.categoria}\n📅 ${s.data.split("-").reverse().join("/")}`,
        { parse_mode: "Markdown" }
      );
    }
  } catch(e) {
    bot.sendMessage(chatId, "❌ Erro ao salvar. Tente novamente.");
    console.error(e);
  }
  delete estado[chatId];
}

console.log("🤖 Bot Finanças iniciado!");