import {
  login, logout, onUser, nextNumero, saveContrato, listContratos, getContrato
} from "./firebase-service.js";

/* ---------- Referências e constantes ---------- */
const $ = (s) => document.querySelector(s);
const form = $("#form");
const docEl = $("#doc");
const KEY = { cfg: "evt.config", atual: "evt.atual" };

const SERVICOS = {
  site: "Desenvolvimento de sites",
  sistema: "Desenvolvimento de sistemas",
  app: "Desenvolvimento de aplicativos",
  automacao: "Automações e integrações",
  outros: "Outros serviços tecnológicos"
};
const CATEGORIAS = { site: "Sites e plataformas web", app: "Aplicativos", sistema: "Sistemas" };
const PLANOS = { basico: "Básico", profissional: "Profissional", premium: "Premium" };

const RESP_EVT = [
  "Executar os serviços conforme o escopo aprovado.",
  "Manter comunicação sobre o andamento do projeto.",
  "Entregar os itens contratados.",
  "Corrigir defeitos de desenvolvimento cobertos pela garantia.",
  "Preservar informações e dados do cliente conforme as obrigações legais aplicáveis."
];
const RESP_CLI = [
  "Fornecer informações e materiais necessários.",
  "Realizar pagamentos nos prazos estabelecidos.",
  "Aprovar as etapas do projeto.",
  "Verificar e aprovar os entregáveis.",
  "Garantir que possui autorização para utilizar os materiais fornecidos."
];

const DEFAULTS = {
  c_email: "evoluatechbr@gmail.com",
  c_nome: "EVOLUATECH",
  entrada_pct: "50",
  parcelas: "1",
  cl_marketing:
    "A EVOLUATECH não oferece serviços de marketing digital como parte automática do desenvolvimento contratado.\n" +
    "Não estão incluídos: gerenciamento de redes sociais; criação de campanhas publicitárias; gestão de tráfego pago; " +
    "estratégias de marketing e divulgação; produção de conteúdo para redes sociais; fotografia e gravação de vídeos.\n" +
    "Caso o projeto necessite de fotografias ou vídeos para compor o site, aplicativo ou sistema, esses materiais poderão ser " +
    "fornecidos pelo CONTRATANTE ou contratados separadamente, mediante orçamento e aprovação. Sua produção não está incluída no valor do desenvolvimento.",
  cl_garantia:
    "A EVOLUATECH oferece garantia técnica de 90 (noventa) dias, contados a partir da entrega e aprovação do projeto pelo CONTRATANTE, " +
    "destinada exclusivamente à identificação e correção, sem custo adicional, de bugs, falhas ou erros técnicos diretamente relacionados " +
    "ao desenvolvimento realizado e em desacordo com o escopo aprovado.\n" +
    "Não cobre: criação de novas funcionalidades; alterações de design ou layout solicitadas após a aprovação; modificações decorrentes de novas " +
    "necessidades; problemas causados por terceiros; falhas em serviços externos, APIs, servidores ou plataformas de terceiros; uso inadequado ou " +
    "intervenções não autorizadas; manutenção preventiva, atualizações periódicas e melhorias evolutivas.\n" +
    "As solicitações serão analisadas tecnicamente. Caso o problema não esteja coberto, poderá ser apresentado orçamento separado. " +
    "A garantia é independente dos planos mensais de suporte. Os direitos assegurados pelo Código de Defesa do Consumidor, quando aplicável, não são afastados por este contrato.",
  cl_cancelamento:
    "O cancelamento do projeto ou a rescisão contratual deverá ser comunicado por escrito. Serão pagos os valores relativos aos serviços já executados " +
    "e entregues, bem como os valores pendentes até a data do encerramento.\n" +
    "O cancelamento dos planos mensais surte efeito a partir do período seguinte ao pedido, observadas as condições contratuais.\n" +
    "Encerrado o contrato, permanecem as obrigações de confidencialidade e de tratamento de dados pessoais previstas na LGPD."
};

const REQUIRED = ["c_nome", "k_nome", "projeto_nome", "valor_total"];

