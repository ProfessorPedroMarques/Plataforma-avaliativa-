// ============ Helpers de UI ============
const $ = (sel, root = document) => root.querySelector(sel);
const appEl = () => document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
// Argumento seguro para onclick="fn(...)" (aspas e apóstrofos em nomes não quebram o HTML/JS).
const js = (s) => esc(JSON.stringify(String(s ?? "")));
const fmtDay = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const num = (n) => (n === null || n === undefined) ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const STATUS_LABEL = {
  NOT_STARTED: "Não iniciado", IN_PROGRESS: "Em andamento", SUBMITTED: "Enviado", UNDER_REVIEW: "Em avaliação",
  EVALUATED: "Avaliado", RETURNED: "Devolvido", RESUBMITTED: "Reenviado", DRAFT: "Rascunho", OPEN: "Aberta",
  CLOSED: "Encerrada", ARCHIVED: "Arquivada", PUBLISHED: "Publicada", REVISED: "Revisada", CONCLUDED: "Concluída"
};
const pill = (s) => s ? `<span class="pill ${s}">${esc(STATUS_LABEL[s] || s)}</span>` : "";

function toast(msg, type = "ok") {
  let box = document.getElementById("toast");
  if (!box) { box = document.createElement("div"); box.id = "toast"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast ${type}`; t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
async function guard(fn) { try { await fn(); } catch (e) { toast(e.message || "Erro", "err"); } }

function openModal(title, html) {
  closeModal();
  const bg = document.createElement("div");
  bg.className = "modal-bg"; bg.id = "modal-bg";
  bg.innerHTML = `<div class="modal"><button class="close" onclick="closeModal()">×</button><h3>${esc(title)}</h3><div id="modal-body">${html}</div></div>`;
  bg.addEventListener("click", (e) => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
}
function closeModal() { const m = document.getElementById("modal-bg"); if (m) m.remove(); }

// Bloco visual com a composição da nota: grupo (documentos) + apresentação = final
function scoreBox({ groupScore, groupMax, presentationScore, presentationMax, finalScore, maxScore }) {
  return `<div class="scorebox">
    <div class="sb"><div class="sb-l">📄 Nota do grupo<br><small>documentos</small></div><div class="sb-v">${num(groupScore)}<small> / ${num(groupMax)}</small></div></div>
    <div class="sb-op">+</div>
    <div class="sb"><div class="sb-l">🎤 Apresentação<br><small>individual</small></div><div class="sb-v">${num(presentationScore)}<small> / ${num(presentationMax)}</small></div></div>
    <div class="sb-op">=</div>
    <div class="sb final"><div class="sb-l">⭐ Nota final</div><div class="sb-v">${num(finalScore)}<small> / ${num(maxScore)}</small></div></div>
  </div>`;
}

// Linhas de critério com campos de nota + comentário
function criteriaInputs(list, cls) {
  if (!list.length) return '<p class="muted">Nenhum critério cadastrado pelo administrador para esta etapa.</p>';
  return list.map((c, i) => `
    <div class="crit"><div class="chead"><span class="ctitle">${i + 1}. ${esc(c.title)}${c.required ? ' <span style="color:var(--red)">*</span>' : ""}</span><span class="cmax">máx ${num(c.maxPoints)}${Number(c.weight) !== 1 ? " · peso " + num(c.weight) : ""}</span></div>
    ${c.description ? `<div class="cdesc">${esc(c.description)}</div>` : ""}${c.guidance ? `<div class="cdesc">🎯 ${esc(c.guidance)}</div>` : ""}
    <div class="cinputs"><input type="number" min="0" max="${c.maxPoints}" step="0.1" data-cid="${c.id}" class="${cls}-score" placeholder="nota" value="${c.score ?? ""}">
    <input type="text" data-cid="${c.id}" class="${cls}-comment" placeholder="comentário sobre este critério" value="${esc(c.comment ?? "")}"></div></div>`).join("");
}
function collectInputs(cls) {
  return [...document.querySelectorAll(`.${cls}-score`)].map(inp => ({
    criterionId: inp.dataset.cid,
    score: inp.value === "" ? null : Number(inp.value),
    comment: document.querySelector(`.${cls}-comment[data-cid="${inp.dataset.cid}"]`).value || null
  }));
}

// ============ Shell / roteamento ============
function renderApp() {
  if (!Auth.isLogged) return renderLogin();
  if (Auth.user?.mustChangePassword) return renderChangePassword(true);
  renderShell();
}

function renderLogin() {
  document.body.innerHTML = `
  <div class="login-wrap">
    <div class="login-card">
      <div class="logo" style="margin-bottom:18px"><div class="logo-icon">PA</div>
        <div><h1>Plataforma de Avaliação</h1><span>Gestão Educacional</span></div></div>
      <h2>Entrar</h2>
      <p class="muted">Acesse com seu e-mail e senha. No primeiro acesso, use a senha provisória recebida.</p>
      <form id="login-form">
        <div class="field"><label>E-mail</label><input id="email" type="email" required placeholder="voce@escola.dev" autocomplete="username"></div>
        <div class="field"><label>Senha</label><input id="password" type="password" required placeholder="••••••••" autocomplete="current-password"></div>
        <button class="btn" style="width:100%" id="login-btn">Entrar</button>
      </form>
      <p class="muted" style="margin-top:14px;font-size:12px">Servidor: <span class="mono">${esc(API_URL)}</span></p>
    </div>
  </div>
  <div id="toast"></div>`;
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#login-btn"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Entrando...';
    try {
      const session = await api.login($("#email").value.trim(), $("#password").value);
      Auth.set(session);
      if (!session.user.mustChangePassword) toast(`Bem-vindo(a), ${session.user.name}!`);
      renderApp();
    } catch (err) {
      toast(err.message, "err"); btn.disabled = false; btn.textContent = "Entrar";
    }
  });
}

// Troca de senha: obrigatória no 1º acesso (senha provisória) ou voluntária.
function renderChangePassword(forced) {
  const form = `
      <form id="pw-form">
        <div class="field"><label>${forced ? "Senha provisória" : "Senha atual"}</label><input id="pw-cur" type="password" required autocomplete="current-password"></div>
        <div class="field"><label>Nova senha (mín. 8 caracteres)</label><input id="pw-new" type="password" required minlength="8" autocomplete="new-password"></div>
        <div class="field"><label>Confirme a nova senha</label><input id="pw-conf" type="password" required minlength="8" autocomplete="new-password"></div>
        <button class="btn" style="width:100%" id="pw-btn">Salvar nova senha</button>
      </form>`;
  if (forced) {
    document.body.innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <div class="logo" style="margin-bottom:18px"><div class="logo-icon">PA</div><div><h1>Plataforma de Avaliação</h1><span>Primeiro acesso</span></div></div>
      <h2>Crie sua senha</h2>
      <p class="muted">Olá, ${esc(Auth.user.name)}! Você entrou com uma <b>senha provisória</b>. Para continuar, defina uma senha pessoal.</p>
      ${form}
      <button class="btn ghost" style="width:100%;margin-top:10px" onclick="logout()">Sair</button>
    </div></div><div id="toast"></div>`;
  } else {
    openModal("Alterar senha", form);
  }
  $("#pw-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("#pw-new").value !== $("#pw-conf").value) return toast("A confirmação não confere com a nova senha.", "err");
    guard(async () => {
      const session = await api.changePassword($("#pw-cur").value, $("#pw-new").value);
      Auth.set(session);
      toast("Senha alterada com sucesso!");
      closeModal();
      renderApp();
    });
  });
}

