// ====== Cliente de API + autenticação ======
// Endereço da API:
//  • aberto pelo próprio servidor (produção/Render ou http://localhost:3000): mesmo endereço do site;
//  • aberto pelo Live Server do VS Code (porta 5500) ou direto do arquivo: backend local na porta 3000;
//  • localStorage "API_URL" sobrepõe tudo (útil para testes).
const API_URL = (() => {
  try { const custom = localStorage.getItem("API_URL"); if (custom) return custom; } catch {}
  if (location.protocol === "file:" || location.port === "5500") return "http://localhost:3000";
  return location.origin;
})();

const Auth = {
  get token() { return localStorage.getItem("token"); },
  get user() { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } },
  set(session) {
    localStorage.setItem("token", session.token);
    localStorage.setItem("user", JSON.stringify(session.user));
  },
  clear() { localStorage.removeItem("token"); localStorage.removeItem("user"); },
  get isLogged() { return !!this.token; }
};

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new ApiError(0, "Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && Auth.isLogged) {
    Auth.clear();
    renderApp();
    throw new ApiError(401, "Sessão expirada. Faça login novamente.");
  }
  if (res.status === 403 && data?.code === "PASSWORD_CHANGE_REQUIRED" && Auth.isLogged) {
    const u = Auth.user; u.mustChangePassword = true;
    localStorage.setItem("user", JSON.stringify(u));
    renderApp();
    throw new ApiError(403, data.message);
  }
  if (!res.ok) throw new ApiError(res.status, data?.message || "Erro na operação.", data);
  return data?.data;
}

async function uploadFiles(path, fileList) {
  const fd = new FormData();
  for (const f of fileList) fd.append("files", f);
  const headers = {};
  if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;
  const res = await fetch(API_URL + path, { method: "POST", headers, body: fd });
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) throw new ApiError(res.status, data?.message || "Falha no upload.");
  return data?.data;
}