/* ---------- Utilitários ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s) => (s ? s.split("-").reverse().join("/") : "—");
const txt = (s, fallback = "—") =>
  s && String(s).trim() ? esc(s).replace(/\n/g, "<br>") : `<span class="empty">${fallback}</span>`;
const paras = (s) => (s || "").split("\n").filter((l) => l.trim()).map((l) => `<p>${esc(l)}</p>`).join("");
const list = (arr) => `<ul>${arr.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
const hoje = () => new Date().toISOString().slice(0, 10);
const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };

let usuario = null;
let ocupado = false;

/* ---------- Leitura e preenchimento ---------- */
function collect() {
  const d = {};
  form.querySelectorAll("input,select,textarea").forEach((el) => {
    const key = el.dataset.group || el.name;
    if (!key) return;
    if (el.dataset.group) {
      d[key] = d[key] || [];
      if (el.checked) d[key].push(el.value);
    } else if (el.type === "checkbox") d[key] = el.checked;
    else if (el.type === "radio") { if (el.checked) d[key] = el.value; }
    else d[key] = el.value;
  });
  return d;
}

function fill(d) {
  form.querySelectorAll("input,select,textarea").forEach((el) => {
    const key = el.dataset.group || el.name;
    if (!key || d[key] === undefined) return;
    const v = d[key];
    if (el.dataset.group) el.checked = Array.isArray(v) && v.includes(el.value);
    else if (el.type === "checkbox") el.checked = !!v;
    else if (el.type === "radio") el.checked = v === el.value;
    else el.value = v;
  });
}

/* ---------- Cálculos financeiros ---------- */
function calc(d) {
  const total = parseFloat(d.valor_total) || 0;
  const pct = Math.min(100, Math.max(0, parseFloat(d.entrada_pct) || 0));
  const entrada = (total * pct) / 100;
  const saldo = total - entrada;
  const n = Math.max(1, parseInt(d.parcelas, 10) || 1);
  return { total, pct, entrada, saldo, n, parcela: saldo / n };
}

function updateResumo(d) {
  const f = calc(d);
  $("#resumo").innerHTML =
    `<div><small>Entrada</small><strong>${brl(f.entrada)}</strong></div>` +
    `<div><small>Saldo</small><strong>${brl(f.saldo)}</strong></div>` +
    `<div><small>Parcelas do saldo</small><strong>${f.n}× ${brl(f.parcela)}</strong></div>` +
    `<div><small>Valor total</small><strong>${brl(f.total)}</strong></div>`;
}