function logout() { Auth.clear(); renderApp(); }

function renderShell() {
  const u = Auth.user;
  const roleLabel = { ADMIN: "Administrador", TEACHER: "Professor", STUDENT: "Aluno" }[u.role] || u.role;
  document.body.innerHTML = `
    <header class="header">
      <div class="logo"><div class="logo-icon">PA</div>
        <div><h1>Plataforma de Avaliação</h1><span>${esc(roleLabel)}</span></div></div>
      <div class="header-right">
        <span class="badge-role">${esc(roleLabel.toUpperCase())}</span>
        <span>${esc(u.name)}</span>
        <button class="btn-logout" onclick="renderChangePassword(false)">Alterar senha</button>
        <button class="btn-logout" onclick="logout()">Sair</button>
      </div>
    </header>
    <main class="container" id="app"></main>
    <div class="footer">Plataforma de Avaliação Educacional • v2.0</div>
    <div id="toast"></div>`;
  if (u.role === "ADMIN") AdminArea.render();
  else if (u.role === "TEACHER") TeacherArea.render();
  else StudentArea.render();
}

function tabs(items, active, onSelect) {
  const nav = document.createElement("div");
  nav.className = "nav-tabs";
  items.forEach(it => {
    const b = document.createElement("button");
    b.textContent = it.label; if (it.key === active) b.classList.add("active");
    b.onclick = () => onSelect(it.key);
    nav.appendChild(b);
  });
  return nav;
}
function mountTabs(area, items) {
  appEl().innerHTML = "";
  appEl().appendChild(tabs(items, area.tab, (k) => { area.tab = k; area.render(); }));
  const view = document.createElement("div"); view.id = "view"; appEl().appendChild(view);
  view.innerHTML = '<div class="empty"><span class="spinner"></span> Carregando...</div>';
  return view;
}

