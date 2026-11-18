// =====================================================================
// PEI ARY GOMES · Plataforma de Avaliação de Projetos — interface
// Toda regra de negócio fica no backend; aqui só montagem de telas e
// chamadas à API (js/api.js).
// =====================================================================

// ============ Helpers de UI ============
const $ = (sel, root = document) => root.querySelector(sel);
const appEl = () => document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
// Argumento seguro para onclick="fn(...)" (aspas e apóstrofos em nomes não quebram o HTML/JS).
const js = (s) => esc(JSON.stringify(String(s ?? "")));
const fmtDay = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const prazo = (d) => d ? `${prazo(d)}` : "sem prazo";
const num = (n) => (n === null || n === undefined) ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();

// Ícones: conjunto único de traço (paths do Lucide, licença ISC).
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  grid: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  id: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2"/><path d="M15 12h2"/><path d="M7 16h4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  presentation: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
  criteria: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
  collapse: '<polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  up: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  down: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  publish: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'
};
const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
const alertBox = (type, html) => `<div class="alert ${type}">${icon(type === "danger" || type === "warn" ? "alert" : type === "success" ? "checkCircle" : "info")}<div>${html}</div></div>`;
const emptyBox = (text, ic = "inbox") => `<div class="empty">${icon(ic)}${text}</div>`;
const pageHead = (title, text, actions = "") => `<div class="welcome"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>`;
const stat = (label, value, hint = "", tone = "") => `<div class="stat ${tone}"><div class="lbl">${label}</div><div class="num">${value}</div>${hint ? `<div class="hint">${hint}</div>` : ""}</div>`;
const progress = (a, b, tone = "") => `<div class="bar ${tone}" title="${a} de ${b}"><i style="width:${pct(a, b)}%"></i></div>`;

const STATUS_LABEL = {
  NOT_STARTED: "Não iniciado", IN_PROGRESS: "Em andamento", SUBMITTED: "Enviado", UNDER_REVIEW: "Em avaliação",
  EVALUATED: "Avaliado", RETURNED: "Devolvido", RESUBMITTED: "Reenviado", DRAFT: "Rascunho", OPEN: "Aberta",
  CLOSED: "Encerrada", ARCHIVED: "Arquivada", PUBLISHED: "Publicada", REVISED: "Revisada", CONCLUDED: "Concluída"
};
const pill = (s) => s ? `<span class="pill ${s}">${esc(STATUS_LABEL[s] || s)}</span>` : "";
const tag = (cls, text) => `<span class="pill ${cls}">${text}</span>`;