// Download autorizado (envia o token e salva o arquivo).
async function downloadFile(path, filename) {
  const headers = {};
  if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;
  const res = await fetch(API_URL + path, { headers });
  if (!res.ok) { toast("Não autorizado a baixar este arquivo.", "err"); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename || "arquivo";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

class ApiError extends Error { constructor(status, message, data) { super(message); this.status = status; this.data = data; } }

const api = {
  login: (email, password) => request("POST", "/api/auth/login", { email, password }),
  changePassword: (currentPassword, newPassword) => request("POST", "/api/auth/change-password", { currentPassword, newPassword }),
  adResetPassword: (userId, password) => request("POST", `/api/admin/users/${userId}/reset-password`, { password }),
  tDocOpen: (submissionId) => request("POST", `/api/teacher/submissions/${submissionId}/document-evaluation`),
  tDocSave: (submissionId, b) => request("PUT", `/api/teacher/submissions/${submissionId}/document-evaluation`, b),
  tPresList: (activityId) => request("GET", `/api/teacher/activities/${activityId}/presentation`),
  tPresOpen: (b) => request("POST", "/api/teacher/presentation/open", b),
  me: () => request("GET", "/api/auth/me"),
  // Admin - rubricas
  rubricsList: () => request("GET", "/api/rubrics"),
  rubricGet: (id) => request("GET", `/api/rubrics/${id}`),
  rubricCreate: (b) => request("POST", "/api/rubrics", b),
  rubricDuplicate: (id, b) => request("POST", `/api/rubrics/${id}/duplicate`, b),
  rubricDelete: (id) => request("DELETE", `/api/rubrics/${id}`),
  criterionAdd: (versionId, b) => request("POST", `/api/rubrics/versions/${versionId}/criteria`, b),
  criterionDelete: (id) => request("DELETE", `/api/rubrics/criteria/${id}`),
  criterionSetActive: (id, active) => request("PATCH", `/api/rubrics/criteria/${id}/active`, { active }),
  versionPublish: (versionId) => request("POST", `/api/rubrics/versions/${versionId}/publish`),
  versionUpdate: (versionId, b) => request("PATCH", `/api/rubrics/versions/${versionId}`, b),
  // Admin - atividades
  activitiesList: (q = "") => request("GET", `/api/activities${q}`),
  activityGet: (id) => request("GET", `/api/activities/${id}`),
  activityCreate: (b) => request("POST", "/api/activities", b),
  activityUpdate: (id, b) => request("PATCH", `/api/activities/${id}`, b),
  activitySetStatus: (id, status) => request("PATCH", `/api/activities/${id}/status`, { status }),
  activityDelete: (id) => request("DELETE", `/api/activities/${id}`),
  activityAddCriterion: (id, b) => request("POST", `/api/activities/${id}/criteria`, b),
  activityDelCriterion: (id, cid) => request("DELETE", `/api/activities/${id}/criteria/${cid}`),
  tDocsOverview: () => request("GET", "/api/teacher/documents-overview"),
  tDocOpenFor: (activityId, b) => request("POST", `/api/teacher/activities/${activityId}/documents/open`, b),
  // Apresentação (critérios próprios; avaliação individual)
  adPresCriteria: () => request("GET", "/api/admin/presentation-criteria"),
  adPresCreate: (b) => request("POST", "/api/admin/presentation-criteria", b),
  adPresUpdate: (id, b) => request("PATCH", `/api/admin/presentation-criteria/${id}`, b),
  adPresDelete: (id) => request("DELETE", `/api/admin/presentation-criteria/${id}`),
  adPresOrder: (ids) => request("PUT", "/api/admin/presentation-criteria/order", { ids }),
  tPresProjects: () => request("GET", "/api/teacher/presentation/activities"),
  tPresStudent: (activityId, studentId) => request("GET", `/api/teacher/presentation/activities/${activityId}/students/${studentId}`),
  tPresStudentSave: (activityId, studentId, b) => request("PUT", `/api/teacher/presentation/activities/${activityId}/students/${studentId}`, b),
  // Student
  stActivities: () => request("GET", "/api/student/activities"),
  stActivity: (id) => request("GET", `/api/student/activities/${id}`),
  stSubmissions: () => request("GET", "/api/student/submissions"),
  stSubmission: (id) => request("GET", `/api/student/submissions/${id}`),
  stCreateSubmission: (b) => request("POST", "/api/student/submissions", b),
  stSubmit: (id) => request("POST", `/api/student/submissions/${id}/submit`),
  stResubmit: (id) => request("POST", `/api/student/submissions/${id}/resubmit`),
  stGrades: () => request("GET", "/api/student/grades"),
  stGrade: (id) => request("GET", `/api/student/grades/${id}`),
  // Teacher
  tDashboard: () => request("GET", "/api/teacher/dashboard"),
  tReceived: (q = "") => request("GET", `/api/teacher/submissions${q}`),
  tSubmission: (id) => request("GET", `/api/teacher/submissions/${id}`),
  tAddNote: (id, content) => request("POST", `/api/teacher/submissions/${id}/notes`, { content }),
  tEvaluables: (activityId) => request("GET", `/api/teacher/activities/${activityId}/evaluables`),
  tOpenEval: (b) => request("POST", "/api/teacher/evaluations/open", b),
  tSaveScores: (resultId, b) => request("PUT", `/api/teacher/results/${resultId}/scores`, b),
  tPublish: (resultId) => request("POST", `/api/teacher/results/${resultId}/publish`),
  tRevise: (resultId, b) => request("POST", `/api/teacher/results/${resultId}/revise`, b),
  // Catálogo
  catClasses: () => request("GET", "/api/catalog/classes"),
  catSubjects: () => request("GET", "/api/catalog/subjects"),
  catTeachers: () => request("GET", "/api/catalog/teachers"),
  // Admin - cadastros
  adCreateTeacher: (b) => request("POST", "/api/admin/teachers", b),
  adCreateStudent: (b) => request("POST", "/api/admin/students", b),
  adStudents: () => request("GET", "/api/admin/students"),
  adOverview: () => request("GET", "/api/admin/overview"),
  adSetStudentGroup: (studentId, groupId) => request("PUT", `/api/admin/students/${studentId}/group`, { groupId: groupId || null }),
  adListUsers: (role) => request("GET", `/api/admin/users${role ? "?role=" + role : ""}`),
  // Admin - grupos
  adGroups: () => request("GET", "/api/admin/groups"),
  adRenameGroup: (id, name) => request("PATCH", `/api/admin/groups/${id}`, { name }),
  adCreateGroup: (b) => request("POST", "/api/admin/groups", b),
  adDeleteGroup: (id) => request("DELETE", `/api/admin/groups/${id}`),
  adAddMember: (id, studentId) => request("POST", `/api/admin/groups/${id}/members`, { studentId }),
  adRemoveMember: (id, studentId) => request("DELETE", `/api/admin/groups/${id}/members/${studentId}`),
  // Teacher - avaliação em grupo
  tGroups: (activityId) => request("GET", `/api/teacher/activities/${activityId}/groups`),
  tOpenGroup: (b) => request("POST", "/api/teacher/evaluations/open-group", b),
  tGroupScores: (groupId, b) => request("PUT", `/api/teacher/groups/${groupId}/group-scores`, b),
  tIndividualScores: (resultId, b) => request("PUT", `/api/teacher/results/${resultId}/individual-scores`, b)
};