// ============ ÁREA DO ALUNO ============
const StudentArea = {
  tab: "dashboard",
  render() {
    const view = mountTabs(this, [
      { key: "dashboard", label: "📊 Minhas Notas" },
      { key: "envios", label: "📤 Enviar Documentos" }
    ]);
    if (this.tab === "dashboard") this.dashboard(view); else this.envios(view);
  },

  // Dashboard com as notas
  async dashboard(view) {
    await guard(async () => {
      const [acts, grades] = await Promise.all([api.stActivities(), api.stGrades()]);
      const pend = acts.filter(a => a.windowOpen && (!a.mySubmission || ["NOT_STARTED", "IN_PROGRESS", "RETURNED", "RESUBMITTED"].includes(a.mySubmission.status)));
      const media = grades.length ? grades.reduce((s, g) => s + g.finalScore, 0) / grades.length : null;
      view.innerHTML = `
        <div class="welcome"><span class="tag">ÁREA DO ALUNO</span>
          <h2>Olá, ${esc(Auth.user.name)}! 👋</h2>
          <p>Acompanhe suas notas e envie os documentos do seu grupo.</p></div>
        <div class="grid cols-3">
          <div class="stat"><div class="num">${grades.length}</div><div class="lbl">Notas publicadas</div></div>
          <div class="stat"><div class="num">${media === null ? "—" : num(media)}</div><div class="lbl">Média das notas finais</div></div>
          <div class="stat"><div class="num">${pend.length}</div><div class="lbl">Envios pendentes</div></div>
        </div>
        ${pend.length ? `<div class="card" style="margin-top:16px;border-color:rgba(255,191,71,.4)"><h3>⏰ Documentos pendentes</h3>${pend.map(a => `
          <div class="list-item"><div class="info"><div class="title">${esc(a.title)}</div><div class="sub">Prazo: ${fmtDay(a.dueDate)}${a.myGroup ? " · Grupo: " + esc(a.myGroup.name) : ""}</div></div>
          <button class="btn sm" onclick="StudentArea.goActivity('${a.id}')">Enviar</button></div>`).join("")}</div>` : ""}
        <div class="card" style="margin-top:16px"><h3>📊 Minhas notas</h3>
          <p class="muted" style="margin-bottom:10px">Nota final = <b>nota do grupo</b> (documentos enviados) + <b>nota da apresentação</b> (individual).</p>
          ${grades.length ? grades.map(g => `
            <div class="grade-card">
              <div class="gc-head"><div><div class="title">${esc(g.activity?.title || "Avaliação")}</div>
                <div class="sub">${g.group ? "Grupo: " + esc(g.group.name) + " · " : ""}Publicada em ${fmtDay(g.publishedAt)} ${pill(g.status)}</div></div>
                <button class="btn sm" onclick="StudentArea.gradeDetail('${g.resultId}')">Ver detalhes</button></div>
              ${scoreBox(g)}
            </div>`).join("") : '<div class="empty">Nenhuma nota publicada ainda. Assim que o professor publicar, ela aparecerá aqui.</div>'}
        </div>`;
    });
  },

  goActivity(id) { this.tab = "envios"; this.render(); setTimeout(() => this.openActivity(id), 200); },

  async envios(view) {
    await guard(async () => {
      const acts = await api.stActivities();
      view.innerHTML = `<div class="card"><h3>📤 Atividades para envio de documentos</h3>${
        acts.length ? acts.map(a => `<div class="list-item"><div class="info"><div class="title">${esc(a.title)}</div>
          <div class="sub">${a.mode === "GROUP" ? "👥 Em grupo" + (a.myGroup ? ": " + esc(a.myGroup.name) : " (você ainda não está em um grupo)") : "👤 Individual"} · Prazo: ${fmtDay(a.dueDate)} · ${a.windowOpen ? pill("OPEN") : pill(a.status)}</div></div>
          <div>${a.mySubmission ? pill(a.mySubmission.status) + " " : ""}<button class="btn sm" onclick="StudentArea.openActivity('${a.id}')">Abrir</button></div></div>`).join("")
          : '<div class="empty">Nenhuma atividade disponível.</div>'
      }</div>`;
    });
  },

  async openActivity(id) {
    await guard(async () => {
      const a = await api.stActivity(id);
      const subs = await api.stSubmissions();
      const mine = subs.find(s => s.activity.id === id);
      const fmts = (a.allowedFormats || []).join(", ") || "qualquer";
      let body = `<p class="muted">${esc(a.description || "")}</p>
        <div class="card" style="background:#0a1226"><b>Orientações:</b> ${esc(a.instructions || "—")}<br>
        <b>Prazo:</b> ${fmtDay(a.dueDate)} · <b>Formatos aceitos:</b> ${esc(fmts)} · <b>Máx.:</b> ${a.maxFiles} arquivo(s) de até ${a.maxFileSizeMb} MB</div>`;
      if (a.mode === "GROUP") {
        body += a.myGroup
          ? `<p>👥 Entrega do grupo <b>${esc(a.myGroup.name)}</b> — qualquer integrante pode enviar; todos veem os mesmos arquivos.</p>`
          : `<div class="card" style="border-color:rgba(255,93,108,.5)">Você ainda não está em um grupo, por isso não consegue enviar. Peça ao administrador para incluí-lo em um grupo (Admin › Grupos).</div>`;
      }
      if (!mine && (a.mode !== "GROUP" || a.myGroup)) {
        body += a.windowOpen ? `<form id="newsub"><div class="field"><label>Título do trabalho</label><input id="st" required placeholder="ex.: TCC — Sistema de Agendamento"></div>
          <div class="field"><label>Observações (opcional)</label><textarea id="sd"></textarea></div>
          <div class="field"><label>Documentos (${esc(fmts)})</label><input type="file" id="nfiles" multiple required></div>
          <button class="btn green">📤 Enviar documentos ao professor</button></form>` : '<p class="muted">O prazo de envio não está aberto.</p>';
      } else if (mine) {
        body += `<p>Situação do envio: ${pill(mine.status)}</p>
          <button class="btn" onclick="StudentArea.manageSubmission('${mine.id}')">Abrir envio</button>`;
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
          toast("Documentos enviados ao professor! ✅"); closeModal(); this.render();
        });
      });
    });
  },

  async manageSubmission(id) {
    await guard(async () => {
      const s = await api.stSubmission(id);
      const canEdit = ["NOT_STARTED", "IN_PROGRESS", "RETURNED", "RESUBMITTED"].includes(s.status);
      const files = s.versions.flatMap(v => v.files.map(f => ({ ...f, v: v.versionNumber })));
      let body = `<p><b>Atividade:</b> ${esc(s.activity.title)} · ${pill(s.status)}${s.group ? ` · 👥 ${esc(s.group.name)}` : ""}</p>
        <div class="card" style="background:#0a1226"><b>Documentos enviados:</b><br>${
          files.length ? files.map(f => `<div class="list-item"><div class="info"><div class="title">${esc(f.originalName)}</div><div class="sub">versão ${f.v} · ${(f.sizeBytes / 1024).toFixed(1)} KB</div></div><button class="btn sm ghost" data-dl="/api/student/files/${f.id}/download" data-name="${esc(f.originalName)}">Baixar</button></div>`).join("") : '<span class="muted">Nenhum documento ainda.</span>'
        }</div>`;
      if (canEdit) {
        body += `${files.length ? "" : '<div class="card" style="border-color:rgba(255,191,71,.5)">⚠️ Nenhum documento anexado ainda.</div>'}
          <div class="field"><label>Anexar documentos (${esc((s.activity.allowedFormats || []).join(", ") || "qualquer formato")})</label><input type="file" id="files" multiple></div>
          <button class="btn green" id="submit">📤 Enviar documentos ao professor</button>
          <p class="muted" style="font-size:12px;margin-top:6px">Os arquivos selecionados são anexados e o envio é confirmado no mesmo clique. Depois disso, seguem para avaliação e não podem mais ser alterados.</p>`;
      } else if (s.status === "EVALUATED") {
        body += `<p class="muted">Documentos avaliados. Veja sua nota em "Minhas Notas".</p>`;
      } else {
        body += `<p class="muted">Documentos enviados. Aguarde a avaliação do professor.</p>`;
      }
      openModal("Envio de documentos", body);
      document.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => downloadFile(b.dataset.dl, b.dataset.name));
      if (canEdit) {
        $("#submit").onclick = () => guard(async () => {
          const inp = $("#files");
          if (!inp.files.length && !files.length) return toast("Selecione ao menos um arquivo.", "err");
          if (inp.files.length) await uploadFiles(`/api/student/submissions/${id}/files`, inp.files);
          await api.stSubmit(id); toast("Documentos enviados ao professor! ✅"); closeModal(); this.render();
        });
      }
    });
  },

  async gradeDetail(id) {
    await guard(async () => {
      const g = await api.stGrade(id);
      const crit = (list) => list.map(c => `<div class="crit"><div class="chead"><span class="ctitle">${esc(c.title)}</span><span class="cmax">${num(c.score)} / ${num(c.maxPoints)}</span></div>${c.comment ? `<div class="cdesc">💬 ${esc(c.comment)}</div>` : ""}</div>`).join("") || '<p class="muted">—</p>';
      openModal("Detalhe da nota", `
        <p><b>${esc(g.activity?.title || "")}</b>${g.group ? " · Grupo " + esc(g.group.name) : ""}</p>
        ${scoreBox(g)}
        <h4 class="sec-h">📄 Documentos do grupo</h4>${crit(g.documentCriteria)}
        ${g.documentFeedback ? `<div class="card" style="background:#0a1226"><b>Comentário do professor sobre os documentos:</b><br>${esc(g.documentFeedback)}</div>` : ""}
        <h4 class="sec-h">🎤 Sua apresentação (avaliação individual)${g.evaluators > 1 ? ` <span class="muted" style="font-size:12px">média de ${g.evaluators} avaliadores</span>` : ""}</h4>${crit(g.presentationCriteria)}
        ${(g.presentationNotes || []).map(n => `<div class="card" style="background:#0a1226"><b>Observações de ${esc(n.teacher)}:</b><br>${esc(n.notes)}</div>`).join("")}
        <p class="muted" style="margin-top:8px">Avaliada em ${fmtDate(g.evaluatedAt)} · Publicada em ${fmtDate(g.publishedAt)}</p>`);
    });
  }
};