/* ---------- Renderização do contrato ---------- */
function renderDoc(d) {
  const f = calc(d);
  const servs = (d.servicos || []).map((k) => SERVICOS[k]).filter(Boolean);
  const cats = (d.categorias || []).map((k) => CATEGORIAS[k]).filter(Boolean);
  const pl = d.plano;

  const kv = (rows) => `<table class="kv">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;
  const sec = (n, t, body) => `<section class="sec"><h2><span>${String(n).padStart(2, "0")}</span>${t}</h2>${body}</section>`;
  const parte = (p) => kv([
    ["Nome / Razão social", txt(d[`${p}_nome`])],
    ["CPF/CNPJ", txt(d[`${p}_doc`])],
    ["Endereço", txt(d[`${p}_endereco`])],
    ["E-mail", txt(d[`${p}_email`])],
    ["Telefone", txt(d[`${p}_telefone`])]
  ]);

  const planoHTML = d.plano_ativo && PLANOS[pl]
    ? kv([
        ["Plano", PLANOS[pl]],
        ["Valor mensal", d[`plano_${pl}_valor`] ? brl(d[`plano_${pl}_valor`]) : txt("", "A definir")],
        ["Horas de atendimento", txt(d[`plano_${pl}_horas`])],
        ["Limite de alterações", txt(d[`plano_${pl}_limite`])],
        ["Prazo de atendimento", txt(d[`plano_${pl}_prazo`])],
        ["Categorias cobertas", cats.length ? cats.join(", ") : "—"],
        ["Serviços incluídos", txt(d[`plano_${pl}_servicos`])]
      ]) + "<p>Hospedagem, domínio e serviços de terceiros não estão incluídos e serão discriminados separadamente. " +
          "Novas funcionalidades, reformulações e grandes alterações não estão automaticamente incluídas.</p>"
    : "<p>Plano mensal não contratado nesta data. O CONTRATANTE poderá contratá-lo posteriormente, mediante aditivo ou novo aceite eletrônico. " +
      "A contratação do plano não elimina nem substitui a garantia técnica.</p>";

  return `
    <header class="doc-head">
      <div class="doc-brand">EVOLUA<b>TECH</b></div>
      <div class="doc-meta"><strong>Contrato nº ${esc(d.numero || "minuta (número atribuído ao salvar)")}</strong><span>Emitido em ${dt(d.data_contratacao)}</span></div>
    </header>
    <h1>Contrato de prestação de serviços de desenvolvimento</h1>

    ${sec(1, "Identificação das partes",
      `<h3>Contratada — EVOLUATECH</h3>${parte("c")}<h3>Contratante — Cliente</h3>${parte("k")}`)}

    ${sec(2, "Objeto e escopo", kv([
      ["Nome do projeto", txt(d.projeto_nome)],
      ["Serviços contratados", servs.length ? servs.join(", ") : "—"],
      ["Descrição", txt(d.descricao)],
      ["Funcionalidades", txt(d.funcionalidades)],
      ["Tecnologias", txt(d.tecnologias, "Definidas pela CONTRATADA")],
      ["Entregáveis", txt(d.entregaveis)],
      ["Serviços não inclusos", txt(d.nao_inclusos)]
    ]))}

    ${sec(3, "Valores e condições de pagamento",
      kv([
        ["Valor total do projeto", d.valor_total ? brl(f.total) : txt("", "A definir")],
        ["Entrada", `${f.pct}% — ${brl(f.entrada)}`],
        ["Saldo", `${(100 - f.pct).toFixed(0)}% — ${brl(f.saldo)}`],
        ["Parcelamento do saldo", `${f.n}× de ${brl(f.parcela)}`],
        ["Forma de pagamento", txt(d.forma_pagamento)],
        ["Vencimento da entrada", dt(d.vencimento_entrada)],
        ["Vencimento do saldo / 1ª parcela", dt(d.vencimento_saldo)]
      ]) + (d.condicoes_especiais ? `<h3>Condições especiais</h3>${paras(d.condicoes_especiais)}` : ""))}

    ${sec(4, "Plano mensal de suporte e manutenção (opcional)", planoHTML)}

    ${sec(5, "Prazos e entrega", kv([
      ["Data da contratação", dt(d.data_contratacao)],
      ["Data prevista de início", dt(d.data_inicio)],
      ["Prazo estimado", txt(d.prazo_estimado)],
      ["Etapas de desenvolvimento", txt(d.etapas)],
      ["Condições de aprovação", txt(d.condicoes_aprovacao)],
      ["Condições de entrega final", txt(d.condicoes_entrega)]
    ]) + "<p>Atrasos no fornecimento de informações, materiais ou aprovações pelo CONTRATANTE poderão afetar o cronograma previsto.</p>")}

    ${sec(6, "Responsabilidades das partes",
      `<h3>Da EVOLUATECH</h3>${list(RESP_EVT)}<h3>Do CONTRATANTE</h3>${list(RESP_CLI)}`)}

    ${sec(7, "Marketing e serviços não inclusos", paras(d.cl_marketing))}
    ${sec(8, "Garantia técnica de 90 dias — correção de bugs", paras(d.cl_garantia))}
    ${sec(9, "Cancelamento e rescisão", paras(d.cl_cancelamento))}

    <div class="assina">
      <div><strong>${txt(d.c_nome, "EVOLUATECH")}</strong><br>CONTRATADA</div>
      <div><strong>${txt(d.k_nome, "CONTRATANTE")}</strong><br>CONTRATANTE</div>
    </div>
    <p class="doc-note">Local e data: ____________________________________</p>
  `;
}

function render(d) { docEl.innerHTML = renderDoc(d); }

/* ---------- Estado local, status e feedback ---------- */
function persistLocal(d) {
  localStorage.setItem(KEY.atual, JSON.stringify(d));
  const cfg = Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith("c_")));
  localStorage.setItem(KEY.cfg, JSON.stringify(cfg));
}

function status(msg, tipo = "") {
  const el = $("#statusSalvo");
  el.textContent = msg;
  el.className = `hint status ${tipo}`;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

function validate() {
  let ok = true;
  REQUIRED.forEach((k) => {
    const el = form.elements[k];
    const bad = !el.value.trim();
    el.classList.toggle("invalid", bad);
    if (bad && ok) { el.focus(); ok = false; }
  });
  if (!ok) toast("Preencha os campos obrigatórios destacados.");
  return ok;
}

function show(view) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("active", s.id === view));
  if (view === "visualizacao") render(collect());
  window.scrollTo({ top: 0 });
}

/* ---------- Nuvem (Firestore) ---------- */
function setOcupado(on, texto) {
  ocupado = on;
  const b = $("#btnRascunho");
  b.disabled = on || !usuario;
  b.textContent = on ? texto : "Salvar na nuvem";
}

async function salvarNuvem() {
  if (!usuario) return toast("Entre com sua conta Google para salvar na nuvem.");
  if (ocupado) return;
  const d = collect();
  if (!d.numero) {
    setOcupado(true, "Gerando número…");
    try {
      d.numero = await nextNumero();
      $("#numero").value = d.numero;
    } catch (e) {
      setOcupado(false);
      return toast(`Não foi possível gerar o número: ${e.message}`);
    }
  }
  setOcupado(true, "Salvando…");
  try {
    await saveContrato(d.numero, d, "rascunho");
    persistLocal(d);
    status(`Salvo na nuvem às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, "ok");
    toast("Contrato salvo na nuvem.");
    await carregarLista(d.numero);
  } catch (e) {
    console.error(e);
    status("Erro ao salvar na nuvem. Os dados continuam salvos neste navegador.", "erro");
    toast(`Erro ao salvar: ${e.code || e.message}`);
  } finally {
    setOcupado(false);
  }
}

