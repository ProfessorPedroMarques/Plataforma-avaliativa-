// ============ Helpers de UI ============
const $ = (sel, root = document) => root.querySelector(sel);
const appEl = () => document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (d) => d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const fmtDay = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const pill = (s) => `<span class="pill ${s}">${esc(s)}</span>`;

function toast(msg, type = "ok") {
  let box = document.getElementById("toast");
  if (!box) { box = document.createElement("div"); box.id = "toast"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast ${type}`; t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3500);
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

// ============ Shell / roteamento ============
function renderApp() {
  if (!Auth.isLogged) return renderLogin();
  renderShell();
}

function renderLogin() {
  document.body.innerHTML = `
  <div class="login-wrap">
    <div class="login-card">
      <div class="logo" style="margin-bottom:18px"><div class="logo-icon">PA</div>
        <div><h1>Plataforma de Avaliação</h1><span>Gestão Educacional</span></div></div>
      <h2>Entrar</h2>
      <p class="muted">Acesse com seu e-mail e senha.</p>
      <form id="login-form">
        <div class="field"><label>E-mail</label><input id="email" type="email" required placeholder="voce@escola.dev"></div>
        <div class="field"><label>Senha</label><input id="password" type="password" required placeholder="••••••••"></div>
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
      toast(`Bem-vindo(a), ${session.user.name}!`);
      renderApp();
    } catch (err) {
      toast(err.message, "err"); btn.disabled = false; btn.textContent = "Entrar";
    }
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
        <span class="badge-role">${esc(u.role)}</span>
        <span>${esc(u.name)}</span>
        <button class="btn-logout" onclick="logout()">Sair</button>
      </div>
    </header>
    <main class="container" id="app"></main>
    <div class="footer">Plataforma de Avaliação Educacional • v1.0.0</div>
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

// ============ ÁREA DO ALUNO ============
const StudentArea = {
  tab: "dashboard",
  render() {
    appEl().innerHTML = "";
    appEl().appendChild(tabs([
      { key: "dashboard", label: "Início" },
      { key: "projetos", label: "Meus Projetos" },
      { key: "notas", label: "Minhas Notas" }
    ], this.tab, (k) => { this.tab = k; this.render(); }));
    const view = document.createElement("div"); view.id = "view"; appEl().appendChild(view);
    if (this.tab === "dashboard") this.dashboard(view);
    else if (this.tab === "projetos") this.projetos(view);
    else this.notas(view);
  },
  async dashboard(view) {
    view.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const [acts, subs, grades] = await Promise.all([api.stActivities(), api.stSubmissions(), api.stGrades()]);
      const byStatus = (s) => subs.filter(x => x.status === s).length;
      view.innerHTML = `
        <div class="welcome"><span class="tag">ÁREA DO ALUNO</span>
          <h2>Olá, ${esc(Auth.user.name)}! 👋</h2>
          <p>Acompanhe suas atividades, envios e notas em um só lugar.</p></div>
        <div class="grid cols-4">
          <div class="stat"><div class="num">${acts.length}</div><div class="lbl">Atividades disponíveis</div></div>
          <div class="stat"><div class="num">${byStatus("SUBMITTED") + byStatus("UNDER_REVIEW")}</div><div class="lbl">Enviados / em avaliação</div></div>
          <div class="stat"><div class="num">${byStatus("EVALUATED")}</div><div class="lbl">Avaliados</div></div>
          <div class="stat"><div class="num">${grades.length}</div><div class="lbl">Notas publicadas</div></div>
        </div>
        <div class="card" style="margin-top:16px"><h3>Atividades em aberto</h3>${
          acts.filter(a => a.windowOpen).length
            ? acts.filter(a => a.windowOpen).map(a => `<div class="list-item"><div class="info"><div class="title">${esc(a.title)}</div><div class="sub">Prazo: ${fmtDay(a.dueDate)} · ${esc(a.schoolClass?.name || "")}</div></div>${a.mySubmission ? pill(a.mySubmission.status) : `<button class="btn sm" onclick="StudentArea.goActivity('${a.id}')">Ver</button>`}</div>`).join("")
            : '<div class="empty">Nenhuma atividade aberta no momento.</div>'
        }</div>`;
    });
  },
  goActivity(id) { this.tab = "projetos"; this.render(); setTimeout(() => this.openActivity(id), 150); },
  async projetos(view) {
    view.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const acts = await api.stActivities();
      view.innerHTML = `<div class="card"><h3>Atividades disponíveis</h3>${
        acts.length ? acts.map(a => `<div class="list-item"><div class="info"><div class="title">${esc(a.title)}</div>
          <div class="sub">${esc(a.subject?.name || "")} · Prazo: ${fmtDay(a.dueDate)} · ${a.windowOpen ? pill("OPEN") : pill(a.status)}</div></div>
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
        <b>Prazo:</b> ${fmtDay(a.dueDate)} · <b>Formatos:</b> ${esc(fmts)} · <b>Máx:</b> ${a.maxFiles} arquivo(s), ${a.maxFileSizeMb}MB</div>`;
      if (!mine) {
        body += `<form id="newsub"><div class="field"><label>Título do projeto</label><input id="st" required></div>
          <div class="field"><label>Descrição / observações</label><textarea id="sd"></textarea></div>
          <button class="btn">Iniciar entrega</button></form>`;
      } else {
        body += `<p>Sua entrega: ${pill(mine.status)}</p>
          <button class="btn" onclick="StudentArea.manageSubmission('${mine.id}')">Gerenciar entrega</button>`;
      }
      openModal(a.title, body);
      if (!mine) $("#newsub").addEventListener("submit", async (e) => {
        e.preventDefault();
        await guard(async () => {
          const sub = await api.stCreateSubmission({ activityId: id, title: $("#st").value.trim(), description: $("#sd").value.trim() });
          toast("Entrega iniciada!"); this.manageSubmission(sub.id);
        });
      });
    });
  },
  async manageSubmission(id) {
    await guard(async () => {
      const s = await api.stSubmission(id);
      const canEdit = ["NOT_STARTED", "IN_PROGRESS", "RETURNED", "RESUBMITTED"].includes(s.status);
      const files = s.versions.flatMap(v => v.files.map(f => ({ ...f, v: v.versionNumber })));
      let body = `<p><b>Atividade:</b> ${esc(s.activity.title)} · ${pill(s.status)}</p>
        <div class="card" style="background:#0a1226"><b>Arquivos enviados:</b><br>${
          files.length ? files.map(f => `<div class="list-item"><div class="info"><div class="title">${esc(f.originalName)}</div><div class="sub">v${f.v} · ${(f.sizeBytes / 1024).toFixed(1)} KB</div></div><button class="btn sm ghost" onclick="downloadFile('/api/student/files/${f.id}/download','${esc(f.originalName)}')">Baixar</button></div>`).join("") : '<span class="muted">Nenhum arquivo ainda.</span>'
        }</div>`;
      if (canEdit) {
        body += `<div class="field"><label>Anexar arquivos (${esc((s.activity.allowedFormats || []).join(", ") || "qualquer")})</label><input type="file" id="files" multiple></div>
          <div class="row"><button class="btn" id="up">Enviar arquivos</button>
          <button class="btn green" id="submit">Confirmar envio</button></div>`;
      } else if (s.status === "EVALUATED") {
        body += `<p class="muted">Entrega avaliada. Confira sua nota em "Minhas Notas".</p>`;
      }
      openModal("Minha entrega", body);
      if (canEdit) {
        $("#up").onclick = () => guard(async () => {
          const inp = $("#files"); if (!inp.files.length) return toast("Selecione arquivos.", "err");
          await uploadFiles(`/api/student/submissions/${id}/files`, inp.files);
          toast("Arquivos enviados!"); this.manageSubmission(id);
        });
        $("#submit").onclick = () => guard(async () => {
          await api.stSubmit(id); toast("Entrega confirmada!"); closeModal(); this.render();
        });
      }
    });
  },
  async notas(view) {
    view.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const grades = await api.stGrades();
      view.innerHTML = `<div class="card"><h3>Minhas Notas</h3>${
        grades.length ? grades.map(g => `<div class="list-item"><div class="info"><div class="title">${esc(g.activity?.title || "Avaliação")}</div>
          <div class="sub">${esc(g.projectTitle || "")} · Publicada em ${fmtDay(g.publishedAt)} ${pill(g.status)}</div></div>
          <div style="text-align:right"><div class="score-big">${g.finalScore ?? "—"}</div><div class="sub">de ${g.maxScore}</div>
          <button class="btn sm" onclick="StudentArea.gradeDetail('${g.resultId}')">Detalhes</button></div></div>`).join("")
          : '<div class="empty">Nenhuma nota publicada ainda.</div>'
      }</div>`;
    });
  },
  async gradeDetail(id) {
    await guard(async () => {
      const g = await api.stGrade(id);
      const body = `<p><b>${esc(g.activity?.title || "")}</b> · ${esc(g.projectTitle || "")}</p>
        <div style="text-align:center;margin:10px 0"><div class="score-big">${g.finalScore} / ${g.maxScore}</div>${pill(g.status)}</div>
        <h4 style="margin:10px 0;color:var(--cyan)">Desempenho por critério</h4>
        ${g.criteria.map(c => `<div class="crit"><div class="chead"><span class="ctitle">${esc(c.title)}</span><span class="cmax">${c.score ?? "—"} / ${c.maxPoints} (peso ${c.weight})</span></div>${c.comment ? `<div class="cdesc">💬 ${esc(c.comment)}</div>` : ""}</div>`).join("")}
        ${g.generalFeedback ? `<div class="card" style="background:#0a1226;margin-top:10px"><b>Feedback do professor:</b><br>${esc(g.generalFeedback)}</div>` : ""}
        <p class="muted" style="margin-top:8px">Avaliada em ${fmtDate(g.evaluatedAt)} · Publicada em ${fmtDate(g.publishedAt)}</p>`;
      openModal("Detalhe da avaliação", body);
    });
  }
};

// ============ ÁREA DO PROFESSOR ============
const TeacherArea = {
  tab: "dashboard", _ctx: null,
  render() {
    appEl().innerHTML = "";
    appEl().appendChild(tabs([
      { key: "dashboard", label: "Início" },
      { key: "recebidos", label: "Projetos Recebidos" },
      { key: "avaliar", label: "Avaliação de Apresentações" }
    ], this.tab, (k) => { this.tab = k; this.render(); }));
    const view = document.createElement("div"); view.id = "view"; appEl().appendChild(view);
    if (this.tab === "dashboard") this.dashboard(view);
    else if (this.tab === "recebidos") this.recebidos(view);
    else this.avaliar(view);
  },
  async dashboard(view) {
    view.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const d = await api.tDashboard();
      view.innerHTML = `
        <div class="welcome"><span class="tag">ÁREA DO PROFESSOR</span><h2>Olá, Prof. ${esc(Auth.user.name)}!</h2>
          <p>Acompanhe turmas, projetos recebidos e avaliações.</p></div>
        <div class="grid cols-4">
          <div class="stat"><div class="num">${d.turmasVinculadas}</div><div class="lbl">Turmas</div></div>
          <div class="stat"><div class="num">${d.totalAlunos}</div><div class="lbl">Alunos</div></div>
          <div class="stat"><div class="num">${d.projetosRecebidos}</div><div class="lbl">Projetos recebidos</div></div>
          <div class="stat"><div class="num">${d.resultadosAguardandoPublicacao}</div><div class="lbl">Aguardando publicação</div></div>
        </div>
        <div class="card" style="margin-top:16px"><h3>Entregas por status</h3>
          ${Object.entries(d.submissionsByStatus || {}).map(([s, n]) => `<span style="margin-right:12px">${pill(s)} <b>${n}</b></span>`).join("") || '<span class="muted">Sem entregas.</span>'}</div>`;
    });
  },
  async recebidos(view) {
    view.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const subs = await api.tReceived();
      view.innerHTML = `<div class="card"><h3>Projetos Recebidos</h3>${
        subs.length ? subs.map(s => `<div class="list-item"><div class="info"><div class="title">${esc(s.title)}</div>
          <div class="sub">${esc(s.student?.user?.name || "")} · ${esc(s.activity?.title || "")} · ${pill(s.status)}</div></div>
          <button class="btn sm" onclick="TeacherArea.viewProject('${s.id}')">Ver</button></div>`).join("")
          : '<div class="empty">Nenhum projeto recebido.</div>'
      }</div>`;
    });
  },
  async viewProject(id) {
    await guard(async () => {
      const s = await api.tSubmission(id);
      const files = s.versions.flatMap(v => v.files.map(f => ({ ...f, v: v.versionNumber })));
      const body = `<p><b>Aluno:</b> ${esc(s.student?.user?.name)} · <b>Turma:</b> ${esc(s.activity?.schoolClass?.name || "")}</p>
        <p><b>Atividade:</b> ${esc(s.activity?.title)} · ${pill(s.status)}</p>
        <div class="card" style="background:#0a1226"><b>Arquivos:</b><br>${files.map(f => `<div class="list-item"><div class="info"><div class="title">${esc(f.originalName)}</div><div class="sub">v${f.v}</div></div><button class="btn sm ghost" onclick="downloadFile('/api/teacher/files/${f.id}/download','${esc(f.originalName)}')">Baixar</button></div>`).join("") || '<span class="muted">Sem arquivos.</span>'}</div>
        <div class="field"><label>Observação interna (não visível ao aluno)</label><textarea id="note"></textarea></div>
        <button class="btn sm" id="addnote">Registrar observação</button>
        <div style="margin-top:10px">${(s.notes || []).map(n => `<div class="sub">📝 ${esc(n.content)} <span class="muted">— ${esc(n.author?.name || "")}</span></div>`).join("")}</div>`;
      openModal("Projeto recebido", body);
      $("#addnote").onclick = () => guard(async () => {
        const c = $("#note").value.trim(); if (!c) return;
        await api.tAddNote(id, c); toast("Observação registrada."); this.viewProject(id);
      });
    });
  },
  async avaliar(view) {
    view.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const acts = await api.activitiesList();
      view.innerHTML = `<div class="card"><h3>Avaliação de Apresentações</h3>
        <p class="muted">Selecione uma atividade para avaliar os alunos durante a apresentação.</p>
        <div class="field"><label>Atividade</label><select id="act"><option value="">— selecione —</option>${acts.map(a => `<option value="${a.id}">${esc(a.title)} (${esc(a.schoolClass?.name || "")})</option>`).join("")}</select></div>
        <div id="evbox"></div></div>`;
      $("#act").onchange = (e) => { if (e.target.value) this.loadEvaluables(e.target.value); else $("#evbox").innerHTML = ""; };
    });
  },
  async loadEvaluables(activityId) {
    const box = $("#evbox"); box.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const list = await api.tEvaluables(activityId);
      box.innerHTML = `<h4 style="margin:10px 0;color:var(--cyan)">Alunos</h4>${
        list.map(e => `<div class="list-item"><div class="info"><div class="title">${esc(e.student.name)}</div>
          <div class="sub">${e.submission ? "Entrega: " + pill(e.submission.status) : '<span class="muted">sem entrega</span>'} · Avaliação: ${pill(e.evaluationState)}${e.score != null ? " · Nota: <b>" + e.score + "</b>" : ""}</div></div>
          <button class="btn sm" onclick="TeacherArea.evaluate('${activityId}','${e.student.id}')">Avaliar</button></div>`).join("")
      }<button class="btn green sm" style="margin-top:10px" onclick="TeacherArea.publishAll('${activityId}')">Publicar todas concluídas</button>`;
    });
  },
  async evaluate(activityId, studentId) {
    await guard(async () => {
      const ctx = await api.tOpenEval({ activityId, studentId });
      this._ctx = ctx;
      const published = ctx.status === "PUBLISHED" || ctx.status === "REVISED";
      const body = `<p><b>${esc(ctx.student.name)}</b> · ${esc(ctx.activity.title)} · Estado: ${pill(ctx.state)}</p>
        ${ctx.submission ? `<div class="card" style="background:#0a1226"><b>Projeto:</b> ${esc(ctx.submission.title)}<br>${ctx.submission.files.map(f => `<button class="btn sm ghost" onclick="downloadFile('/api/teacher/files/${f.id}/download','${esc(f.originalName)}')">📎 ${esc(f.originalName)}</button>`).join(" ")}</div>` : '<p class="muted">Aluno sem entrega.</p>'}
        <div id="crits">${ctx.criteria.map((c, i) => `
          <div class="crit"><div class="chead"><span class="ctitle">${i + 1}. ${esc(c.title)}${c.required ? ' <span style="color:var(--red)">*</span>' : ""}</span><span class="cmax">máx ${c.maxPoints} · peso ${c.weight}</span></div>
          ${c.description ? `<div class="cdesc">${esc(c.description)}</div>` : ""}${c.guidance ? `<div class="cdesc">🎯 ${esc(c.guidance)}</div>` : ""}
          <div class="cinputs"><input type="number" min="0" max="${c.maxPoints}" step="0.1" data-cid="${c.id}" class="score-in" placeholder="nota" value="${c.score ?? ""}">
          <input type="text" data-cid="${c.id}" class="comment-in" placeholder="comentário" value="${esc(c.comment ?? "")}"></div></div>`).join("")}</div>
        <div class="field"><label>Feedback geral</label><textarea id="gfb">${esc(ctx.generalFeedback ?? "")}</textarea></div>
        <div class="row">
          <button class="btn ghost" id="draft">Salvar rascunho</button>
          <button class="btn" id="conclude">Concluir</button>
          ${ctx.state === "CONCLUDED" && !published ? '<button class="btn green" id="publish">Publicar</button>' : ""}
          ${published ? '<button class="btn danger" id="revise">Revisar (publicada)</button>' : ""}
        </div>
        <p class="muted" style="font-size:12px;margin-top:6px">* critério obrigatório. Nota final calculada automaticamente pela regra da rubrica.</p>`;
      openModal("Avaliar apresentação", body);
      const collect = () => [...document.querySelectorAll(".score-in")].map(inp => ({
        criterionId: inp.dataset.cid,
        score: inp.value === "" ? null : Number(inp.value),
        comment: document.querySelector(`.comment-in[data-cid="${inp.dataset.cid}"]`).value || null
      }));
      const save = (finalize) => guard(async () => {
        const r = await api.tSaveScores(this._ctx.resultId, { scores: collect(), generalFeedback: $("#gfb").value, finalize });
        toast(finalize ? `Concluída! Nota: ${r.finalScore}` : `Rascunho salvo. Parcial: ${r.finalScore}`);
        if (finalize) { closeModal(); this.loadEvaluables(activityId); }
      });
      $("#draft").onclick = () => save(false);
      $("#conclude").onclick = () => save(true);
      if ($("#publish")) $("#publish").onclick = () => guard(async () => { await api.tPublish(this._ctx.resultId); toast("Publicada!"); closeModal(); this.loadEvaluables(activityId); });
      if ($("#revise")) $("#revise").onclick = () => guard(async () => {
        const just = prompt("Justificativa da revisão (obrigatória):"); if (!just) return;
        await api.tRevise(this._ctx.resultId, { scores: collect(), generalFeedback: $("#gfb").value, justification: just });
        toast("Revisada!"); closeModal(); this.loadEvaluables(activityId);
      });
    });
  },
  async publishAll(activityId) {
    await guard(async () => {
      const r = await request("POST", `/api/teacher/activities/${activityId}/publish-all`);
      toast(`${r.published} resultado(s) publicado(s).`); this.loadEvaluables(activityId);
    });
  }
};

// ============ ÁREA DO ADMIN ============
const AdminArea = {
  tab: "rubricas",
  render() {
    appEl().innerHTML = "";
    appEl().appendChild(tabs([
      { key: "rubricas", label: "Rubricas e Critérios" },
      { key: "atividades", label: "Atividades" }
    ], this.tab, (k) => { this.tab = k; this.render(); }));
    const view = document.createElement("div"); view.id = "view"; appEl().appendChild(view);
    if (this.tab === "rubricas") this.rubricas(view); else this.atividades(view);
  },
  async rubricas(view) {
    view.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const list = await api.rubricsList();
      view.innerHTML = `<div class="welcome"><span class="tag">ADMINISTRAÇÃO</span><h2>Rubricas e Critérios</h2>
        <p>Defina os critérios que os professores usarão nas avaliações.</p></div>
        <div class="card"><h3>Nova rubrica</h3><form id="newrub"><div class="row">
          <input id="rn" placeholder="Nome da rubrica" required><input id="rd" placeholder="Descrição (opcional)">
          <button class="btn">Criar</button></div></form></div>
        <div class="card"><h3>Rubricas existentes</h3>${
          list.length ? list.map(r => { const v = r.versions[0]; return `<div class="list-item"><div class="info"><div class="title">${esc(r.name)}</div>
            <div class="sub">v${v?.versionNumber || 1} ${v?.immutable ? pill("PUBLISHED") : pill("DRAFT")} · por ${esc(r.creator?.name || "")}</div></div>
            <div><button class="btn sm" onclick="AdminArea.editRubric('${r.id}')">Critérios</button>
            <button class="btn sm ghost" onclick="AdminArea.duplicate('${r.id}')">Duplicar</button></div></div>`; }).join("")
          : '<div class="empty">Nenhuma rubrica.</div>'
        }</div>`;
      $("#newrub").addEventListener("submit", (e) => { e.preventDefault(); guard(async () => {
        await api.rubricCreate({ name: $("#rn").value.trim(), description: $("#rd").value.trim() }); toast("Rubrica criada."); this.rubricas(view);
      }); });
    });
  },
  async editRubric(id) {
    await guard(async () => {
      const r = await api.rubricGet(id);
      const v = r.versions[r.versions.length - 1];
      const locked = v.immutable;
      const body = `<p><b>${esc(r.name)}</b> · versão ${v.versionNumber} ${locked ? pill("PUBLISHED") : pill("DRAFT")}</p>
        <div id="crlist">${v.criteria.map(c => `<div class="list-item"><div class="info"><div class="title">${esc(c.title)} ${c.active ? "" : "<span class='muted'>(inativo)</span>"}</div>
          <div class="sub">máx ${c.maxPoints} · peso ${c.weight} ${c.required ? "· obrigatório" : ""}</div></div>
          ${locked ? "" : `<div><button class="btn sm ghost" onclick="AdminArea.toggleCrit('${c.id}',${!c.active},'${id}')">${c.active ? "Desativar" : "Ativar"}</button>
          <button class="btn sm danger" onclick="AdminArea.delCrit('${c.id}','${id}')">×</button></div>`}</div>`).join("") || '<div class="empty">Sem critérios.</div>'}</div>
        ${locked ? '<p class="muted">Versão publicada é imutável. Duplique a rubrica para alterar.</p>' : `
        <div class="card" style="background:#0a1226"><b>Adicionar critério</b>
          <div class="field"><input id="ct" placeholder="Título"></div>
          <div class="field"><input id="cd" placeholder="Descrição / orientação"></div>
          <div class="row"><input id="cmax" type="number" value="10" placeholder="Máx"><input id="cw" type="number" value="1" placeholder="Peso">
          <label style="flex:0 0 auto;display:flex;align-items:center;gap:6px;color:var(--muted)"><input type="checkbox" id="creq" checked style="width:auto"> obrigatório</label></div>
          <button class="btn sm" id="addcrit">Adicionar</button></div>
        <div class="field"><label>Pontuação total da versão</label><input id="tp" type="number" value="${v.totalPoints}"></div>
        <button class="btn green" id="publish">Publicar versão (torna imutável)</button>`}`;
      openModal("Critérios da rubrica", body);
      if (!locked) {
        $("#addcrit").onclick = () => guard(async () => {
          if (!$("#ct").value.trim()) return toast("Informe o título.", "err");
          await api.criterionAdd(v.id, { title: $("#ct").value.trim(), description: $("#cd").value.trim(), maxPoints: Number($("#cmax").value), weight: Number($("#cw").value), required: $("#creq").checked });
          toast("Critério adicionado."); this.editRubric(id);
        });
        $("#publish").onclick = () => guard(async () => {
          await api.versionUpdate(v.id, { totalPoints: Number($("#tp").value) });
          await api.versionPublish(v.id); toast("Versão publicada!"); closeModal(); this.render();
        });
      }
    });
  },
  toggleCrit(cid, active, rid) { guard(async () => { await api.criterionSetActive(cid, active); this.editRubric(rid); }); },
  delCrit(cid, rid) { guard(async () => { await api.criterionDelete(cid); toast("Critério removido."); this.editRubric(rid); }); },
  duplicate(id) { guard(async () => { const name = prompt("Nome da cópia:"); if (!name) return; await api.rubricDuplicate(id, { name }); toast("Rubrica duplicada."); this.render(); }); },

  async atividades(view) {
    view.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    await guard(async () => {
      const [acts, classes, subjects, teachers, rubrics] = await Promise.all([
        api.activitiesList(), api.catClasses(), api.catSubjects(), api.catTeachers(), api.rubricsList()
      ]);
      const pubVersions = [];
      rubrics.forEach(r => r.versions.filter(v => v.immutable).forEach(v => pubVersions.push({ id: v.id, label: `${r.name} v${v.versionNumber}` })));
      view.innerHTML = `<div class="welcome"><span class="tag">ADMINISTRAÇÃO</span><h2>Atividades</h2>
        <p>Configure as atividades que receberão os projetos dos alunos.</p></div>
        <div class="card"><h3>Nova atividade</h3><form id="newact">
          <div class="field"><label>Título</label><input id="at" required></div>
          <div class="row"><div><label class="muted">Turma</label><select id="ac">${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
            <div><label class="muted">Disciplina</label><select id="asu">${subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
            <div><label class="muted">Professor</label><select id="ap">${teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div></div>
          <div class="row"><div><label class="muted">Rubrica (publicada)</label><select id="arv"><option value="">— nenhuma —</option>${pubVersions.map(v => `<option value="${v.id}">${esc(v.label)}</option>`).join("")}</select></div>
            <div><label class="muted">Modo</label><select id="am"><option value="INDIVIDUAL">Individual</option><option value="GROUP">Em equipe</option></select></div></div>
          <div class="row"><div><label class="muted">Abertura</label><input id="aod" type="date"></div><div><label class="muted">Prazo</label><input id="add" type="date"></div></div>
          <div class="row"><div><label class="muted">Formatos (vírgula)</label><input id="af" value="pdf,docx,zip"></div>
            <div><label class="muted">Máx MB</label><input id="ams" type="number" value="20"></div><div><label class="muted">Máx arquivos</label><input id="amf" type="number" value="3"></div></div>
          <label style="display:flex;gap:6px;align-items:center;color:var(--muted);margin-bottom:10px"><input type="checkbox" id="ars" style="width:auto"> permitir reenvio</label>
          <button class="btn">Criar atividade</button></form></div>
        <div class="card"><h3>Atividades existentes</h3>${
          acts.length ? acts.map(a => `<div class="list-item"><div class="info"><div class="title">${esc(a.title)}</div>
            <div class="sub">${esc(a.schoolClass?.name || "")} · ${a.rubricVersion ? "rubrica ok" : '<span style="color:var(--red)">sem rubrica</span>'} · ${pill(a.status)}</div></div>
            <div>${a.status !== "OPEN" ? `<button class="btn sm green" onclick="AdminArea.setStatus('${a.id}','OPEN')">Abrir</button>` : `<button class="btn sm ghost" onclick="AdminArea.setStatus('${a.id}','CLOSED')">Fechar</button>`}</div></div>`).join("")
          : '<div class="empty">Nenhuma atividade.</div>'
        }</div>`;
      $("#newact").addEventListener("submit", (e) => { e.preventDefault(); guard(async () => {
        const body = {
          title: $("#at").value.trim(), classId: $("#ac").value, subjectId: $("#asu").value, teacherId: $("#ap").value,
          rubricVersionId: $("#arv").value || undefined, mode: $("#am").value,
          openDate: $("#aod").value || undefined, dueDate: $("#add").value || undefined,
          allowedFormats: $("#af").value.split(",").map(s => s.trim()).filter(Boolean),
          maxFileSizeMb: Number($("#ams").value), maxFiles: Number($("#amf").value), allowResubmission: $("#ars").checked
        };
        await api.activityCreate(body); toast("Atividade criada."); this.atividades(view);
      }); });
    });
  },
  setStatus(id, status) { guard(async () => { await api.activitySetStatus(id, status); toast(`Atividade ${status === "OPEN" ? "aberta" : "fechada"}.`); this.render(); }); }
};

// ============ Boot ============
renderApp();