// ============ ÁREA DO PROFESSOR ============
const TeacherArea = {
  tab: "documentos",
  render() {
    const view = mountTabs(this, [
      { key: "documentos", label: "📄 Documentos dos Grupos" },
      { key: "apresentacao", label: "🎤 Avaliação da Apresentação" },
      { key: "dashboard", label: "📊 Resumo" }
    ]);
    if (this.tab === "documentos") this.documentos(view);
    else if (this.tab === "apresentacao") this.apresentacao(view);
    else this.dashboard(view);
  },

  async dashboard(view) {
    await guard(async () => {
      const d = await api.tDashboard();
      view.innerHTML = `
        <div class="welcome"><span class="tag">ÁREA DO PROFESSOR</span><h2>Olá, ${esc(Auth.user.name)}!</h2>
          <p>1º avalie os documentos enviados (nota do grupo) · 2º avalie a apresentação (nota individual) · 3º publique.</p></div>
        <div class="grid cols-4">
          <div class="stat"><div class="num">${d.turmasVinculadas}</div><div class="lbl">Turmas</div></div>
          <div class="stat"><div class="num">${d.totalAlunos}</div><div class="lbl">Alunos</div></div>
          <div class="stat"><div class="num">${d.projetosRecebidos}</div><div class="lbl">Envios recebidos</div></div>
          <div class="stat"><div class="num">${d.resultadosAguardandoPublicacao}</div><div class="lbl">Notas aguardando publicação</div></div>
        </div>
        <div class="card" style="margin-top:16px"><h3>Envios por situação</h3>
          ${Object.entries(d.submissionsByStatus || {}).map(([s, n]) => `<span style="margin-right:12px">${pill(s)} <b>${n}</b></span>`).join("") || '<span class="muted">Sem envios.</span>'}</div>`;
    });
  },

  // ---- 1) Documentos: atividade → critérios → grupos → integrantes ----
  async documentos(view) {
    await guard(async () => {
      const list = await api.tDocsOverview();
      if (!list.length) {
        view.innerHTML = '<div class="card"><h3>📄 Documentos dos Grupos</h3><div class="empty">Você ainda não avalia documentos de nenhuma atividade. O administrador define isso em "📄 Atividades — Documentos".</div></div>';
        return;
      }
      const SUB = (e) => {
        const s = e.submission;
        if (e.published) return '<span class="pill PUBLISHED">nota publicada</span>';
        if (e.evaluated) return `<span class="pill EVALUATED">avaliado · ${num(e.groupScore)}</span>`;
        if (!s || !s.files) return '<span class="pill DRAFT">ainda não enviou</span>';
        if (["NOT_STARTED", "IN_PROGRESS"].includes(s.status)) return `<span class="pill IN_PROGRESS">⚠️ ${s.files} arquivo(s), envio não confirmado</span>`;
        return `<span class="pill SUBMITTED">📎 ${s.files} arquivo(s) enviado(s)</span>`;
      };
      view.innerHTML = `<div class="welcome"><span class="tag">ÁREA DO PROFESSOR</span><h2>📄 Documentos dos Grupos</h2>
        <p>Para cada atividade, veja os critérios cadastrados, os grupos e seus integrantes. Clique em <b>Avaliar documentos</b> para baixar os arquivos e dar a nota do grupo.</p></div>
        ${list.map(x => `<div class="card">
          <h3>${esc(x.activity.title)} ${pill(x.activity.status)} <span class="muted" style="font-size:13px;margin-left:auto">prazo ${fmtDay(x.activity.dueDate)}</span></h3>
          <div class="card" style="background:#0a1226"><b>📋 Critérios dos documentos</b> <span class="muted">(nota máxima do grupo: ${num(x.documentMax)})</span>
            ${x.documentCriteria.length ? `<ul class="crit-ul">${x.documentCriteria.map(c => `<li>${esc(c.title)} — até ${num(c.maxPoints)}${c.description ? ` <span class="muted">· ${esc(c.description)}</span>` : ""}</li>`).join("")}</ul>` : '<p class="muted">Nenhum critério cadastrado pelo administrador.</p>'}</div>
          ${x.ungrouped.length ? `<div class="card" style="border-color:rgba(255,191,71,.4)">⚠️ Alunos sem grupo: ${x.ungrouped.map(esc).join(", ")} — o administrador precisa incluí-los em um grupo.</div>` : ""}
          ${x.entries.length ? x.entries.map(e => `<div class="list-item"><div class="info">
              <div class="title">${e.kind === "GROUP" ? "👥 " : "👤 "}${esc(e.name)}</div>
              <div class="sub">${e.kind === "GROUP" ? `Integrantes: ${e.members.map(m => esc(m.name)).join(", ") || "<i>nenhum</i>"} · ` : ""}${SUB(e)}</div></div>
            <button class="btn sm" ${e.members.length ? "" : "disabled"} onclick="TeacherArea.openDocs('${x.activity.id}','${e.groupId || ""}','${e.studentId || ""}')">${e.evaluated ? "Ver / editar nota" : "Avaliar documentos"}</button></div>`).join("")
            : `<div class="empty">${x.activity.mode === "GROUP" ? "Nenhum grupo cadastrado." : "Nenhum aluno."}</div>`}
        </div>`).join("")}`;
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
      const who = ctx.group ? `👥 Grupo <b>${esc(ctx.group.name)}</b>: ${ctx.owners.map(o => esc(o.name)).join(", ")}` : `👤 ${esc(ctx.owners[0]?.name || "")}`;
      openModal("Avaliação dos documentos", `
        <p>${who}</p><p class="muted">${esc(ctx.activity.title)} · ${pill(ctx.submission.status)}</p>
        <div class="card" style="background:#0a1226"><b>📎 Documentos:</b><br>${ctx.submission.files.map(f => `<button class="btn sm ghost" style="margin:4px 4px 0 0" data-dl="/api/teacher/files/${f.id}/download" data-name="${esc(f.originalName)}">⬇ ${esc(f.originalName)}</button>`).join("") || '<span class="muted">Sem arquivos.</span>'}
          ${ctx.submission.description ? `<p class="muted" style="margin-top:6px">Observação dos alunos: ${esc(ctx.submission.description)}</p>` : ""}</div>
        ${ctx.locked ? '<div class="card" style="border-color:rgba(255,191,71,.5)">As notas deste grupo já foram publicadas. Alterações só pelo fluxo de revisão na aba de apresentação.</div>' : ""}
        <h4 class="sec-h">Critérios dos documentos</h4>
        ${criteriaInputs(ctx.documentCriteria, "doc")}
        <div class="field"><label>Comentário geral sobre os documentos (visível aos alunos após a publicação)</label><textarea id="docfb">${esc(ctx.documentFeedback ?? "")}</textarea></div>
        <p>Nota do grupo atual: <b class="score-inline">${num(ctx.groupScore)} / ${num(ctx.groupMax)}</b></p>
        ${ctx.locked ? "" : '<button class="btn" id="savedoc">Salvar notas dos documentos</button>'}
        <h4 class="sec-h">🔒 Observações internas (não visíveis aos alunos)</h4>
        <div>${(det.notes || []).map(n => `<div class="sub">📝 ${esc(n.content)} <span class="muted">— ${esc(n.author?.name || "")}, ${fmtDay(n.createdAt)}</span></div>`).join("") || '<span class="muted">Nenhuma.</span>'}</div>
        <div class="row" style="margin-top:6px"><input id="note" placeholder="Nova observação interna"><button class="btn sm ghost" id="addnote" style="flex:0 0 auto">Registrar</button></div>`);
      document.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => downloadFile(b.dataset.dl, b.dataset.name));
      if ($("#savedoc")) $("#savedoc").onclick = () => guard(async () => {
        const r = await api.tDocSave(submissionId, { scores: collectInputs("doc"), feedback: $("#docfb").value });
        toast(`Notas salvas. Nota do grupo: ${num(r.groupScore)}`);
        this.evaluateDocs(submissionId);
        if (this.tab === "documentos" && $("#view")) this.documentos($("#view"));
      });
      $("#addnote").onclick = () => guard(async () => {
        const c = $("#note").value.trim(); if (!c) return;
        await api.tAddNote(submissionId, c); toast("Observação registrada."); this.evaluateDocs(submissionId);
      });
    });
  },

  // ---- 2) Avaliação da apresentação: projeto → integrantes → avaliação INDIVIDUAL ----
  async apresentacao(view) {
    await guard(async () => {
      const projects = await api.tPresProjects();
      this._projects = projects;
      if (!projects.length) {
        view.innerHTML = '<div class="card"><h3>🎤 Avaliação da Apresentação</h3><div class="empty">Você ainda não está na banca de nenhuma apresentação. O administrador define isso em "🎤 Avaliação da Apresentação".</div></div>';
        return;
      }
      if (!this._act || !projects.some(p => p.activity.id === this._act)) this._act = projects[0].activity.id;
      view.innerHTML = `<div class="welcome"><span class="tag">ÁREA DO PROFESSOR</span><h2>🎤 Avaliação da Apresentação</h2>
        <p>Escolha o projeto, depois o aluno. Cada integrante recebe a <b>sua própria nota</b>, pelos critérios de apresentação cadastrados pelo administrador. A nota final soma a nota do grupo (documentos) com a nota individual da apresentação.</p></div>
        <div class="card">${projects.length > 1 ? `<div class="field"><label>Projeto / atividade</label><select id="act">${projects.map(p => `<option value="${p.activity.id}" ${p.activity.id === this._act ? "selected" : ""}>${esc(p.activity.title)}</option>`).join("")}</select></div>` : ""}
          <div id="presbox"></div></div>`;
      if ($("#act")) $("#act").onchange = (e) => { this._act = e.target.value; this.drawProject(); };
      this.drawProject();
    });
  },

  drawProject() {
    const p = (this._projects || []).find(x => x.activity.id === this._act); const box = $("#presbox");
    if (!p || !box) return;
    const ST = { NOT_STARTED: ["DRAFT", "não avaliado"], IN_PROGRESS: ["IN_PROGRESS", "em andamento"], READY: ["EVALUATED", "pronta para publicar"], PUBLISHED: ["PUBLISHED", "publicada"] };
    const mineTxt = (m) => !m.myEvaluation ? '<span class="muted">você ainda não avaliou</span>'
      : m.myEvaluation.complete ? `✅ sua nota: <b>${num(m.myEvaluation.score)}</b>` : `✏️ sua avaliação está incompleta (${num(m.myEvaluation.score)})`;
    box.innerHTML = `<h3>${esc(p.activity.title)}</h3>
      ${p.criteriaCount ? `<p class="muted" style="font-size:13px">${p.criteriaCount} critério(s) de apresentação · nota máxima ${num(p.maxScore)}</p>` : '<div class="card" style="border-color:rgba(255,191,71,.5)">⚠️ O administrador ainda não cadastrou critérios de apresentação ativos.</div>'}
      ${p.groups.map(g => `<div class="card" style="background:#0a1226"><h3>${g.id ? "👥 " : "👤 "}${esc(g.name)} <span class="muted" style="font-size:13px">(${g.members.length} integrante(s))</span></h3>
        ${g.members.length ? g.members.map(m => { const [cls, label] = ST[m.state] || ST.NOT_STARTED; return `<div class="list-item"><div class="info">
          <div class="title">${esc(m.name)} <span class="pill ${cls}">${label}</span></div>
          <div class="sub">${mineTxt(m)} · 📄 grupo ${m.groupScore === null ? "—" : num(m.groupScore)} + 🎤 apresentação ${m.presentationScore === null ? "—" : num(m.presentationScore)} = ⭐ <b>${m.finalScore === null ? "—" : num(m.finalScore)}</b>${m.evaluators > 1 ? ` · ${m.evaluators} avaliadores (média)` : ""}</div></div>
          <button class="btn sm" ${p.criteriaCount ? "" : "disabled"} onclick="TeacherArea.evalStudent('${p.activity.id}','${m.id}')">${m.myEvaluation ? "Ver / editar" : "Avaliar"}</button></div>`; }).join("") : '<p class="muted">Sem integrantes.</p>'}
      </div>`).join("")}
      <div class="row" style="margin-top:8px"><button class="btn green" style="flex:0 0 auto" onclick="TeacherArea.publishAll('${p.activity.id}')">📢 Publicar notas prontas</button>
        <span class="muted" style="font-size:12px;align-self:center">Publica as notas completas (documentos do grupo + apresentação).</span></div>`;
  },

  async refreshProjects() {
    this._projects = await api.tPresProjects();
    this.drawProject();
  },

  evalStudent(activityId, studentId) {
    guard(async () => {
      const ctx = await api.tPresStudent(activityId, studentId);
      const published = ctx.state === "PUBLISHED";
      openModal(`Avaliação individual — ${ctx.student.name}`, `
        <p><b>Projeto:</b> ${esc(ctx.activity.title)}${ctx.group ? ` · <b>Grupo:</b> ${esc(ctx.group.name)}` : ""}</p>
        ${ctx.group ? `<p class="muted" style="font-size:13px">Integrantes: ${ctx.group.members.map(m => m.id === ctx.student.id ? `<b>${esc(m.name)}</b>` : esc(m.name)).join(", ")}</p>` : ""}
        ${published ? '<div class="card" style="border-color:rgba(255,191,71,.5)">Esta nota já foi publicada. Para alterar, informe a justificativa (fica registrada no histórico).</div>' : ""}
        <div style="overflow-x:auto"><table class="sheet"><thead><tr><th>Critério</th><th>Pontuação máx.</th><th>Peso</th><th>Nota atribuída</th></tr></thead><tbody>
          ${ctx.criteria.map(c => `<tr><td><b>${esc(c.title)}</b>${c.description ? `<div class="muted" style="font-size:12px">${esc(c.description)}</div>` : ""}</td>
            <td>${num(c.maxPoints)}</td><td>${num(c.weight)}</td>
            <td><input type="number" class="pin" data-c="${c.id}" data-w="${c.weight}" data-m="${c.maxPoints}" min="0" max="${c.maxPoints}" step="0.25" value="${c.score ?? ""}" placeholder="0–${num(c.maxPoints)}"></td></tr>`).join("")}
        </tbody></table></div>
        <p style="margin-top:8px">Nota individual da apresentação (sua avaliação): <b class="score-inline" id="ptotal">—</b> / ${num(ctx.maxScore)}</p>
        <div class="field"><label>Observações sobre o desempenho do aluno</label><textarea id="pnotes" placeholder="Pontos fortes, o que melhorar...">${esc(ctx.notes || "")}</textarea></div>
        ${published ? '<div class="field"><label>Justificativa da alteração (obrigatória)</label><input id="pjust"></div>' : ""}
        ${ctx.banca.length > 1 ? `<p class="muted" style="font-size:13px">Banca: ${ctx.banca.map(b => `${esc(b.teacher)}${b.mine ? " (você)" : ""}: ${num(b.score)}${b.complete ? "" : " (incompleta)"}`).join(" · ")} → média ${num(ctx.presentationScore)}</p>` : ""}
        <p class="muted" style="font-size:13px">📄 Nota do grupo: ${ctx.groupScore === null ? "documentos ainda não avaliados" : num(ctx.groupScore)} · ⭐ Nota final atual: ${ctx.finalScore === null ? "—" : num(ctx.finalScore)}</p>
        <button class="btn ${published ? "danger" : ""}" id="psave">${published ? "Salvar revisão" : "💾 Salvar avaliação"}</button>`);
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

// ============ ÁREA DO ADMIN ============
const AdminArea = {
  tab: "cadastros",
  render() {
    const view = mountTabs(this, [
      { key: "cadastros", label: "👤 Professores e Alunos" },
      { key: "grupos", label: "👥 Grupos" },
      { key: "documentos", label: "📄 Atividades — Documentos" },
      { key: "apresentacao", label: "🎤 Avaliação da Apresentação" }
    ]);
    if (this.tab === "documentos") this.documentos(view);
    else if (this.tab === "apresentacao") this.apresentacao(view);
    else if (this.tab === "grupos") this.grupos(view);
    else this.cadastros(view);
  },

  // ---- Cadastros: professores e alunos (curso único: Desenvolvimento de Sistemas) ----
  async cadastros(view) {
    await guard(async () => {
      const [users, students, groups] = await Promise.all([api.adListUsers("TEACHER"), api.adStudents(), api.adGroups()]);
      const profs = users;
      const statusPill = (u) => u.mustChangePassword ? '<span class="pill IN_PROGRESS">senha provisória</span>' : '<span class="pill EVALUATED">acesso ativo</span>';
      const groupOpts = (sel) => `<option value="">— sem grupo —</option>` + groups.map(g => `<option value="${g.id}" ${sel === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("");
      const profRow = (u) => `<div class="list-item"><div class="info"><div class="title">${esc(u.name)} ${statusPill(u)}</div><div class="sub">${esc(u.email)}</div></div>
        <button class="btn sm ghost" onclick="AdminArea.resetPw('${u.id}',${js(u.name)})">Redefinir senha</button></div>`;
      const studentRow = (s) => `<div class="list-item"><div class="info"><div class="title">${esc(s.name)} ${statusPill(s)}</div><div class="sub">${esc(s.email)}${s.registrationNumber ? " · matrícula " + esc(s.registrationNumber) : ""}</div></div>
        <div class="row" style="flex:0 0 auto;align-items:center"><select class="stgroup" data-s="${s.id}" title="Grupo do aluno" style="min-width:150px">${groupOpts(s.group?.id)}</select>
        <button class="btn sm ghost" onclick="AdminArea.resetPw('${s.userId}',${js(s.name)})">Redefinir senha</button></div></div>`;
      view.innerHTML = `<div class="welcome"><span class="tag">ADMINISTRAÇÃO</span><h2>Professores e Alunos</h2>
        <p>Curso: <b>Desenvolvimento de Sistemas</b>. Todos os alunos entram automaticamente na turma do curso. Cadastre com e-mail e <b>senha provisória</b>: no primeiro acesso, cada pessoa cria a própria senha.</p></div>
        <div class="grid cols-2">
          <div class="card"><h3>👩‍🏫 Novo professor avaliador</h3><form id="ft">
            <div class="field"><label>Nome</label><input id="tn" required></div>
            <div class="field"><label>E-mail</label><input id="te" type="email" required></div>
            <div class="field"><label>Senha provisória (mín. 8)</label><input id="tp" type="text" required minlength="8" placeholder="ex.: Escola@2026"></div>
            <button class="btn">Cadastrar professor</button></form></div>
          <div class="card"><h3>🧑‍🎓 Novo aluno</h3><form id="fs">
            <div class="field"><label>Nome</label><input id="sn" required></div>
            <div class="field"><label>E-mail</label><input id="se" type="email" required></div>
            <div class="field"><label>Senha provisória (mín. 8)</label><input id="sp" type="text" required minlength="8" placeholder="ex.: Aluno@2026"></div>
            <div class="row"><div><label class="muted">Matrícula (opcional)</label><input id="sr"></div>
              <div><label class="muted">Grupo</label><select id="sg">${groupOpts("")}</select></div></div>
            <button class="btn" style="margin-top:10px">Cadastrar aluno</button></form></div>
        </div>
        <div class="grid cols-2">
          <div class="card"><h3>Professores (${profs.length})</h3>${profs.map(profRow).join("") || '<div class="empty">Nenhum professor.</div>'}</div>
          <div class="card"><h3>Alunos (${students.length}) <span class="muted" style="font-size:13px;margin-left:auto">escolha o grupo de cada aluno</span></h3>${students.map(studentRow).join("") || '<div class="empty">Nenhum aluno.</div>'}</div>
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
      const pw = prompt(`Nova senha provisória para ${name} (mín. 8 caracteres):`); if (!pw) return;
      await api.adResetPassword(userId, pw);
      toast("Senha provisória redefinida. Será exigida a troca no próximo acesso."); this.render();
    });
  },

  // ---- Grupos ----
  async grupos(view) {
    await guard(async () => {
      view.innerHTML = `<div class="welcome"><span class="tag">ADMINISTRAÇÃO</span><h2>Grupos</h2>
        <p>Crie os grupos e escolha os alunos de cada um. A nota dos documentos vale para todo o grupo. Cada aluno participa de um grupo só.</p></div>
        <div class="card"><h3>Novo grupo</h3><form id="fg">
          <div class="field"><label>Nome do grupo</label><input id="gname" placeholder="ex.: Equipe 1" required></div>
          <label class="muted">Alunos do grupo (opcional — também dá para adicionar depois)</label>
          <div id="gfree" class="checks"></div>
          <button class="btn" style="margin-top:10px">Criar grupo</button></form></div>
        <div id="glist"></div>`;
      const load = async () => {
        const [groups, students] = await Promise.all([api.adGroups(), api.adStudents()]);
        const free = students.filter(s => !s.group);
        $("#gfree").innerHTML = free.length
          ? free.map(s => `<label class="check"><input type="checkbox" value="${s.id}"> ${esc(s.name)} <span class="muted">— ${esc(s.email)}</span></label>`).join("")
          : `<p class="muted">${students.length ? "Todos os alunos já estão em um grupo." : "Nenhum aluno cadastrado ainda (cadastre na aba Professores e Alunos)."}</p>`;
        const freeOpts = free.map(s => `<option value="${s.id}">${esc(s.name)} — ${esc(s.email)}</option>`).join("");
        $("#glist").innerHTML = (free.length ? `<div class="card" style="border-color:rgba(255,191,71,.4)"><b>Alunos sem grupo (${free.length}):</b> ${free.map(s => esc(s.name)).join(", ")}</div>` : "")
          + (groups.length ? groups.map(g => `<div class="card"><h3>👥 ${esc(g.name)} <span class="muted" style="font-size:13px">(${g.members.length} aluno(s))</span>
            <span style="margin-left:auto"></span><button class="btn sm ghost" onclick="AdminArea.renameGroup('${g.id}',${js(g.name)})">Renomear</button>
            <button class="btn sm danger" onclick="AdminArea.delGroup('${g.id}')">Excluir</button></h3>
          ${g.members.map(m => `<div class="list-item"><div class="info"><div class="title">${esc(m.name)}</div><div class="sub">${esc(m.email)}</div></div><button class="btn sm ghost" onclick="AdminArea.rmMember('${g.id}','${m.studentId}')">Remover</button></div>`).join("") || '<p class="muted">Sem integrantes.</p>'}
          ${free.length ? `<div class="row" style="margin-top:8px"><select class="addsel" data-g="${g.id}">${freeOpts}</select>
          <button class="btn sm" style="flex:0 0 auto" onclick="AdminArea.addMember('${g.id}')">Adicionar aluno</button></div>` : ""}</div>`).join("")
          : '<div class="empty">Nenhum grupo criado.</div>');
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
    return `<div class="row crit-row" data-p="${prefix}"><input class="cr-t" placeholder="Nome do critério" value="${esc(title)}">
      <input class="cr-m" type="number" min="0.5" step="0.5" value="${max}" style="max-width:120px" title="Nota máxima">
      <button type="button" class="btn sm ghost" style="flex:0 0 auto" onclick="this.parentElement.remove()">✕</button></div>`;
  },
  readCrit(prefix) {
    return [...document.querySelectorAll(`.crit-row[data-p="${prefix}"]`)]
      .map(r => ({ title: r.querySelector(".cr-t").value.trim(), maxPoints: Number(r.querySelector(".cr-m").value) }))
      .filter(c => c.title);
  },
  teacherBoxes(cls, teachers, selected = []) {
    const sel = new Set(selected);
    return teachers.length
      ? `<div class="checks">${teachers.map(t => `<label class="check"><input type="checkbox" class="${cls}" value="${t.id}" ${sel.has(t.id) ? "checked" : ""}> ${esc(t.name)} <span class="muted">— ${esc(t.email)}</span></label>`).join("")}</div>`
      : '<p class="muted">Nenhum professor cadastrado (cadastre na aba Professores e Alunos).</p>';
  },
  checked(cls) { return [...document.querySelectorAll(`.${cls}:checked`)].map(i => i.value); },
  critList(a, list, part) {
    return list.length ? list.map(c => `<div class="list-item"><div class="info"><div class="title">${esc(c.title)}</div><div class="sub">nota máxima ${num(c.maxPoints)}</div></div>
      ${a.criteriaLocked ? "" : `<button class="btn sm danger" onclick="AdminArea.delCrit('${a.id}','${c.id}',${js(c.title)})">Excluir</button>`}</div>`).join("")
      : `<p class="muted">Nenhum critério de ${part === "DOCUMENT" ? "documento" : "apresentação"}.</p>`;
  },
  addCritForm(a, part) {
    if (a.criteriaLocked) return '<p class="muted" style="font-size:12px">🔒 Já existem notas lançadas com estes critérios; não é mais possível alterá-los.</p>';
    return `<div class="row" style="margin-top:6px"><input id="nc-${part}-${a.id}" placeholder="Novo critério">
      <input id="nm-${part}-${a.id}" type="number" min="0.5" step="0.5" value="10" style="max-width:110px" title="Nota máxima">
      <button class="btn sm" style="flex:0 0 auto" onclick="AdminArea.addCrit('${a.id}','${part}')">Adicionar</button></div>`;
  },

  // ======== 📄 MENU 1: Atividades — Documentos (o que os grupos enviam) ========
  async documentos(view) {
    await guard(async () => {
      const [acts, teachers, students] = await Promise.all([api.activitiesList(), api.catTeachers(), api.adStudents()]);
      this._teachers = teachers;
      const semGrupo = students.filter(st => !st.group);
      view.innerHTML = `<div class="welcome"><span class="tag">ADMINISTRAÇÃO</span><h2>📄 Atividades — Documentos</h2>
        <p>Cadastre o que os grupos devem enviar (ex.: <b>Documento do TCC</b>), o prazo, os <b>critérios de avaliação do documento</b> e os <b>professores que vão corrigir</b>. A nota dos documentos vale para todo o grupo.</p></div>
        ${semGrupo.length ? `<div class="card" style="border-color:rgba(255,191,71,.5)">⚠️ <b>${semGrupo.length} aluno(s) sem grupo</b> não conseguem enviar documentos em atividades em grupo: ${semGrupo.map(st => esc(st.name)).join(", ")}. Inclua-os na aba <b>Grupos</b>.</div>` : ""}
        <div class="card"><h3>Nova atividade de envio de documentos</h3><form id="newact">
          <div class="row"><div><label class="muted">Título</label><input id="atitle" required placeholder="ex.: Documento do TCC"></div>
            <div><label class="muted">Entrega</label><select id="am"><option value="GROUP">Em grupo</option><option value="INDIVIDUAL">Individual</option></select></div></div>
          <div class="field" style="margin-top:8px"><label>Orientações aos alunos</label><textarea id="ains" placeholder="O que deve ser enviado, formato, observações..."></textarea></div>
          <div class="row"><div><label class="muted">Abertura (opcional)</label><input id="aod" type="date"></div><div><label class="muted">Prazo de envio</label><input id="add" type="date"></div></div>
          <div class="row"><div><label class="muted">Formatos aceitos (vírgula)</label><input id="af" value="pdf,docx,pptx,zip"></div>
            <div><label class="muted">Máx. MB por arquivo</label><input id="ams" type="number" value="20" min="1" max="500"></div><div><label class="muted">Máx. arquivos</label><input id="amf" type="number" value="5" min="1" max="50"></div></div>
          <h4 class="sec-h">📋 Critérios de avaliação do documento</h4>
          <div id="dcrit">${this.critRow("new", "Estrutura e formatação", 10)}${this.critRow("new", "Conteúdo técnico", 10)}</div>
          <button type="button" class="btn sm ghost" id="addrow" style="margin-top:6px">+ Adicionar critério</button>
          <h4 class="sec-h">👩‍🏫 Professores que avaliam os documentos</h4>
          ${this.teacherBoxes("dt-new", teachers)}
          <label style="display:flex;gap:6px;align-items:center;color:var(--muted);margin:10px 0"><input type="checkbox" id="aopen" checked style="width:auto"> já abrir para os alunos enviarem</label>
          <button class="btn">Cadastrar atividade</button></form></div>
        <div class="card"><h3>Atividades cadastradas (${acts.length})</h3>${acts.length ? acts.map(a => `
          <div class="card" style="background:#0a1226">
            <h3>${esc(a.title)} ${pill(a.status)} <span class="muted" style="font-size:13px;margin-left:auto">${a.mode === "GROUP" ? "👥 em grupo" : "👤 individual"} · prazo ${fmtDay(a.dueDate)}</span></h3>
            <div class="grid cols-2">
              <div><b>📋 Critérios do documento</b> <span class="muted">(máx. ${num(a.documentMax)})</span>${this.critList(a, a.documentCriteria, "DOCUMENT")}${this.addCritForm(a, "DOCUMENT")}</div>
              <div><b>👩‍🏫 Professores (documentos)</b>${this.teacherBoxes(`dt-${a.id}`, teachers, a.documentTeachers.map(t => t.id))}
                <button class="btn sm" style="margin-top:6px" onclick="AdminArea.saveTeachers('${a.id}','documents')">Salvar professores</button></div>
            </div>
            <div class="row" style="margin-top:10px;justify-content:flex-end">
              ${a.status !== "OPEN" ? `<button class="btn sm green" style="flex:0 0 auto" onclick="AdminArea.setStatus('${a.id}','OPEN')">Abrir para envios</button>` : `<button class="btn sm ghost" style="flex:0 0 auto" onclick="AdminArea.setStatus('${a.id}','CLOSED')">Encerrar envios</button>`}
              <button class="btn sm danger" style="flex:0 0 auto" onclick="AdminArea.delActivity('${a.id}',${js(a.title)})">Excluir atividade</button></div>
          </div>`).join("") : '<div class="empty">Nenhuma atividade cadastrada.</div>'}</div>`;
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
        toast("Atividade cadastrada! Agora configure a apresentação no menu 🎤."); this.documentos(view);
      }); });
    });
  },

  // ======== 🎤 MENU 2: Avaliação da Apresentação ========
  async apresentacao(view) {
    await guard(async () => {
      const [{ criteria, maxScore }, acts, teachers] = await Promise.all([api.adPresCriteria(), api.activitiesList(), api.catTeachers()]);
      this._teachers = teachers; this._pcrit = criteria;
      const row = (c, i) => `<tr class="${c.active ? "" : "inactive"}">
          <td class="nowrap"><button class="btn sm ghost" title="Subir" ${i === 0 ? "disabled" : ""} onclick="AdminArea.movePres(${i},-1)">↑</button><button class="btn sm ghost" title="Descer" ${i === criteria.length - 1 ? "disabled" : ""} onclick="AdminArea.movePres(${i},1)">↓</button></td>
          <td><b>${esc(c.title)}</b>${c.description ? `<div class="muted" style="font-size:12px">${esc(c.description)}</div>` : ""}</td>
          <td>${num(c.maxPoints)}</td><td>${num(c.weight)}</td>
          <td><label class="check"><input type="checkbox" ${c.active ? "checked" : ""} onchange="AdminArea.togglePres('${c.id}',this.checked)"> ${c.active ? "ativo" : "inativo"}</label></td>
          <td class="nowrap"><button class="btn sm ghost" onclick="AdminArea.editPres('${c.id}')">Editar</button>
            <button class="btn sm danger" onclick="AdminArea.delPres('${c.id}',${js(c.title)},${c.used})">Excluir</button></td></tr>`;
      view.innerHTML = `<div class="welcome"><span class="tag">ADMINISTRAÇÃO</span><h2>🎤 Avaliação da Apresentação</h2>
        <p>Os critérios da apresentação são <b>independentes</b> dos critérios dos documentos. Os critérios <b>ativos</b> aparecem automaticamente para os professores da banca, que avaliam <b>cada aluno individualmente</b>.</p></div>
        <div class="card"><h3>📋 Critérios de Avaliação da Apresentação <span class="muted" style="font-size:13px;margin-left:auto">nota máxima da apresentação: <b>${num(maxScore)}</b></span></h3>
          ${criteria.length ? `<div style="overflow-x:auto"><table class="sheet"><thead><tr><th>Ordem</th><th>Critério / orientação ao avaliador</th><th>Pontuação máx.</th><th>Peso</th><th>Situação</th><th></th></tr></thead>
            <tbody>${criteria.map(row).join("")}</tbody></table></div>` : '<div class="empty">Nenhum critério cadastrado. Cadastre abaixo.</div>'}
          <h4 class="sec-h">Novo critério</h4>
          <form id="fpc"><div class="row"><div style="flex:2"><label class="muted">Nome do critério</label><input id="pct" required placeholder="ex.: Domínio do conteúdo apresentado"></div>
            <div><label class="muted">Pontuação máxima</label><input id="pcm" type="number" min="0.5" step="0.5" value="10" required></div>
            <div><label class="muted">Peso</label><input id="pcw" type="number" min="0.1" step="0.1" value="1" required></div></div>
            <div class="field" style="margin-top:8px"><label>Descrição / orientação ao avaliador (opcional)</label><input id="pcd" placeholder="ex.: Explica o projeto com segurança e responde às perguntas da banca"></div>
            <label class="check" style="margin:6px 0 10px"><input type="checkbox" id="pca" checked> ativo (aparece para os professores)</label>
            <button class="btn">Cadastrar critério</button></form>
          <p class="muted" style="font-size:12px;margin-top:8px">Nota individual da apresentação = soma de (nota × peso) dos critérios ativos. Com mais de um professor na banca, vale a média das avaliações. Critérios já usados em avaliações não mudam de pontuação nem de peso; ao excluir, saem das telas, mas o histórico é mantido.</p>
        </div>
        <div class="card"><h3>👩‍🏫 Banca de cada atividade</h3>
          <p class="muted" style="font-size:13px">Marque os professores que avaliam a apresentação em cada atividade.</p>
          ${acts.length ? acts.map(a => `<div class="card" style="background:#0a1226"><h3>🎤 ${esc(a.title)} <span class="muted" style="font-size:13px;margin-left:auto">nota final máx. = documentos ${num(a.documentMax)} + apresentação ${num(maxScore)} = <b>${num(a.documentMax + maxScore)}</b></span></h3>
              ${this.teacherBoxes(`pt-${a.id}`, teachers, a.presentationTeachers.map(t => t.id))}
              <button class="btn sm" style="margin-top:6px" onclick="AdminArea.saveTeachers('${a.id}','presentation')">Salvar banca</button></div>`).join("")
            : '<div class="empty">Cadastre primeiro uma atividade no menu "📄 Atividades — Documentos".</div>'}
        </div>`;
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
    openModal(`Editar critério`, `
      <div class="field"><label>Nome</label><input id="ept" value="${esc(c.title)}"></div>
      <div class="field"><label>Descrição / orientação ao avaliador</label><input id="epd" value="${esc(c.description || "")}"></div>
      <div class="row"><div><label class="muted">Pontuação máxima</label><input id="epm" type="number" min="0.5" step="0.5" value="${c.maxPoints}" ${c.used ? "disabled" : ""}></div>
        <div><label class="muted">Peso</label><input id="epw" type="number" min="0.1" step="0.1" value="${c.weight}" ${c.used ? "disabled" : ""}></div></div>
      ${c.used ? '<p class="muted" style="font-size:12px">🔒 Já usado em avaliações: pontuação máxima e peso não podem mudar.</p>' : ""}
      <button class="btn" id="eps" style="margin-top:10px">Salvar</button>`);
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
