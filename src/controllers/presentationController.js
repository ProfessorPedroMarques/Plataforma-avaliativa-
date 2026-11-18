import * as teacherService from "../services/teacherService.js";
import * as presentation from "../services/presentationService.js";
import { recordAudit } from "../services/auditService.js";
import { ok, created } from "../utils/http.js";

// ---------- ADMIN: critérios da apresentação ----------
export async function listCriteria(req, res) {
  return ok(res, await presentation.listCriteria());
}
export async function createCriterion(req, res) {
  const data = await presentation.createCriterion(req.user.id, req.body || {});
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "PresentationCriterion", details: { title: req.body?.title } });
  return created(res, data, "Critério de apresentação cadastrado.");
}
export async function updateCriterion(req, res) {
  const data = await presentation.updateCriterion(req.params.id, req.body || {});
  await recordAudit({ actorUserId: req.user.id, action: "UPDATE", entity: "PresentationCriterion", entityId: req.params.id });
  return ok(res, data, "Critério atualizado.");
}
export async function deleteCriterion(req, res) {
  const data = await presentation.deleteCriterion(req.params.id);
  await recordAudit({ actorUserId: req.user.id, action: data.archived ? "ARCHIVE" : "DELETE", entity: "PresentationCriterion", entityId: req.params.id });
  return ok(res, data, data.archived ? "Critério removido das telas (mantido no histórico porque já foi usado em avaliações)." : "Critério excluído.");
}
export async function reorderCriteria(req, res) {
  return ok(res, await presentation.reorderCriteria(req.body?.ids), "Ordem atualizada.");
}

// ---------- PROFESSOR: avaliação individual ----------
export async function teacherProjects(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await presentation.teacherProjects(teacher));
}
export async function openStudent(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await presentation.openStudent(teacher, req.params.activityId, req.params.studentId));
}
export async function saveStudent(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const data = await presentation.saveStudent(teacher, req.params.activityId, req.params.studentId, req.body || {});
  await recordAudit({ actorUserId: req.user.id, action: "SAVE_PRESENTATION", entity: "Student", entityId: req.params.studentId, details: { activityId: req.params.activityId, teacherId: teacher.id } });
  return ok(res, data, "Avaliação da apresentação salva.");
}