function toast(msg, type = "ok") {
  let box = document.getElementById("toast");
  if (!box) { box = document.createElement("div"); box.id = "toast"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast ${type}`; t.setAttribute("role", type === "err" ? "alert" : "status"); t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
async function guard(fn) { try { await fn(); } catch (e) { toast(e.message || "Erro", "err"); } }

function openModal(title, html) {
  closeModal();
  const bg = document.createElement("div");
  bg.className = "modal-bg"; bg.id = "modal-bg";
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="close" onclick="closeModal()" aria-label="Fechar">${icon("x")}</button><h3>${esc(title)}</h3><div id="modal-body">${html}</div></div>`;
  bg.addEventListener("click", (e) => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
}
function closeModal() { const m = document.getElementById("modal-bg"); if (m) m.remove(); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// Composição da nota: grupo (documentos) + apresentação = final
function scoreBox({ groupScore, groupMax, presentationScore, presentationMax, finalScore, maxScore }) {
  return `<div class="scorebox">
    <div class="sb"><div class="sb-l">Nota do grupo<small>documentos</small></div><div class="sb-v">${num(groupScore)}<small> / ${num(groupMax)}</small></div></div>
    <div class="sb-op">+</div>
    <div class="sb"><div class="sb-l">Apresentação<small>individual</small></div><div class="sb-v">${num(presentationScore)}<small> / ${num(presentationMax)}</small></div></div>
    <div class="sb-op">=</div>
    <div class="sb final"><div class="sb-l">Nota final<small>&nbsp;</small></div><div class="sb-v">${num(finalScore)}<small> / ${num(maxScore)}</small></div></div>
  </div>`;
}

// Linhas de critério com campos de nota + comentário (avaliação documental)
function criteriaInputs(list, cls) {
  if (!list.length) return emptyBox("Nenhum critério cadastrado pelo administrador para esta etapa.", "criteria");
  return list.map((c, i) => `
    <div class="crit"><div class="chead"><span class="ctitle">${i + 1}. ${esc(c.title)}${c.required ? ' <span class="req" title="obrigatório">*</span>' : ""}</span><span class="cmax">máx. ${num(c.maxPoints)}${Number(c.weight) !== 1 ? " · peso " + num(c.weight) : ""}</span></div>
    ${c.description ? `<div class="cdesc">${esc(c.description)}</div>` : ""}${c.guidance ? `<div class="cdesc">${esc(c.guidance)}</div>` : ""}
    <div class="cinputs"><input type="number" min="0" max="${c.maxPoints}" step="0.1" data-cid="${c.id}" class="${cls}-score" placeholder="Nota" value="${c.score ?? ""}" aria-label="Nota de ${esc(c.title)}">
    <input type="text" data-cid="${c.id}" class="${cls}-comment" placeholder="Comentário sobre este critério (opcional)" value="${esc(c.comment ?? "")}"></div></div>`).join("");
}
function collectInputs(cls) {
  return [...document.querySelectorAll(`.${cls}-score`)].map(inp => ({
    criterionId: inp.dataset.cid,
    score: inp.value === "" ? null : Number(inp.value),
    comment: document.querySelector(`.${cls}-comment[data-cid="${inp.dataset.cid}"]`).value || null
  }));
}

// ============ Identidade ============
const BRAND = {
  logo: "./img/logo-pei-ary-gomes-tela.png",
  symbol: "./img/simbolo-pei-ary-gomes.png",
  product: "Avaliação de Projetos",
  course: "Desenvolvimento de Sistemas",
  school: "E.E. Coronel Ary Gomes · Programa Ensino Integral"
};
const ROLE_LABEL = { ADMIN: "Administração", TEACHER: "Professor", STUDENT: "Aluno" };

// ============ Shell / roteamento ============
function renderApp() {
  if (!Auth.isLogged) return renderLogin();
  if (Auth.user?.mustChangePassword) return renderChangePassword(true);
  renderShell();
}

function authLayout(inner) {
  return `<div class="auth">
    <aside class="auth-brand">
      <div>
        <div class="auth-logo"><img src="${BRAND.logo}" alt="Logo PEI Ary Gomes"></div>
        <h1>Plataforma de <em>Avaliação de Projetos</em></h1>
        <p>Envio de documentos, avaliação documental e avaliação individual das apresentações do curso de ${BRAND.course}.</p>
        <ul class="auth-points">
          <li>${icon("upload")} Grupos enviam os documentos do projeto</li>
          <li>${icon("file")} Professores avaliam pelos critérios definidos</li>
          <li>${icon("presentation")} Banca avalia cada aluno na apresentação</li>
        </ul>
      </div>
      <div class="auth-school">${BRAND.school}</div>
    </aside>
    <main class="auth-form"><div class="auth-card">
      <div class="auth-logo-sm"><img src="${BRAND.logo}" alt="Logo PEI Ary Gomes"></div>
      ${inner}
    </div></main>
  </div><div id="toast"></div>`;
}

function renderLogin() {
  document.body.innerHTML = authLayout(`
      <h2>Acesso à plataforma</h2>
      <p class="lead">Entre com seu e-mail e senha. No primeiro acesso, use a senha provisória recebida.</p>
      <div id="login-msg"></div>
      <form id="login-form" novalidate>
        <div class="field"><label for="email">E-mail</label><input id="email" type="email" required placeholder="nome@escola.dev" autocomplete="username"></div>
        <div class="field"><label for="password">Senha</label><input id="password" type="password" required placeholder="Sua senha" autocomplete="current-password"></div>
        <button class="btn block" id="login-btn">Entrar</button>
      </form>
      <p class="auth-meta">Servidor: <span class="mono">${esc(API_URL)}</span></p>`);
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#login-msg"); msg.innerHTML = "";
    if (!$("#email").value.trim() || !$("#password").value) { msg.innerHTML = alertBox("danger", "Informe o e-mail e a senha."); return; }
    const btn = $("#login-btn"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Entrando...';
    try {
      const session = await api.login($("#email").value.trim(), $("#password").value);
      Auth.set(session);
      renderApp();
    } catch (err) {
      msg.innerHTML = alertBox("danger", esc(err.message));
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });
}

// Troca de senha: obrigatória no 1º acesso (senha provisória) ou voluntária.
function renderChangePassword(forced) {
  const form = `
      <form id="pw-form">
        <div class="field"><label for="pw-cur">${forced ? "Senha provisória" : "Senha atual"}</label><input id="pw-cur" type="password" required autocomplete="current-password"></div>
        <div class="field"><label for="pw-new">Nova senha</label><input id="pw-new" type="password" required minlength="8" autocomplete="new-password"><div class="help">Mínimo de 8 caracteres.</div></div>
        <div class="field"><label for="pw-conf">Confirme a nova senha</label><input id="pw-conf" type="password" required minlength="8" autocomplete="new-password"></div>
        <button class="btn ${forced ? "block" : ""}" id="pw-btn">Salvar nova senha</button>
      </form>`;
  if (forced) {
    document.body.innerHTML = authLayout(`
      <h2>Crie sua senha</h2>
      <p class="lead">${esc(Auth.user.name)}, você entrou com uma senha provisória. Defina uma senha pessoal para continuar.</p>
      ${form}
      <button class="btn ghost block" style="margin-top:10px" onclick="logout()">Sair</button>`);
  } else {
    openModal("Alterar senha", form);
  }
  $("#pw-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("#pw-new").value !== $("#pw-conf").value) return toast("A confirmação não confere com a nova senha.", "err");
    guard(async () => {
      const session = await api.changePassword($("#pw-cur").value, $("#pw-new").value);
      Auth.set(session);
      toast("Senha alterada com sucesso.");
      closeModal();
      renderApp();
    });
  });
}

function logout() { Auth.clear(); renderApp(); }

const UI = {
  collapsed() { try { return localStorage.getItem("ui.sidebar") === "collapsed"; } catch { return false; } },
  toggleCollapse() {
    const shell = $(".shell"); if (!shell) return;
    shell.classList.toggle("collapsed");
    try { localStorage.setItem("ui.sidebar", shell.classList.contains("collapsed") ? "collapsed" : "open"); } catch {}
  },
  openNav() { $(".shell")?.classList.add("nav-open"); },
  closeNav() { $(".shell")?.classList.remove("nav-open"); }
};

function renderShell() {
  const u = Auth.user;
  document.body.innerHTML = `
    <div class="shell ${UI.collapsed() ? "collapsed" : ""}">
      <aside class="sidebar" aria-label="Menu principal">
        <div class="sb-brand">
          <div class="sb-logo"><img class="full" src="${BRAND.logo}" alt="Logo PEI Ary Gomes"><img class="symbol" src="${BRAND.symbol}" alt="PEI Ary Gomes"></div>
          <div class="sb-product"><strong>${BRAND.product}</strong><span>${BRAND.course}</span></div>
        </div>
        <nav class="sb-nav" id="sb-nav"></nav>
        <div class="sb-foot">
          <div class="sb-user"><div class="avatar">${esc(initials(u.name))}</div><div class="who"><strong>${esc(u.name)}</strong><span>${esc(ROLE_LABEL[u.role] || u.role)}</span></div></div>
          <button class="sb-item" onclick="renderChangePassword(false)" title="Alterar senha">${icon("key")}<span>Alterar senha</span></button>
          <button class="sb-item" onclick="logout()" title="Sair">${icon("logout")}<span>Sair</span></button>
          <button class="sb-item sb-collapse" onclick="UI.toggleCollapse()" title="Recolher menu">${icon("collapse")}<span>Recolher menu</span></button>
        </div>
      </aside>
      <div class="scrim" onclick="UI.closeNav()"></div>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost icon menu-btn" onclick="UI.openNav()" aria-label="Abrir menu">${icon("menu")}</button>
          <div class="crumbs"><span>PEI Ary Gomes</span><span>/</span><b id="crumb">—</b></div>
          <div class="spacer"></div>
          <span class="role-tag">${esc(ROLE_LABEL[u.role] || u.role)}</span>
        </header>
        <main class="content" id="app"></main>
        <footer class="footer">${BRAND.school} · ${BRAND.product}</footer>
      </div>
    </div>
    <div id="toast"></div>`;
  if (u.role === "ADMIN") AdminArea.render();
  else if (u.role === "TEACHER") TeacherArea.render();
  else StudentArea.render();
}

// Navegação lateral (por seções). Mantém a mesma API das abas: area.tab + area.render().
function mountTabs(area, items) {
  const nav = $("#sb-nav");
  if (nav) {
    let html = "", section = null;
    for (const it of items) {
      if (it.section && it.section !== section) { section = it.section; html += `<div class="sb-section">${esc(section)}</div>`; }
      html += `<button class="sb-item ${it.key === area.tab ? "active" : ""}" data-key="${it.key}" title="${esc(it.label)}" aria-current="${it.key === area.tab ? "page" : "false"}">${icon(it.icon || "grid")}<span>${esc(it.label)}</span></button>`;
    }
    nav.innerHTML = html;
    nav.querySelectorAll(".sb-item").forEach(b => b.onclick = () => { area.tab = b.dataset.key; UI.closeNav(); area.render(); });
  }
  const cur = items.find(i => i.key === area.tab);
  if ($("#crumb")) $("#crumb").textContent = cur ? cur.label : "";
  document.title = `${cur ? cur.label + " · " : ""}Avaliação de Projetos · PEI Ary Gomes`;
  appEl().innerHTML = "";
  const view = document.createElement("div"); view.id = "view"; appEl().appendChild(view);
  view.innerHTML = '<div class="loading"><span class="spinner"></span> Carregando...</div>';
  window.scrollTo(0, 0);
  return view;
}

// ============ ÁREA DO ALUNO ============
const StudentArea = {
  tab: "inicio",
  render() {
    const view = mountTabs(this, [
      { key: "inicio", label: "Início", icon: "home", section: "Aluno" },
      { key: "envios", label: "Enviar documentos", icon: "upload" },
      { key: "notas", label: "Notas e feedback", icon: "award" }
    ]);
    if (this.tab === "envios") this.envios(view);
    else if (this.tab === "notas") this.notas(view);
    else this.inicio(view);
  },
  go(tab) { this.tab = tab; this.render(); },

  // Início: projetos vinculados, pendências e últimos resultados
  async inicio(view) {
    await guard(async () => {
      const [acts, grades] = await Promise.all([api.stActivities(), api.stGrades()]);
      const pend = acts.filter(a => a.windowOpen && (!a.mySubmission || ["NOT_STARTED", "IN_PROGRESS", "RETURNED", "RESUBMITTED"].includes(a.mySubmission.status)));
      const media = grades.length ? grades.reduce((s, g) => s + g.finalScore, 0) / grades.length : null;
      const details = await Promise.all(grades.slice(0, 3).map(g => api.stGrade(g.resultId).catch(() => null)));
      const feedbacks = details.filter(Boolean).flatMap(d => [
        ...(d.documentFeedback ? [{ act: d.activity?.title, who: "Avaliação dos documentos", text: d.documentFeedback }] : []),
        ...(d.presentationNotes || []).map(n => ({ act: d.activity?.title, who: `Apresentação · ${n.teacher}`, text: n.notes }))
      ]);
      const subState = (a) => {
        if (a.mode === "GROUP" && !a.myGroup) return tag("DANGER", "Sem grupo");
        if (!a.mySubmission) return a.windowOpen ? tag("WARN", "Não enviado") : tag("DRAFT", "Não enviado");
        return pill(a.mySubmission.status);
      };
      view.innerHTML = pageHead(`Olá, ${esc(Auth.user.name.split(" ")[0])}`, "Acompanhe seus projetos, envie os documentos do seu grupo e consulte suas notas.")
        + `<div class="grid cols-4">
          ${stat("Projetos", acts.length)}
          ${stat("Envios pendentes", pend.length, pend.length ? "dentro do prazo" : "nada pendente", "t-yellow")}
          ${stat("Notas publicadas", grades.length, "", "t-blue")}
          ${stat("Média das notas finais", media === null ? "—" : num(media), "", "t-green")}
        </div>
        ${pend.length ? `<div style="margin-top:16px">${alertBox("warn", `<b>${pend.length} envio(s) pendente(s).</b> ${pend.map(a => `${esc(a.title)} (${prazo(a.dueDate)})`).join(" · ")}`)}</div>` : ""}
        <div class="grid cols-2-1" style="margin-top:16px">
          <div class="card"><div class="card-head"><h3>${icon("folder")} Meus projetos</h3></div>
            ${acts.length ? acts.map(a => `<div class="list-item"><div class="info">
                <div class="title">${esc(a.title)} ${subState(a)}</div>
                <div class="sub">${a.mode === "GROUP" ? (a.myGroup ? "Grupo " + esc(a.myGroup.name) : "Entrega em grupo") : "Entrega individual"} · ${prazo(a.dueDate)}${a.windowOpen ? "" : " · envios fechados"}</div></div>
              <div class="actions"><button class="btn sm ${pend.includes(a) ? "" : "ghost"}" onclick="StudentArea.goActivity('${a.id}')">${pend.includes(a) ? "Enviar" : "Abrir"}</button></div></div>`).join("")
              : emptyBox("Nenhum projeto disponível no momento.", "folder")}
          </div>
          <div class="card"><div class="card-head"><h3>${icon("message")} Últimos feedbacks</h3></div>
            ${feedbacks.length ? feedbacks.slice(0, 4).map(f => `<div class="list-item"><div class="info"><div class="sub">${esc(f.act || "")} · ${esc(f.who)}</div><div style="margin-top:4px;font-size:14px">${esc(f.text)}</div></div></div>`).join("")
              : emptyBox("Os comentários dos professores aparecem aqui quando as notas forem publicadas.", "message")}
          </div>
        </div>
        ${grades.length ? `<div class="card"><div class="card-head"><h3>${icon("award")} Último resultado</h3><button class="btn sm ghost" style="margin-left:auto" onclick="StudentArea.go('notas')">Ver todas as notas</button></div>
          <div class="gc-head"><div><div class="title">${esc(grades[0].activity?.title || "Avaliação")}</div><div class="sub">${grades[0].group ? "Grupo " + esc(grades[0].group.name) + " · " : ""}publicada em ${fmtDay(grades[0].publishedAt)}</div></div>
          <button class="btn sm ghost" onclick="StudentArea.gradeDetail('${grades[0].resultId}')">Detalhes</button></div>${scoreBox(grades[0])}</div>` : ""}`;
    });
  },

  goActivity(id) { this.tab = "envios"; this.render(); setTimeout(() => this.openActivity(id), 200); },

  async envios(view) {
    await guard(async () => {
      const acts = await api.stActivities();
      view.innerHTML = pageHead("Enviar documentos", "Escolha a atividade, anexe os arquivos e confirme o envio. Em atividades em grupo, qualquer integrante envia e todos veem os mesmos arquivos.")
        + `<div class="card">${acts.length ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Atividade</th><th>Entrega</th><th>Prazo</th><th>Situação</th><th></th></tr></thead><tbody>
          ${acts.map(a => `<tr><td><b>${esc(a.title)}</b></td>
            <td>${a.mode === "GROUP" ? (a.myGroup ? "Grupo " + esc(a.myGroup.name) : '<span class="pill DANGER">Sem grupo</span>') : "Individual"}</td>
            <td class="nowrap">${fmtDay(a.dueDate)} ${a.windowOpen ? pill("OPEN") : pill(a.status === "OPEN" ? "CLOSED" : a.status)}</td>
            <td>${a.mySubmission ? pill(a.mySubmission.status) : '<span class="muted">Não enviado</span>'}</td>
            <td class="num"><button class="btn sm" onclick="StudentArea.openActivity('${a.id}')">Abrir</button></td></tr>`).join("")}
          </tbody></table></div>` : emptyBox("Nenhuma atividade disponível.", "folder")}</div>`;
    });
  },

  async openActivity(id) {
    await guard(async () => {
      const a = await api.stActivity(id);
      const subs = await api.stSubmissions();
      const mine = subs.find(s => s.activity.id === id);
      const fmts = (a.allowedFormats || []).join(", ") || "qualquer";
      let body = `${a.description ? `<p class="muted">${esc(a.description)}</p>` : ""}
        <div class="card subtle"><div class="kv"><b>Orientações:</b> ${esc(a.instructions || "—")}</div>
        <div class="kv" style="margin-top:6px">Prazo <b>${fmtDay(a.dueDate)}</b> · Formatos <b>${esc(fmts)}</b> · até <b>${a.maxFiles}</b> arquivo(s) de <b>${a.maxFileSizeMb} MB</b></div></div>`;
      if (a.mode === "GROUP") {
        body += a.myGroup
          ? alertBox("info", `Entrega do grupo <b>${esc(a.myGroup.name)}</b>. Qualquer integrante pode enviar; todos veem os mesmos arquivos.`)
          : alertBox("danger", "Você ainda não está em um grupo, por isso não consegue enviar. Peça ao administrador para incluí-lo em um grupo.");
      }
      if (!mine && (a.mode !== "GROUP" || a.myGroup)) {
        body += a.windowOpen ? `<form id="newsub"><div class="field"><label for="st">Título do trabalho</label><input id="st" required placeholder="ex.: TCC — Sistema de Agendamento"></div>
          <div class="field"><label for="sd">Observações (opcional)</label><textarea id="sd"></textarea></div>
          <div class="field"><label for="nfiles">Documentos (${esc(fmts)})</label><input type="file" id="nfiles" multiple required></div>
          <button class="btn">${icon("send")} Enviar documentos ao professor</button></form>` : alertBox("warn", "O prazo de envio não está aberto.");
      } else if (mine) {
        body += `<div class="form-foot"><span>Situação do envio: ${pill(mine.status)}</span>
          <button class="btn secondary sm" onclick="StudentArea.manageSubmission('${mine.id}')">Abrir envio</button></div>`;
      }
      openModal(a.title, body);
      if ($("#newsub")) $("#newsub").addEventListener("submit", (e) => {
        e.preventDefault();
        guard(async () => {
          const files = $("#nfiles").files;
          if (!files.length) return toast("Selecione ao menos um arquivo.", "err");
          // 1 clique: cria o envio (ou reaproveita o do grupo), anexa os arquivos e confirma.
          const sub = await api.stCreateSubmission({ activityId: id, title: $("#st").value.trim(), description: $("#sd").value.trim() });
          await uploadFiles(`/api/student/submissions/${sub.id}/files`, files);
          await api.stSubmit(sub.id);
          toast("Documentos enviados ao professor."); closeModal(); this.render();
        });
      });
    });
  },

  async manageSubmission(id) {
    await guard(async () => {
      const s = await api.stSubmission(id);
      const canEdit = ["NOT_STARTED", "IN_PROGRESS", "RETURNED", "RESUBMITTED"].includes(s.status);
      const files = s.versions.flatMap(v => v.files.map(f => ({ ...f, v: v.versionNumber })));
      let body = `<p class="kv"><b>${esc(s.activity.title)}</b> · ${pill(s.status)}${s.group ? ` · Grupo ${esc(s.group.name)}` : ""}</p>
        <h4 class="sec-h">${icon("clip", "sm")} Documentos enviados</h4>
        ${files.length ? files.map(f => `<div class="list-item"><div class="info"><div class="title">${esc(f.originalName)}</div><div class="sub">versão ${f.v} · ${(f.sizeBytes / 1024).toFixed(1)} KB</div></div><button class="btn sm ghost" data-dl="/api/student/files/${f.id}/download" data-name="${esc(f.originalName)}">${icon("download", "sm")} Baixar</button></div>`).join("") : emptyBox("Nenhum documento anexado ainda.", "clip")}`;
      if (canEdit) {
        body += `<div class="field" style="margin-top:14px"><label for="files">Anexar documentos (${esc((s.activity.allowedFormats || []).join(", ") || "qualquer formato")})</label><input type="file" id="files" multiple></div>
          <button class="btn" id="submit">${icon("send")} Enviar documentos ao professor</button>
          <p class="help">Os arquivos selecionados são anexados e o envio é confirmado no mesmo clique. Depois disso, seguem para avaliação e não podem mais ser alterados.</p>`;
      } else if (s.status === "EVALUATED") {
        body += `<p class="help">Documentos avaliados. Veja sua nota em "Notas e feedback".</p>`;
      } else {
        body += `<p class="help">Documentos enviados. Aguarde a avaliação do professor.</p>`;
      }
      openModal("Envio de documentos", body);
      document.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => downloadFile(b.dataset.dl, b.dataset.name));
      if (canEdit) {
        $("#submit").onclick = () => guard(async () => {
          const inp = $("#files");
          if (!inp.files.length && !files.length) return toast("Selecione ao menos um arquivo.", "err");
          if (inp.files.length) await uploadFiles(`/api/student/submissions/${id}/files`, inp.files);
          await api.stSubmit(id); toast("Documentos enviados ao professor."); closeModal(); this.render();
        });
      }
    });
  },

  // Notas, feedback e histórico de avaliações
  async notas(view) {
    await guard(async () => {
      const grades = await api.stGrades();
      view.innerHTML = pageHead("Notas e feedback", "Nota final = nota do grupo (documentos enviados) + nota individual da apresentação. As notas aparecem aqui depois de publicadas pelos professores.")
        + (grades.length ? grades.map(g => `<div class="grade-card">
              <div class="gc-head"><div><div class="title">${esc(g.activity?.title || "Avaliação")}</div>
                <div class="sub">${g.group ? "Grupo " + esc(g.group.name) + " · " : ""}publicada em ${fmtDay(g.publishedAt)} ${pill(g.status)}</div></div>
                <button class="btn sm ghost" onclick="StudentArea.gradeDetail('${g.resultId}')">Ver detalhes e comentários</button></div>
              ${scoreBox(g)}</div>`).join("")
          + `<div class="card"><div class="card-head"><h3>${icon("history")} Histórico de avaliações</h3></div><div class="table-wrap"><table class="sheet"><thead><tr><th>Atividade</th><th>Publicada em</th><th class="num">Grupo</th><th class="num">Apresentação</th><th class="num">Final</th><th>Situação</th></tr></thead><tbody>
            ${grades.map(g => `<tr><td>${esc(g.activity?.title || "—")}</td><td>${fmtDay(g.publishedAt)}</td><td class="num">${num(g.groupScore)}</td><td class="num">${num(g.presentationScore)}</td><td class="num"><b>${num(g.finalScore)}</b> / ${num(g.maxScore)}</td><td>${pill(g.status)}</td></tr>`).join("")}
            </tbody></table></div></div>`
          : emptyBox("Nenhuma nota publicada ainda. Assim que os professores publicarem, ela aparecerá aqui.", "award"));
    });
  },

  async gradeDetail(id) {
    await guard(async () => {
      const g = await api.stGrade(id);
      const crit = (list) => list.length ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Critério</th><th class="num">Nota</th></tr></thead><tbody>${list.map(c => `<tr><td>${esc(c.title)}${c.comment ? `<div class="cell-sub">${esc(c.comment)}</div>` : ""}</td><td class="num"><b>${num(c.score)}</b> / ${num(c.maxPoints)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">—</p>';
      openModal("Detalhe da nota", `
        <p class="kv"><b>${esc(g.activity?.title || "")}</b>${g.group ? " · Grupo " + esc(g.group.name) : ""}</p>
        ${scoreBox(g)}
        <h4 class="sec-h">${icon("file", "sm")} Documentos do grupo</h4>${crit(g.documentCriteria)}
        ${g.documentFeedback ? `<div class="card subtle" style="margin-top:10px"><div class="kv"><b>Comentário sobre os documentos</b></div><p style="margin-top:4px">${esc(g.documentFeedback)}</p></div>` : ""}
        <h4 class="sec-h">${icon("presentation", "sm")} Sua apresentação${g.evaluators > 1 ? ` · média de ${g.evaluators} avaliadores` : ""}</h4>${crit(g.presentationCriteria)}
        ${(g.presentationNotes || []).map(n => `<div class="card subtle" style="margin-top:10px"><div class="kv"><b>Observações de ${esc(n.teacher)}</b></div><p style="margin-top:4px">${esc(n.notes)}</p></div>`).join("")}
        <p class="help" style="margin-top:12px">Avaliada em ${fmtDate(g.evaluatedAt)} · Publicada em ${fmtDate(g.publishedAt)}</p>`);
    });
  }
};

// ============ ÁREA DO PROFESSOR ============
const TeacherArea = {
  tab: "inicio",
  render() {
    const view = mountTabs(this, [
      { key: "inicio", label: "Início", icon: "home", section: "Professor" },
      { key: "documentos", label: "Avaliação documental", icon: "file", section: "Avaliações" },
      { key: "apresentacao", label: "Avaliação das apresentações", icon: "presentation" }
    ]);
    if (this.tab === "documentos") this.documentos(view);
    else if (this.tab === "apresentacao") this.apresentacao(view);
    else this.inicio(view);
  },
  go(tab, act) { if (act) this._act = act; this.tab = tab; this.render(); },
  refreshHome() { if (this.tab === "inicio" && $("#view")) this.inicio($("#view")); },

  // Início: projetos sob responsabilidade e pendências (dados reais das avaliações)
  async inicio(view) {
    await guard(async () => {
      const [d, docs, pres] = await Promise.all([api.tDashboard(), api.tDocsOverview(), api.tPresProjects()]);
      const docPending = [], presPending = [];
      docs.forEach(x => x.entries.forEach(e => { if (!e.evaluated && e.submission?.files) docPending.push({ x, e }); }));
      pres.forEach(p => p.groups.forEach(g => g.members.forEach(m => { if (p.criteriaCount && (!m.myEvaluation || !m.myEvaluation.complete) && m.state !== "PUBLISHED") presPending.push({ p, g, m }); })));
      const docDone = docs.reduce((s, x) => s + x.entries.filter(e => e.evaluated).length, 0);
      const presDone = pres.reduce((s, p) => s + p.groups.reduce((t, g) => t + g.members.filter(m => m.myEvaluation?.complete).length, 0), 0);
      const projects = new Map();
      docs.forEach(x => projects.set(x.activity.id, { a: x.activity, docs: x }));
      pres.forEach(p => projects.set(p.activity.id, { ...(projects.get(p.activity.id) || { a: p.activity }), pres: p }));
      const rows = [...projects.values()].map(({ a, docs: x, pres: p }) => {
        const units = x ? x.entries.length : 0, evald = x ? x.entries.filter(e => e.evaluated).length : 0;
        const studs = p ? p.groups.reduce((s, g) => s + g.members.length, 0) : 0;
        const mine = p ? p.groups.reduce((s, g) => s + g.members.filter(m => m.myEvaluation?.complete).length, 0) : 0;
        return `<tr><td><b>${esc(a.title)}</b><div class="cell-sub">${[x ? "Documentos" : "", p ? "Banca" : ""].filter(Boolean).join(" · ")}</div></td>
          <td>${pill(a.status)}</td>
          <td>${x ? `${evald} de ${units} ${progress(evald, units)}` : '<span class="muted">—</span>'}</td>
          <td>${p ? `${mine} de ${studs} ${progress(mine, studs, "yellow")}` : '<span class="muted">—</span>'}</td>
          <td class="num nowrap">${x ? `<button class="btn sm ghost" onclick="TeacherArea.go('documentos')">Documentos</button>` : ""}${p ? `<button class="btn sm ghost" onclick="TeacherArea.go('apresentacao','${a.id}')">Apresentação</button>` : ""}</td></tr>`;
      }).join("");
      view.innerHTML = pageHead(`Olá, ${esc(Auth.user.name.split(" ")[0])}`, "Avalie os documentos enviados pelos grupos e, na apresentação, cada aluno individualmente. Quando as duas etapas estiverem completas, publique as notas.")
        + `<div class="grid cols-4">
          ${stat("Documentos aguardando avaliação", docPending.length, `${docDone} já avaliado(s)`, "t-yellow")}
          ${stat("Alunos a avaliar na apresentação", presPending.length, `${presDone} avaliação(ões) concluída(s)`, "t-blue")}
          ${stat("Notas prontas para publicar", d.resultadosAguardandoPublicacao, "documentos + apresentação", "t-green")}
          ${stat("Envios recebidos", d.projetosRecebidos, `${d.totalAlunos} aluno(s) nas suas atividades`)}
        </div>
        <div class="card" style="margin-top:16px"><div class="card-head"><h3>${icon("folder")} Projetos sob sua responsabilidade</h3></div>
          ${projects.size ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Projeto</th><th>Situação</th><th>Documentos avaliados</th><th>Suas avaliações de apresentação</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
            : emptyBox("Você ainda não foi vinculado a nenhuma atividade. O administrador faz esse vínculo.", "folder")}
        </div>
        <div class="grid cols-2">
          <div class="card"><div class="card-head"><h3>${icon("file")} Documentos a avaliar</h3></div>
            ${docPending.length ? docPending.slice(0, 6).map(({ x, e }) => `<div class="list-item"><div class="info"><div class="title">${esc(e.name)}</div><div class="sub">${esc(x.activity.title)} · ${e.submission.files} arquivo(s)</div></div>
              <button class="btn sm" onclick="TeacherArea.openDocs('${x.activity.id}','${e.groupId || ""}','${e.studentId || ""}')">Avaliar</button></div>`).join("")
              + (docPending.length > 6 ? `<p class="help">e mais ${docPending.length - 6}.</p>` : "")
              : emptyBox("Nenhum documento aguardando avaliação.", "checkCircle")}
          </div>
          <div class="card"><div class="card-head"><h3>${icon("presentation")} Apresentações a avaliar</h3></div>
            ${presPending.length ? presPending.slice(0, 6).map(({ p, g, m }) => `<div class="list-item"><div class="info"><div class="title">${esc(m.name)}</div><div class="sub">${esc(p.activity.title)} · ${esc(g.name)}${m.myEvaluation ? " · avaliação incompleta" : ""}</div></div>
              <button class="btn sm" onclick="TeacherArea.evalStudent('${p.activity.id}','${m.id}')">Avaliar</button></div>`).join("")
              + (presPending.length > 6 ? `<p class="help">e mais ${presPending.length - 6}.</p>` : "")
              : emptyBox("Nenhuma apresentação pendente para você.", "checkCircle")}
          </div>
        </div>`;
    });
  },

  // ---- 1) Avaliação documental: atividade → critérios → grupos → integrantes ----
  async documentos(view) {
    await guard(async () => {
      const list = await api.tDocsOverview();
      if (!list.length) {
        view.innerHTML = pageHead("Avaliação documental", "") + emptyBox("Você ainda não avalia documentos de nenhuma atividade. O administrador define isso em Atividades e documentos.", "file");
        return;
      }
      const SUB = (e) => {
        const s = e.submission;
        if (e.published) return tag("PUBLISHED", "Nota publicada");
        if (e.evaluated) return tag("EVALUATED", `Avaliado · ${num(e.groupScore)}`);
        if (!s || !s.files) return tag("DRAFT", "Ainda não enviou");
        if (["NOT_STARTED", "IN_PROGRESS"].includes(s.status)) return tag("WARN", `${s.files} arquivo(s), envio não confirmado`);
        return tag("SUBMITTED", `${s.files} arquivo(s) enviado(s)`);
      };
      view.innerHTML = pageHead("Avaliação documental", "Para cada atividade, veja os critérios cadastrados, os grupos e os integrantes. Abra a avaliação para baixar os arquivos e dar a nota do grupo.")
        + list.map(x => `<div class="card">
          <div class="card-head"><h3>${esc(x.activity.title)}</h3>${pill(x.activity.status)}<span class="meta">${prazo(x.activity.dueDate)}</span></div>
          <div class="grid cols-2-1">
            <div>
              ${x.ungrouped.length ? alertBox("warn", `Alunos sem grupo: ${x.ungrouped.map(esc).join(", ")}. O administrador precisa incluí-los em um grupo.`) : ""}
              ${x.entries.length ? x.entries.map(e => `<div class="list-item"><div class="info">
                  <div class="title">${esc(e.name)} ${SUB(e)}</div>
                  <div class="sub">${e.kind === "GROUP" ? `Integrantes: ${e.members.map(m => esc(m.name)).join(", ") || "nenhum"}` : "Entrega individual"}</div></div>
                <button class="btn sm ${e.evaluated ? "ghost" : ""}" ${e.members.length ? "" : "disabled"} onclick="TeacherArea.openDocs('${x.activity.id}','${e.groupId || ""}','${e.studentId || ""}')">${e.evaluated ? "Ver / editar nota" : "Avaliar documentos"}</button></div>`).join("")
                : emptyBox(x.activity.mode === "GROUP" ? "Nenhum grupo cadastrado." : "Nenhum aluno.", "users")}
            </div>
            <div class="card subtle"><div class="kv"><b>Critérios dos documentos</b> · nota máxima do grupo ${num(x.documentMax)}</div>
              ${x.documentCriteria.length ? `<ul class="crit-ul">${x.documentCriteria.map(c => `<li><span>${esc(c.title)}${c.description ? `<span class="cell-sub">${esc(c.description)}</span>` : ""}</span><span class="muted nowrap">até ${num(c.maxPoints)}</span></li>`).join("")}</ul>` : '<p class="muted">Nenhum critério cadastrado pelo administrador.</p>'}</div>
          </div>
        </div>`).join("");
    });
  },

  openDocs(activityId, groupId, studentId) {
    guard(async () => {
      const ctx = await api.tDocOpenFor(activityId, { groupId: groupId || undefined, studentId: studentId || undefined });
      await this.evaluateDocs(ctx.submission.id);
    });
  },

  async evaluateDocs(submissionId) {
    await guard(async () => {
      const [ctx, det] = await Promise.all([api.tDocOpen(submissionId), api.tSubmission(submissionId)]);
      const who = ctx.group ? `Grupo <b>${esc(ctx.group.name)}</b> · ${ctx.owners.map(o => esc(o.name)).join(", ")}` : esc(ctx.owners[0]?.name || "");
      openModal("Avaliação dos documentos", `
        <p class="kv">${who}</p><p class="kv" style="margin-top:2px">${esc(ctx.activity.title)} · ${pill(ctx.submission.status)}</p>
        <h4 class="sec-h">${icon("clip", "sm")} Arquivos</h4>
        <div>${ctx.submission.files.map(f => `<button class="btn sm ghost" style="margin:0 6px 6px 0" data-dl="/api/teacher/files/${f.id}/download" data-name="${esc(f.originalName)}">${icon("download", "sm")} ${esc(f.originalName)}</button>`).join("") || '<span class="muted">Sem arquivos enviados pelo sistema.</span>'}</div>
        ${ctx.submission.description ? `<p class="help">Observação dos alunos: ${esc(ctx.submission.description)}</p>` : ""}
        ${ctx.locked ? alertBox("warn", "As notas deste grupo já foram publicadas e não podem ser alteradas por aqui.") : ""}
        <h4 class="sec-h">${icon("criteria", "sm")} Critérios dos documentos</h4>
        ${criteriaInputs(ctx.documentCriteria, "doc")}
        <div class="field" style="margin-top:12px"><label for="docfb">Comentário geral sobre os documentos (visível aos alunos após a publicação)</label><textarea id="docfb">${esc(ctx.documentFeedback ?? "")}</textarea></div>
        <div class="eval-summary"><span>Nota do grupo</span><span class="big">${num(ctx.groupScore)}</span><span class="kv">de ${num(ctx.groupMax)}</span></div>
        ${ctx.locked ? "" : `<button class="btn" id="savedoc">${icon("save")} Salvar notas dos documentos</button>`}
        <h4 class="sec-h">${icon("lock", "sm")} Observações internas (não visíveis aos alunos)</h4>
        <div>${(det.notes || []).map(n => `<div class="list-item"><div class="info"><div>${esc(n.content)}</div><div class="sub">${esc(n.author?.name || "")} · ${fmtDay(n.createdAt)}</div></div></div>`).join("") || '<p class="muted">Nenhuma.</p>'}</div>
        <div class="row" style="margin-top:8px"><input id="note" placeholder="Nova observação interna"><button class="btn sm ghost" id="addnote" style="flex:0 0 auto">Registrar</button></div>`);
      document.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => downloadFile(b.dataset.dl, b.dataset.name));
      if ($("#savedoc")) $("#savedoc").onclick = () => guard(async () => {
        const r = await api.tDocSave(submissionId, { scores: collectInputs("doc"), feedback: $("#docfb").value });
        toast(`Notas salvas. Nota do grupo: ${num(r.groupScore)}`);
        this.evaluateDocs(submissionId);
        if (this.tab === "documentos" && $("#view")) this.documentos($("#view"));
        this.refreshHome();
      });
      $("#addnote").onclick = () => guard(async () => {
        const c = $("#note").value.trim(); if (!c) return;
        await api.tAddNote(submissionId, c); toast("Observação registrada."); this.evaluateDocs(submissionId);
      });
    });
  },

  // ---- 2) Avaliação das apresentações: projeto → integrantes → avaliação INDIVIDUAL ----
  async apresentacao(view) {
    await guard(async () => {
      const projects = await api.tPresProjects();
      this._projects = projects;
      if (!projects.length) {
        view.innerHTML = pageHead("Avaliação das apresentações", "") + emptyBox("Você ainda não está na banca de nenhuma apresentação. O administrador define isso em Apresentação: critérios e banca.", "presentation");
        return;
      }
      if (!this._act || !projects.some(p => p.activity.id === this._act)) this._act = projects[0].activity.id;
      view.innerHTML = pageHead("Avaliação das apresentações", "Escolha o projeto e avalie cada integrante. Cada aluno recebe a sua própria nota, pelos critérios de apresentação definidos pelo administrador.")
        + `${projects.length > 1 ? `<div class="card"><div class="field" style="margin:0"><label for="act">Projeto</label><select id="act">${projects.map(p => `<option value="${p.activity.id}" ${p.activity.id === this._act ? "selected" : ""}>${esc(p.activity.title)}</option>`).join("")}</select></div></div>` : ""}
          <div id="presbox"></div>`;
      if ($("#act")) $("#act").onchange = (e) => { this._act = e.target.value; this.drawProject(); };
      this.drawProject();
    });
  },

  drawProject() {
    const p = (this._projects || []).find(x => x.activity.id === this._act); const box = $("#presbox");
    if (!p || !box) return;
    const ST = { NOT_STARTED: ["DRAFT", "Não avaliado"], IN_PROGRESS: ["IN_PROGRESS", "Em andamento"], READY: ["EVALUATED", "Pronta para publicar"], PUBLISHED: ["PUBLISHED", "Publicada"] };
    const mine = (m) => !m.myEvaluation ? '<span class="muted">Você ainda não avaliou</span>'
      : m.myEvaluation.complete ? `Sua nota: <b>${num(m.myEvaluation.score)}</b>` : `Sua avaliação está incompleta (${num(m.myEvaluation.score)})`;
    const total = p.groups.reduce((s, g) => s + g.members.length, 0);
    const done = p.groups.reduce((s, g) => s + g.members.filter(m => m.myEvaluation?.complete).length, 0);
    box.innerHTML = `<div class="card"><div class="card-head"><h3>${esc(p.activity.title)}</h3>${pill(p.activity.status)}
        <span class="meta">${p.criteriaCount} critério(s) · nota máxima ${num(p.maxScore)} · você avaliou ${done} de ${total}</span></div>
      ${p.criteriaCount ? "" : alertBox("warn", "O administrador ainda não cadastrou critérios de apresentação ativos.")}
      ${p.groups.map(g => `<h4 class="sec-h">${icon(g.id ? "users" : "user", "sm")} ${esc(g.name)} · ${g.members.length} integrante(s)</h4>
        ${g.members.length ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Aluno</th><th>Sua avaliação</th><th class="num">Grupo</th><th class="num">Apresentação</th><th class="num">Final</th><th></th></tr></thead><tbody>
          ${g.members.map(m => { const [cls, label] = ST[m.state] || ST.NOT_STARTED; return `<tr><td><b>${esc(m.name)}</b><div class="cell-sub">${tag(cls, label)}${m.evaluators > 1 ? ` · ${m.evaluators} avaliadores (média)` : ""}</div></td>
            <td>${mine(m)}</td>
            <td class="num">${m.groupScore === null ? "—" : num(m.groupScore)}</td>
            <td class="num">${m.presentationScore === null ? "—" : num(m.presentationScore)}</td>
            <td class="num"><b>${m.finalScore === null ? "—" : num(m.finalScore)}</b></td>
            <td class="num"><button class="btn sm ${m.myEvaluation?.complete ? "ghost" : ""}" ${p.criteriaCount ? "" : "disabled"} onclick="TeacherArea.evalStudent('${p.activity.id}','${m.id}')">${m.myEvaluation ? "Ver / editar" : "Avaliar"}</button></td></tr>`; }).join("")}
        </tbody></table></div>` : '<p class="muted">Sem integrantes.</p>'}`).join("")}
      <div class="form-foot" style="margin-top:16px"><button class="btn secondary" onclick="TeacherArea.publishAll('${p.activity.id}')">${icon("publish")} Publicar notas prontas</button>
        <span class="help" style="margin:0">Publica as notas completas (documentos do grupo + apresentação).</span></div></div>`;
  },

  async refreshProjects() {
    this._projects = await api.tPresProjects();
    this.drawProject();
    this.refreshHome();
  },

  evalStudent(activityId, studentId) {
    guard(async () => {
      const ctx = await api.tPresStudent(activityId, studentId);
      const published = ctx.state === "PUBLISHED";
      openModal(`Avaliação individual — ${ctx.student.name}`, `
        <p class="kv"><b>Projeto:</b> ${esc(ctx.activity.title)}${ctx.group ? ` · <b>Grupo:</b> ${esc(ctx.group.name)}` : ""}</p>
        ${ctx.group ? `<p class="kv" style="margin-top:2px">Integrantes: ${ctx.group.members.map(m => m.id === ctx.student.id ? `<b>${esc(m.name)}</b>` : esc(m.name)).join(", ")}</p>` : ""}
        ${published ? `<div style="margin-top:12px">${alertBox("warn", "Esta nota já foi publicada. Para alterar, informe a justificativa (fica registrada no histórico).")}</div>` : ""}
        <h4 class="sec-h">${icon("criteria", "sm")} Critérios da apresentação</h4>
        <div class="table-wrap"><table class="sheet stack"><thead><tr><th>Critério</th><th class="num">Pontuação máx.</th><th class="num">Peso</th><th class="num">Nota atribuída</th></tr></thead><tbody>
          ${ctx.criteria.map(c => `<tr><td><b>${esc(c.title)}</b>${c.description ? `<div class="cell-sub">${esc(c.description)}</div>` : ""}</td>
            <td class="num" data-label="Pontuação máx.">${num(c.maxPoints)}</td><td class="num" data-label="Peso">${num(c.weight)}</td>
            <td class="num" data-label="Nota atribuída"><input type="number" class="pin" data-c="${c.id}" data-w="${c.weight}" data-m="${c.maxPoints}" min="0" max="${c.maxPoints}" step="0.25" value="${c.score ?? ""}" placeholder="0 a ${num(c.maxPoints)}" aria-label="Nota de ${esc(c.title)}"></td></tr>`).join("")}
        </tbody></table></div>
        <div class="eval-summary"><span>Nota individual da apresentação (sua avaliação)</span><span class="big" id="ptotal">—</span><span class="kv">de ${num(ctx.maxScore)}</span></div>
        <div class="field"><label for="pnotes">Observações sobre o desempenho do aluno</label><textarea id="pnotes" placeholder="Pontos fortes, o que melhorar...">${esc(ctx.notes || "")}</textarea></div>
        ${published ? '<div class="field"><label for="pjust">Justificativa da alteração (obrigatória)</label><input id="pjust"></div>' : ""}
        ${ctx.banca.length > 1 ? `<p class="kv">Banca: ${ctx.banca.map(b => `${esc(b.teacher)}${b.mine ? " (você)" : ""}: <b>${num(b.score)}</b>${b.complete ? "" : " (incompleta)"}`).join(" · ")} → média <b>${num(ctx.presentationScore)}</b></p>` : ""}
        <p class="kv" style="margin:6px 0 14px">Nota do grupo: <b>${ctx.groupScore === null ? "documentos ainda não avaliados" : num(ctx.groupScore)}</b> · Nota final atual: <b>${ctx.finalScore === null ? "—" : num(ctx.finalScore)}</b></p>
        <button class="btn ${published ? "danger solid" : ""}" id="psave">${icon("save")} ${published ? "Salvar revisão" : "Salvar avaliação"}</button>`);
      const calc = () => {
        let t = 0, filled = 0; const ins = [...document.querySelectorAll(".modal .pin")];
        ins.forEach(i => { if (i.value !== "") { t += Number(i.value) * Number(i.dataset.w); filled++; } });
        $("#ptotal").textContent = filled ? num(t) + (filled < ins.length ? " (incompleta)" : "") : "—";
      };
      document.querySelectorAll(".modal .pin").forEach(i => i.oninput = calc); calc();
      $("#psave").onclick = () => guard(async () => {
        const ins = [...document.querySelectorAll(".modal .pin")];
        for (const i of ins) if (i.value !== "" && (Number(i.value) < 0 || Number(i.value) > Number(i.dataset.m))) return toast(`Nota fora do intervalo (0 a ${i.dataset.m}).`, "err");
        const body = { scores: ins.map(i => ({ criterionId: i.dataset.c, score: i.value === "" ? null : Number(i.value) })), notes: $("#pnotes").value };
        if (published) { body.justification = $("#pjust").value.trim(); if (!body.justification) return toast("Informe a justificativa.", "err"); }
        const r = await api.tPresStudentSave(activityId, studentId, body);
        toast(`Avaliação de ${r.student.name} salva${r.myComplete ? "" : " (incompleta: faltam critérios)"}. Nota individual: ${num(r.myScore)}`);
        closeModal(); this.refreshProjects();
      });
    });
  },

  async publishAll(activityId) {
    await guard(async () => {
      if (!confirm("Publicar todas as notas já concluídas desta atividade?")) return;
      const r = await request("POST", `/api/teacher/activities/${activityId}/publish-all`);
      toast(`${r.published} nota(s) publicada(s).`); this.refreshProjects();
    });
  }
};

// ============ ÁREA DO ADMINISTRADOR ============
const AdminArea = {
  tab: "visao",
  render() {
    const view = mountTabs(this, [
      { key: "visao", label: "Visão geral", icon: "grid", section: "Painel" },
      { key: "cadastros", label: "Professores e alunos", icon: "id", section: "Cadastros" },
      { key: "grupos", label: "Grupos", icon: "users" },
      { key: "documentos", label: "Atividades e documentos", icon: "file", section: "Avaliação" },
      { key: "apresentacao", label: "Apresentação: critérios e banca", icon: "presentation" }
    ]);
    if (this.tab === "documentos") this.documentos(view);
    else if (this.tab === "apresentacao") this.apresentacao(view);
    else if (this.tab === "grupos") this.grupos(view);
    else if (this.tab === "cadastros") this.cadastros(view);
    else this.visao(view);
  },
  go(tab) { this.tab = tab; this.render(); },

  // ---- Visão geral: indicadores e resultados por atividade (dados reais) ----
  async visao(view) {
    await guard(async () => {
      const o = await api.adOverview();
      const alerts = [];
      if (o.studentsWithoutGroup) alerts.push(alertBox("warn", `<b>${o.studentsWithoutGroup} aluno(s) sem grupo</b> não conseguem enviar documentos em atividades em grupo. <a href="#" onclick="AdminArea.go('grupos');return false">Organizar grupos</a>`));
      if (!o.presentationCriteria) alerts.push(alertBox("info", `Nenhum critério de apresentação ativo. <a href="#" onclick="AdminArea.go('apresentacao');return false">Cadastrar critérios</a>`));
      const noBanca = o.byActivity.filter(a => !a.presentationTeachers);
      if (noBanca.length) alerts.push(alertBox("info", `Atividade(s) sem banca de apresentação: ${noBanca.map(a => esc(a.title)).join(", ")}.`));
      view.innerHTML = pageHead("Visão geral", "Situação dos projetos, das avaliações e dos cadastros do curso de Desenvolvimento de Sistemas.",
        `<button class="btn sm" onclick="AdminArea.go('documentos')">${icon("plus", "sm")} Nova atividade</button>
         <button class="btn sm ghost" onclick="AdminArea.go('cadastros')">${icon("id", "sm")} Cadastrar pessoas</button>
         <button class="btn sm ghost" onclick="AdminArea.go('grupos')">${icon("users", "sm")} Grupos</button>
         <button class="btn sm ghost" onclick="AdminArea.go('apresentacao')">${icon("criteria", "sm")} Critérios da apresentação</button>`)
        + alerts.join("")
        + `<div class="grid cols-4">
          ${stat("Alunos", o.students, o.studentsWithoutGroup ? `${o.studentsWithoutGroup} sem grupo` : "todos em grupos")}
          ${stat("Professores", o.teachers)}
          ${stat("Grupos", o.groups, "", "t-blue")}
          ${stat("Projetos cadastrados", o.activities.total, `${o.activities.open} aberto(s) para envio`, "t-yellow")}
        </div>
        <div class="grid cols-3" style="margin-top:16px">
          ${stat("Avaliações publicadas", o.evaluations.published, "notas finais visíveis aos alunos", "t-green")}
          ${stat("Prontas para publicar", o.evaluations.ready, "documentos + apresentação completos", "t-blue")}
          ${stat("Avaliações pendentes", o.evaluations.pending, "alunos ainda sem nota completa", "t-yellow")}
        </div>
        <div class="card" style="margin-top:16px"><div class="card-head"><h3>${icon("chart")} Resultados por atividade</h3><span class="meta">${o.presentationCriteria} critério(s) de apresentação ativo(s)</span></div>
          ${o.byActivity.length ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Atividade</th><th>Documentos enviados</th><th>Documentos avaliados</th><th>Apresentações avaliadas</th><th>Notas publicadas</th><th class="num">Média final</th></tr></thead><tbody>
            ${o.byActivity.map(a => `<tr><td><b>${esc(a.title)}</b><div class="cell-sub">${pill(a.status)} · ${a.mode === "GROUP" ? "em grupo" : "individual"} · ${prazo(a.dueDate)}</div></td>
              <td class="nowrap">${a.documentsSent} de ${a.units} ${progress(a.documentsSent, a.units)}</td>
              <td class="nowrap">${a.documentsEvaluated} de ${a.units} ${progress(a.documentsEvaluated, a.units)}</td>
              <td class="nowrap">${a.presentationsEvaluated} de ${a.students} ${progress(a.presentationsEvaluated, a.students, "yellow")}</td>
              <td class="nowrap">${a.published} de ${a.students} ${progress(a.published, a.students)}</td>
              <td class="num">${a.average === null ? "—" : num(a.average)}</td></tr>`).join("")}
          </tbody></table></div>` : emptyBox("Nenhuma atividade cadastrada ainda.", "folder")}
        </div>`;
    });
  },

  // ---- Cadastros: professores e alunos (curso único: Desenvolvimento de Sistemas) ----
  async cadastros(view) {
    await guard(async () => {
      const [users, students, groups] = await Promise.all([api.adListUsers("TEACHER"), api.adStudents(), api.adGroups()]);
      const profs = users;
      const statusPill = (u) => u.mustChangePassword ? tag("WARN", "Senha provisória") : tag("EVALUATED", "Acesso ativo");
      const groupOpts = (sel) => `<option value="">Sem grupo</option>` + groups.map(g => `<option value="${g.id}" ${sel === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("");
      view.innerHTML = pageHead("Professores e alunos", "Todos os alunos entram automaticamente na turma de Desenvolvimento de Sistemas. Cadastre com e-mail e senha provisória: no primeiro acesso, cada pessoa cria a própria senha.")
        + `<div class="grid cols-2">
          <div class="card"><h3>${icon("user")} Novo professor</h3><form id="ft">
            <div class="field"><label for="tn">Nome</label><input id="tn" required></div>
            <div class="field"><label for="te">E-mail</label><input id="te" type="email" required></div>
            <div class="field"><label for="tp">Senha provisória</label><input id="tp" type="text" required minlength="8" placeholder="mínimo de 8 caracteres"></div>
            <button class="btn">${icon("plus")} Cadastrar professor</button></form></div>
          <div class="card"><h3>${icon("user")} Novo aluno</h3><form id="fs">
            <div class="field"><label for="sn">Nome</label><input id="sn" required></div>
            <div class="field"><label for="se">E-mail</label><input id="se" type="email" required></div>
            <div class="field"><label for="sp">Senha provisória</label><input id="sp" type="text" required minlength="8" placeholder="mínimo de 8 caracteres"></div>
            <div class="row"><div><label class="muted" for="sr">Matrícula (opcional)</label><input id="sr"></div>
              <div><label class="muted" for="sg">Grupo</label><select id="sg">${groupOpts("")}</select></div></div>
            <div style="margin-top:14px"><button class="btn">${icon("plus")} Cadastrar aluno</button></div></form></div>
        </div>
        <div class="card"><div class="card-head"><h3>Alunos</h3><span class="meta">${students.length} cadastrado(s) · escolha o grupo de cada aluno</span></div>
          ${students.length ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Aluno</th><th>Acesso</th><th>Grupo</th><th></th></tr></thead><tbody>
            ${students.map(s => `<tr><td><b>${esc(s.name)}</b><div class="cell-sub">${esc(s.email)}${s.registrationNumber ? " · matrícula " + esc(s.registrationNumber) : ""}</div></td>
              <td>${statusPill(s)}</td>
              <td><select class="stgroup" data-s="${s.id}" aria-label="Grupo de ${esc(s.name)}" style="min-width:170px">${groupOpts(s.group?.id)}</select></td>
              <td class="num"><button class="btn sm ghost" onclick="AdminArea.resetPw('${s.userId}',${js(s.name)})">Redefinir senha</button></td></tr>`).join("")}
          </tbody></table></div>` : emptyBox("Nenhum aluno cadastrado.", "users")}
        </div>
        <div class="card"><div class="card-head"><h3>Professores</h3><span class="meta">${profs.length} cadastrado(s)</span></div>
          ${profs.length ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Professor</th><th>Acesso</th><th></th></tr></thead><tbody>
            ${profs.map(u => `<tr><td><b>${esc(u.name)}</b><div class="cell-sub">${esc(u.email)}</div></td><td>${statusPill(u)}</td>
              <td class="num"><button class="btn sm ghost" onclick="AdminArea.resetPw('${u.id}',${js(u.name)})">Redefinir senha</button></td></tr>`).join("")}
          </tbody></table></div>` : emptyBox("Nenhum professor cadastrado.", "user")}
        </div>`;
      $("#ft").onsubmit = (e) => { e.preventDefault(); guard(async () => {
        await api.adCreateTeacher({ name: $("#tn").value.trim(), email: $("#te").value.trim(), password: $("#tp").value });
        toast("Professor cadastrado. Informe o e-mail e a senha provisória a ele."); this.cadastros(view);
      }); };
      $("#fs").onsubmit = (e) => { e.preventDefault(); guard(async () => {
        await api.adCreateStudent({ name: $("#sn").value.trim(), email: $("#se").value.trim(), password: $("#sp").value,
          registrationNumber: $("#sr").value.trim() || undefined, groupId: $("#sg").value || undefined });
        toast("Aluno cadastrado" + ($("#sg").value ? " e adicionado ao grupo." : ".")); this.cadastros(view);
      }); };
      document.querySelectorAll(".stgroup").forEach(sel => sel.onchange = () => guard(async () => {
        await api.adSetStudentGroup(sel.dataset.s, sel.value);
        toast(sel.value ? "Aluno vinculado ao grupo." : "Aluno retirado do grupo.");
      }));
    });
  },
  resetPw(userId, name) {
    guard(async () => {
      const pw = prompt(`Nova senha provisória para ${name} (mínimo de 8 caracteres):`); if (!pw) return;
      await api.adResetPassword(userId, pw);
      toast("Senha provisória redefinida. Será exigida a troca no próximo acesso."); this.render();
    });
  },

  // ---- Grupos ----
  async grupos(view) {
    await guard(async () => {
      view.innerHTML = pageHead("Grupos", "Crie os grupos e escolha os alunos de cada um. A nota dos documentos vale para todo o grupo; cada aluno participa de um grupo só.")
        + `<div class="card"><h3>${icon("plus")} Novo grupo</h3><form id="fg">
          <div class="field"><label for="gname">Nome do grupo</label><input id="gname" placeholder="ex.: Equipe 1 — Sistema de Gestão Escolar" required></div>
          <label class="lbl">Alunos do grupo <span class="muted">(opcional; também dá para adicionar depois)</span></label>
          <div id="gfree" class="checks"></div>
          <div style="margin-top:14px"><button class="btn">Criar grupo</button></div></form></div>
        <div id="glist"></div>`;
      const load = async () => {
        const [groups, students] = await Promise.all([api.adGroups(), api.adStudents()]);
        const free = students.filter(s => !s.group);
        $("#gfree").innerHTML = free.length
          ? free.map(s => `<label class="check"><input type="checkbox" value="${s.id}"> ${esc(s.name)} <span class="muted">${esc(s.email)}</span></label>`).join("")
          : `<p class="muted">${students.length ? "Todos os alunos já estão em um grupo." : "Nenhum aluno cadastrado ainda (cadastre em Professores e alunos)."}</p>`;
        const freeOpts = free.map(s => `<option value="${s.id}">${esc(s.name)} — ${esc(s.email)}</option>`).join("");
        $("#glist").innerHTML = (free.length ? alertBox("warn", `<b>Alunos sem grupo (${free.length}):</b> ${free.map(s => esc(s.name)).join(", ")}`) : "")
          + (groups.length ? `<div class="grid cols-2">${groups.map(g => `<div class="card">
            <div class="card-head"><h3>${icon("users")} ${esc(g.name)}</h3><span class="meta">${g.members.length} aluno(s)</span></div>
            ${g.members.map(m => `<div class="list-item"><div class="info"><div class="title">${esc(m.name)}</div><div class="sub">${esc(m.email)}</div></div><button class="btn sm ghost" onclick="AdminArea.rmMember('${g.id}','${m.studentId}')">Remover</button></div>`).join("") || '<p class="muted">Sem integrantes.</p>'}
            ${free.length ? `<div class="row" style="margin-top:10px"><select class="addsel" data-g="${g.id}" aria-label="Aluno para adicionar">${freeOpts}</select>
            <button class="btn sm secondary" style="flex:0 0 auto" onclick="AdminArea.addMember('${g.id}')">Adicionar aluno</button></div>` : ""}
            <div class="form-foot" style="margin-top:12px"><button class="btn sm ghost" onclick="AdminArea.renameGroup('${g.id}',${js(g.name)})">${icon("pencil", "sm")} Renomear</button>
            <button class="btn sm danger" onclick="AdminArea.delGroup('${g.id}')">${icon("trash", "sm")} Excluir</button></div></div>`).join("")}</div>`
          : emptyBox("Nenhum grupo criado.", "users"));
      };
      this._loadGroups = load;
      $("#fg").onsubmit = (e) => { e.preventDefault(); guard(async () => {
        const studentIds = [...document.querySelectorAll("#gfree input:checked")].map(i => i.value);
        await api.adCreateGroup({ name: $("#gname").value.trim(), studentIds });
        $("#gname").value = ""; toast(`Grupo criado${studentIds.length ? ` com ${studentIds.length} aluno(s)` : ""}.`); load();
      }); };
      await load();
    });
  },
  addMember(gid) { guard(async () => { const sel = document.querySelector(`.addsel[data-g="${gid}"]`); if (!sel || !sel.value) return; await api.adAddMember(gid, sel.value); toast("Aluno adicionado ao grupo."); this._loadGroups(); }); },
  rmMember(gid, sid) { guard(async () => { await api.adRemoveMember(gid, sid); toast("Aluno removido do grupo."); this._loadGroups(); }); },
  renameGroup(id, current) { guard(async () => { const name = prompt("Novo nome do grupo:", current); if (!name || !name.trim()) return; await api.adRenameGroup(id, name.trim()); toast("Grupo renomeado."); this._loadGroups(); }); },
  delGroup(id) { guard(async () => { if (!confirm("Excluir este grupo? Os alunos ficam sem grupo.")) return; await api.adDeleteGroup(id); toast("Grupo excluído."); this._loadGroups(); }); },

  // ======== Linhas de critérios (nome + nota máxima) usadas nos formulários ========
  critRow(prefix, title = "", max = 10) {
    return `<div class="row crit-row" data-p="${prefix}"><input class="cr-t" placeholder="Nome do critério" value="${esc(title)}" aria-label="Nome do critério">
      <input class="cr-m" type="number" min="0.5" step="0.5" value="${max}" title="Nota máxima" aria-label="Nota máxima">
      <button type="button" class="btn sm ghost icon" onclick="this.parentElement.remove()" aria-label="Remover critério">${icon("x", "sm")}</button></div>`;
  },
  readCrit(prefix) {
    return [...document.querySelectorAll(`.crit-row[data-p="${prefix}"]`)]
      .map(r => ({ title: r.querySelector(".cr-t").value.trim(), maxPoints: Number(r.querySelector(".cr-m").value) }))
      .filter(c => c.title);
  },
  teacherBoxes(cls, teachers, selected = []) {
    const sel = new Set(selected);
    return teachers.length
      ? `<div class="checks">${teachers.map(t => `<label class="check"><input type="checkbox" class="${cls}" value="${t.id}" ${sel.has(t.id) ? "checked" : ""}> ${esc(t.name)} <span class="muted">${esc(t.email)}</span></label>`).join("")}</div>`
      : '<p class="muted">Nenhum professor cadastrado (cadastre em Professores e alunos).</p>';
  },
  checked(cls) { return [...document.querySelectorAll(`.${cls}:checked`)].map(i => i.value); },
  critList(a, list, part) {
    return list.length ? `<ul class="crit-ul">${list.map(c => `<li><span>${esc(c.title)}</span><span class="nowrap"><span class="muted">até ${num(c.maxPoints)}</span>
      ${a.criteriaLocked ? "" : `<button class="btn sm ghost icon" title="Excluir critério" aria-label="Excluir ${esc(c.title)}" onclick="AdminArea.delCrit('${a.id}','${c.id}',${js(c.title)})">${icon("trash", "sm")}</button>`}</span></li>`).join("")}</ul>`
      : `<p class="muted">Nenhum critério de ${part === "DOCUMENT" ? "documento" : "apresentação"}.</p>`;
  },
  addCritForm(a, part) {
    if (a.criteriaLocked) return `<p class="help">${icon("lock", "sm")} Já existem notas lançadas com estes critérios; não é mais possível alterá-los.</p>`;
    return `<div class="row crit-row" style="margin-top:8px"><input id="nc-${part}-${a.id}" class="cr-t" placeholder="Novo critério">
      <input id="nm-${part}-${a.id}" class="cr-m" type="number" min="0.5" step="0.5" value="10" title="Nota máxima">
      <button class="btn sm secondary" style="flex:0 0 auto" onclick="AdminArea.addCrit('${a.id}','${part}')">Adicionar</button></div>`;
  },

  // ======== Atividades e documentos (o que os grupos enviam) ========
  async documentos(view) {
    await guard(async () => {
      const [acts, teachers, students] = await Promise.all([api.activitiesList(), api.catTeachers(), api.adStudents()]);
      this._teachers = teachers;
      const semGrupo = students.filter(st => !st.group);
      view.innerHTML = pageHead("Atividades e documentos", "Cadastre o que os grupos devem enviar (ex.: Documento do TCC), o prazo, os critérios de avaliação do documento e os professores que vão corrigir. A nota dos documentos vale para todo o grupo.")
        + (semGrupo.length ? alertBox("warn", `<b>${semGrupo.length} aluno(s) sem grupo</b> não conseguem enviar documentos em atividades em grupo: ${semGrupo.map(st => esc(st.name)).join(", ")}. Inclua-os em Grupos.`) : "")
        + `<div class="card"><h3>${icon("plus")} Nova atividade</h3><form id="newact">
          <div class="row"><div style="flex:2"><label class="muted" for="atitle">Título</label><input id="atitle" required placeholder="ex.: Documento do TCC"></div>
            <div><label class="muted" for="am">Entrega</label><select id="am"><option value="GROUP">Em grupo</option><option value="INDIVIDUAL">Individual</option></select></div></div>
          <div class="field" style="margin-top:12px"><label for="ains">Orientações aos alunos</label><textarea id="ains" placeholder="O que deve ser enviado, formato, observações..."></textarea></div>
          <div class="row"><div><label class="muted" for="aod">Abertura (opcional)</label><input id="aod" type="date"></div><div><label class="muted" for="add">Prazo de envio</label><input id="add" type="date"></div>
            <div><label class="muted" for="af">Formatos aceitos</label><input id="af" value="pdf,docx,pptx,zip"></div>
            <div><label class="muted" for="ams">Máx. MB por arquivo</label><input id="ams" type="number" value="20" min="1" max="500"></div><div><label class="muted" for="amf">Máx. arquivos</label><input id="amf" type="number" value="5" min="1" max="50"></div></div>
          <div class="grid cols-2" style="margin-top:6px">
            <div><h4 class="sec-h">${icon("criteria", "sm")} Critérios de avaliação do documento</h4>
              <div id="dcrit">${this.critRow("new", "Estrutura e formatação", 10)}${this.critRow("new", "Conteúdo técnico", 10)}</div>
              <button type="button" class="btn sm ghost" id="addrow">${icon("plus", "sm")} Adicionar critério</button></div>
            <div><h4 class="sec-h">${icon("user", "sm")} Professores que avaliam os documentos</h4>${this.teacherBoxes("dt-new", teachers)}</div>
          </div>
          <div class="form-foot" style="margin-top:16px"><button class="btn">Cadastrar atividade</button>
            <label class="check"><input type="checkbox" id="aopen" checked> Já abrir para os alunos enviarem</label></div></form></div>
        <h4 class="sec-h">${icon("folder", "sm")} Atividades cadastradas (${acts.length})</h4>
        ${acts.length ? acts.map(a => `<div class="card">
            <div class="card-head"><h3>${esc(a.title)}</h3>${pill(a.status)}<span class="meta">${a.mode === "GROUP" ? "em grupo" : "individual"} · ${prazo(a.dueDate)}</span></div>
            <div class="grid cols-2">
              <div><div class="kv"><b>Critérios do documento</b> · máx. ${num(a.documentMax)}</div>${this.critList(a, a.documentCriteria, "DOCUMENT")}${this.addCritForm(a, "DOCUMENT")}</div>
              <div><div class="kv"><b>Professores (documentos)</b></div>${this.teacherBoxes(`dt-${a.id}`, teachers, a.documentTeachers.map(t => t.id))}
                <button class="btn sm secondary" style="margin-top:8px" onclick="AdminArea.saveTeachers('${a.id}','documents')">Salvar professores</button></div>
            </div>
            <div class="form-foot" style="margin-top:14px;justify-content:flex-end">
              ${a.status !== "OPEN" ? `<button class="btn sm green" onclick="AdminArea.setStatus('${a.id}','OPEN')">Abrir para envios</button>` : `<button class="btn sm ghost" onclick="AdminArea.setStatus('${a.id}','CLOSED')">Encerrar envios</button>`}
              <button class="btn sm danger" onclick="AdminArea.delActivity('${a.id}',${js(a.title)})">${icon("trash", "sm")} Excluir atividade</button></div>
          </div>`).join("") : emptyBox("Nenhuma atividade cadastrada.", "folder")}`;
      $("#addrow").onclick = () => $("#dcrit").insertAdjacentHTML("beforeend", this.critRow("new", "", 10));
      $("#newact").addEventListener("submit", (e) => { e.preventDefault(); guard(async () => {
        const documentTeacherIds = this.checked("dt-new");
        const documentCriteria = this.readCrit("new");
        if (!documentCriteria.length) return toast("Cadastre ao menos um critério de avaliação do documento.", "err");
        if (!documentTeacherIds.length) return toast("Marque ao menos um professor para avaliar os documentos.", "err");
        await api.activityCreate({
          title: $("#atitle").value.trim(), instructions: $("#ains").value.trim() || undefined, mode: $("#am").value,
          documentCriteria, documentTeacherIds, presentationTeacherIds: documentTeacherIds,
          status: $("#aopen").checked ? "OPEN" : "DRAFT",
          openDate: $("#aod").value || undefined, dueDate: $("#add").value ? $("#add").value + "T23:59:59" : undefined,
          allowedFormats: $("#af").value.split(",").map(s => s.trim()).filter(Boolean),
          maxFileSizeMb: Number($("#ams").value), maxFiles: Number($("#amf").value)
        });
        toast("Atividade cadastrada. Confira a banca em Apresentação: critérios e banca."); this.documentos(view);
      }); });
    });
  },

  // ======== Apresentação: critérios próprios e banca ========
  async apresentacao(view) {
    await guard(async () => {
      const [{ criteria, maxScore }, acts, teachers] = await Promise.all([api.adPresCriteria(), api.activitiesList(), api.catTeachers()]);
      this._teachers = teachers; this._pcrit = criteria;
      const row = (c, i) => `<tr class="${c.active ? "" : "inactive"}">
          <td class="nowrap"><button class="btn sm ghost icon" title="Subir" aria-label="Subir" ${i === 0 ? "disabled" : ""} onclick="AdminArea.movePres(${i},-1)">${icon("up", "sm")}</button> <button class="btn sm ghost icon" title="Descer" aria-label="Descer" ${i === criteria.length - 1 ? "disabled" : ""} onclick="AdminArea.movePres(${i},1)">${icon("down", "sm")}</button></td>
          <td><b>${esc(c.title)}</b>${c.description ? `<div class="cell-sub">${esc(c.description)}</div>` : ""}</td>
          <td class="num">${num(c.maxPoints)}</td><td class="num">${num(c.weight)}</td>
          <td><label class="check"><input type="checkbox" ${c.active ? "checked" : ""} onchange="AdminArea.togglePres('${c.id}',this.checked)"> ${c.active ? "ativo" : "inativo"}</label></td>
          <td class="num nowrap"><button class="btn sm ghost" onclick="AdminArea.editPres('${c.id}')">Editar</button>
            <button class="btn sm danger" onclick="AdminArea.delPres('${c.id}',${js(c.title)},${c.used})">Excluir</button></td></tr>`;
      view.innerHTML = pageHead("Apresentação: critérios e banca", "Os critérios da apresentação são independentes dos critérios dos documentos. Os critérios ativos aparecem automaticamente para os professores da banca, que avaliam cada aluno individualmente.")
        + `<div class="card"><div class="card-head"><h3>${icon("criteria")} Critérios de Avaliação da Apresentação</h3><span class="meta">nota máxima da apresentação: <b>${num(maxScore)}</b></span></div>
          ${criteria.length ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Ordem</th><th>Critério / orientação ao avaliador</th><th class="num">Pontuação máx.</th><th class="num">Peso</th><th>Situação</th><th></th></tr></thead>
            <tbody>${criteria.map(row).join("")}</tbody></table></div>` : emptyBox("Nenhum critério cadastrado. Cadastre abaixo.", "criteria")}
          <h4 class="sec-h">${icon("plus", "sm")} Novo critério</h4>
          <form id="fpc"><div class="row"><div style="flex:2"><label class="muted" for="pct">Nome do critério</label><input id="pct" required placeholder="ex.: Domínio do conteúdo apresentado"></div>
            <div><label class="muted" for="pcm">Pontuação máxima</label><input id="pcm" type="number" min="0.5" step="0.5" value="10" required></div>
            <div><label class="muted" for="pcw">Peso</label><input id="pcw" type="number" min="0.1" step="0.1" value="1" required></div></div>
            <div class="field" style="margin-top:12px"><label for="pcd">Descrição / orientação ao avaliador (opcional)</label><input id="pcd" placeholder="ex.: Explica o projeto com segurança e responde às perguntas da banca"></div>
            <div class="form-foot"><button class="btn">Cadastrar critério</button><label class="check"><input type="checkbox" id="pca" checked> Ativo (aparece para os professores)</label></div></form>
          <p class="help" style="margin-top:12px">Nota individual da apresentação = soma de (nota × peso) dos critérios ativos. Com mais de um professor na banca, vale a média das avaliações. Critérios já usados em avaliações não mudam de pontuação nem de peso; ao excluir, saem das telas, mas o histórico é mantido.</p>
        </div>
        <h4 class="sec-h">${icon("users", "sm")} Banca de cada atividade</h4>
        ${acts.length ? `<div class="grid cols-2">${acts.map(a => `<div class="card"><div class="card-head"><h3>${esc(a.title)}</h3><span class="meta">final máx. = ${num(a.documentMax)} + ${num(maxScore)} = <b>${num(a.documentMax + maxScore)}</b></span></div>
              ${this.teacherBoxes(`pt-${a.id}`, teachers, a.presentationTeachers.map(t => t.id))}
              <button class="btn sm secondary" style="margin-top:10px" onclick="AdminArea.saveTeachers('${a.id}','presentation')">Salvar banca</button></div>`).join("")}</div>`
          : emptyBox("Cadastre primeiro uma atividade em Atividades e documentos.", "folder")}`;
      $("#fpc").onsubmit = (e) => { e.preventDefault(); guard(async () => {
        await api.adPresCreate({ title: $("#pct").value.trim(), description: $("#pcd").value.trim(), maxPoints: Number($("#pcm").value), weight: Number($("#pcw").value), active: $("#pca").checked });
        toast("Critério cadastrado."); this.apresentacao(view);
      }); };
    });
  },
  movePres(i, dir) {
    guard(async () => {
      const ids = this._pcrit.map(c => c.id); const j = i + dir;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await api.adPresOrder(ids); this.render();
    });
  },
  togglePres(id, active) { guard(async () => { await api.adPresUpdate(id, { active }); toast(active ? "Critério ativado." : "Critério desativado (não aparece para os professores)."); this.render(); }); },
  editPres(id) {
    const c = this._pcrit.find(x => x.id === id); if (!c) return;
    openModal("Editar critério", `
      <div class="field"><label for="ept">Nome</label><input id="ept" value="${esc(c.title)}"></div>
      <div class="field"><label for="epd">Descrição / orientação ao avaliador</label><input id="epd" value="${esc(c.description || "")}"></div>
      <div class="row"><div><label class="muted" for="epm">Pontuação máxima</label><input id="epm" type="number" min="0.5" step="0.5" value="${c.maxPoints}" ${c.used ? "disabled" : ""}></div>
        <div><label class="muted" for="epw">Peso</label><input id="epw" type="number" min="0.1" step="0.1" value="${c.weight}" ${c.used ? "disabled" : ""}></div></div>
      ${c.used ? `<p class="help">${icon("lock", "sm")} Já usado em avaliações: pontuação máxima e peso não podem mudar.</p>` : ""}
      <div style="margin-top:16px"><button class="btn" id="eps">${icon("save")} Salvar</button></div>`);
    $("#eps").onclick = () => guard(async () => {
      const body = { title: $("#ept").value.trim(), description: $("#epd").value.trim() };
      if (!c.used) { body.maxPoints = Number($("#epm").value); body.weight = Number($("#epw").value); }
      await api.adPresUpdate(id, body); toast("Critério atualizado."); closeModal(); this.render();
    });
  },
  delPres(id, title, used) {
    guard(async () => {
      if (!confirm(used ? `"${title}" já foi usado em avaliações. Ele sairá das telas, mas as notas já dadas ficam no histórico. Continuar?` : `Excluir o critério "${title}"?`)) return;
      await api.adPresDelete(id); toast("Critério excluído."); this.render();
    });
  },

  addCrit(activityId, part) {
    guard(async () => {
      const t = $(`#nc-${part}-${activityId}`), m = $(`#nm-${part}-${activityId}`);
      if (!t.value.trim()) return toast("Informe o nome do critério.", "err");
      await api.activityAddCriterion(activityId, { part, title: t.value.trim(), maxPoints: Number(m.value) });
      toast("Critério adicionado."); this.render();
    });
  },
  delCrit(activityId, criterionId, title) {
    guard(async () => { if (!confirm(`Excluir o critério "${title}"?`)) return; await api.activityDelCriterion(activityId, criterionId); toast("Critério excluído."); this.render(); });
  },
  saveTeachers(activityId, role) {
    guard(async () => {
      const ids = this.checked(`${role === "documents" ? "dt" : "pt"}-${activityId}`);
      if (role === "documents" && !ids.length) return toast("Marque ao menos um professor para os documentos.", "err");
      await api.activityUpdate(activityId, role === "documents" ? { documentTeacherIds: ids } : { presentationTeacherIds: ids });
      toast(role === "documents" ? "Professores salvos." : "Banca salva.");
    });
  },
  delActivity(id, title) { guard(async () => { if (!confirm(`Excluir a atividade "${title}"?`)) return; await api.activityDelete(id); toast("Atividade excluída."); this.render(); }); },
  setStatus(id, status) { guard(async () => { await api.activitySetStatus(id, status); toast(status === "OPEN" ? "Atividade aberta para envios." : "Envios encerrados."); this.render(); }); }
};

// ============ Boot ============
renderApp();