async function carregarLista(selecionado) {
  const sel = $("#selRascunho");
  if (!usuario) {
    sel.innerHTML = '<option value="">Entre para ver os contratos salvos</option>';
    return;
  }
  try {
    const itens = await listContratos();
    sel.innerHTML = '<option value="">Editar contrato existente…</option>' +
      itens.map((x) => `<option value="${esc(x.numero)}">${esc(x.numero)} · ${esc(x.cliente)} · ${esc(x.status)}</option>`).join("");
    if (selecionado) sel.value = selecionado;
  } catch (e) {
    console.error(e);
    sel.innerHTML = '<option value="">Não foi possível carregar a lista</option>';
  }
}

async function carregarContrato(numero) {
  try {
    const c = await getContrato(numero);
    if (!c) return toast("Contrato não encontrado.");
    form.reset();
    fill({ ...DEFAULTS, ...c.dados });
    const d = collect();
    persistLocal(d);
    updateResumo(d);
    status(`Contrato ${numero} carregado da nuvem (${c.status}).`, "ok");
  } catch (e) {
    toast(`Erro ao carregar: ${e.code || e.message}`);
  }
}

/* ---------- Ações ---------- */
function novoContrato() {
  if (!confirm("Iniciar um novo contrato? O contrato em edição permanece salvo na nuvem apenas se você tiver salvo.")) return;
  const cfg = readJSON(KEY.cfg, {});
  form.reset();
  fill({ ...DEFAULTS, ...cfg, data_contratacao: hoje() });
  const d = collect();
  persistLocal(d);
  updateResumo(d);
  show("painel");
  status("Novo contrato. O número será gerado ao salvar na nuvem.");
  toast("Novo contrato criado.");
}

async function onUserChange(user) {
  usuario = user;
  $("#btnLogin").textContent = user ? `Sair (${user.email})` : "Entrar com Google";
  $("#btnRascunho").disabled = !user || ocupado;
  $("#btnRascunho").title = user ? "" : "Entre para salvar na nuvem";
  await carregarLista(collect().numero);
  if (user) status("Conectado. Alterações ainda não salvas na nuvem aparecem aqui.", "aviso");
}

/* ---------- Eventos ---------- */
function onChange(e) {
  if (e.target.classList) e.target.classList.remove("invalid");
  const d = collect();
  persistLocal(d);
  updateResumo(d);
  if (usuario && !ocupado) status("Alterações não salvas na nuvem", "aviso");
  if ($("#visualizacao").classList.contains("active")) render(d);
}
form.addEventListener("input", onChange);
form.addEventListener("change", onChange);

document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
$("#btnNovo").addEventListener("click", novoContrato);
$("#btnRascunho").addEventListener("click", salvarNuvem);
$("#btnVisualizar").addEventListener("click", () => show("visualizacao"));
$("#btnPdf").addEventListener("click", () => {
  if (!validate()) return;
  show("visualizacao");
  setTimeout(() => window.print(), 150);
});
$("#selRascunho").addEventListener("change", (e) => {
  if (e.target.value) carregarContrato(e.target.value);
});
$("#btnLogin").addEventListener("click", async () => {
  try {
    if (usuario) await logout();
    else await login();
  } catch (e) {
    console.error(e);
    toast(`Não foi possível autenticar: ${e.code || e.message}`);
  }
});

/* ---------- Inicialização ---------- */
const cfgSalva = readJSON(KEY.cfg, {});
const atual = readJSON(KEY.atual, null);
const base = atual || { ...DEFAULTS, data_contratacao: hoje() };
fill({ ...DEFAULTS, ...base, ...cfgSalva });
{
  const d = collect();
  persistLocal(d);
  updateResumo(d);
}
onUser(onUserChange);
