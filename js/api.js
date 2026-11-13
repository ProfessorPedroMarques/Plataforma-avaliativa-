// ====== Cliente de API + autenticação ======
const API_URL = localStorage.getItem("API_URL") || "http://localhost:3000";

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
  me: () => request("GET", "/api/auth/me"),
  // Admin - rubricas
  rubricsList: () => request("GET", "/api/rubrics"),
  rubricGet: (id) => request("GET", `/api/rubrics/${id}`),
  rubricCreate: (b) => request("POST", "/api/rubrics", b),
  rubricDuplicate: (id, b) => request("POST", `/api/rubrics/${id}/duplicate`, b),
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
  catTeachers: () => request("GET", "/api/catalog/teachers")
};
