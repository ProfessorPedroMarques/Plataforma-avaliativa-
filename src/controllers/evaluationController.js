
import * as teacherService from "../services/teacherService.js";
import * as evaluationService from "../services/evaluationService.js";
import * as groupEval from "../services/groupEvaluationService.js";
import * as assessment from "../services/assessmentService.js";
import { recordAudit } from "../services/auditService.js";
import { ok, created, requireString, HttpError } from "../utils/http.js";

// Lista estudantes avaliáveis de uma atividade (para o professor escolher quem avaliar).
export async function listEvaluables(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await evaluationService.listEvaluables(teacher, req.params.activityId));
}

// Abre/retoma a avaliação de um estudante: carrega rubrica + critérios + notas já lançadas.
export async function openEvaluation(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const activityId = requireString(req.body.activityId, "activityId");
  const studentId = requireString(req.body.studentId, "studentId");
  const context = await evaluationService.openEvaluation(teacher, activityId, studentId);
  await recordAudit({ actorUserId: req.user.id, action: "OPEN_EVALUATION", entity: "EvaluationResult", entityId: context.resultId });
  return created(res, context, "Avaliação carregada.");
}

// Salva pontuações/comentários (rascunho) ou finaliza (conclui).
export async function saveScores(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  if (req.body.scores !== undefined && !Array.isArray(req.body.scores)) {
    throw new HttpError(400, "Campo 'scores' deve ser uma lista.");
  }
  const result = await evaluationService.saveScores(teacher, req.params.resultId, {
    scores: req.body.scores,
    generalFeedback: req.body.generalFeedback,
    finalize: req.body.finalize === true ? true : (req.body.finalize === false ? false : undefined)
  });
  await recordAudit({
    actorUserId: req.user.id,
    action: req.body.finalize ? "FINALIZE_EVALUATION" : "SAVE_EVALUATION",
    entity: "EvaluationResult", entityId: req.params.resultId
  });
  return ok(res, result, req.body.finalize ? "Avaliação concluída." : "Rascunho salvo.");
}

// ===== Etapa 8: publicação e revisão =====
export async function publish(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const result = await evaluationService.publishResult(teacher, req.params.resultId);
  await recordAudit({ actorUserId: req.user.id, action: "PUBLISH_RESULT", entity: "EvaluationResult", entityId: req.params.resultId });
  return ok(res, result, "Resultado publicado.");
}

export async function publishAll(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const summary = await evaluationService.publishAllForActivity(teacher, req.params.activityId);
  await recordAudit({ actorUserId: req.user.id, action: "PUBLISH_ALL", entity: "Activity", entityId: req.params.activityId, details: summary });
  return ok(res, summary, `${summary.published} resultado(s) publicado(s).`);
}

export async function revise(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const justification = requireString(req.body.justification, "justification");
  const result = await evaluationService.reviseResult(teacher, req.params.resultId, {
    scores: req.body.scores, generalFeedback: req.body.generalFeedback, justification
  });
  await recordAudit({ actorUserId: req.user.id, action: "REVISE_RESULT", entity: "EvaluationResult", entityId: req.params.resultId });
  return ok(res, result, "Resultado revisado.");
}

// ===== Avaliação em grupo (equipe) =====
export async function listGroups(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await groupEval.listGroupsForActivity(teacher, req.params.activityId));
}

export async function openGroup(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const activityId = requireString(req.body.activityId, "activityId");
  const groupId = requireString(req.body.groupId, "groupId");
  const ctx = await groupEval.openGroupEvaluation(teacher, activityId, groupId);
  await recordAudit({ actorUserId: req.user.id, action: "OPEN_GROUP_EVAL", entity: "Evaluation", entityId: ctx.evaluationId });
  return created(res, ctx, "Avaliação do grupo carregada.");
}

export async function saveGroupScores(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  if (req.body.scores !== undefined && !Array.isArray(req.body.scores)) throw new HttpError(400, "'scores' deve ser lista.");
  const ctx = await groupEval.saveGroupScores(teacher, requireString(req.body.activityId, "activityId"), requireString(req.params.groupId, "groupId"), req.body.scores);
  return ok(res, ctx, "Pontuações coletivas salvas.");
}

export async function saveIndividualScores(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  if (req.body.scores !== undefined && !Array.isArray(req.body.scores)) throw new HttpError(400, "'scores' deve ser lista.");
  const r = await groupEval.saveIndividualScores(teacher, req.params.resultId, {
    scores: req.body.scores, generalFeedback: req.body.generalFeedback,
    finalize: req.body.finalize === true ? true : (req.body.finalize === false ? false : undefined)
  });
  return ok(res, r, req.body.finalize ? "Avaliação individual concluída." : "Pontuações individuais salvas.");
}

// ===== Avaliação em duas etapas: DOCUMENTOS (nota do grupo) e APRESENTAÇÃO (nota individual) =====
export async function openDocumentEvaluation(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await assessment.openDocumentEvaluation(teacher, req.params.id), "Avaliação dos documentos carregada.");
}

export async function saveDocumentScores(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  if (req.body.scores !== undefined && !Array.isArray(req.body.scores)) throw new HttpError(400, "'scores' deve ser lista.");
  const ctx = await assessment.saveDocumentScores(teacher, req.params.id, { scores: req.body.scores, feedback: req.body.feedback });
  await recordAudit({ actorUserId: req.user.id, action: "SAVE_DOCUMENT_SCORES", entity: "Submission", entityId: req.params.id });
  return ok(res, ctx, "Notas dos documentos salvas (nota do grupo).");
}

export async function listPresentation(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await assessment.listPresentationStudents(teacher, req.params.activityId));
}

export async function openPresentation(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const ctx = await assessment.openPresentationEvaluation(
    teacher, requireString(req.body.activityId, "activityId"), requireString(req.body.studentId, "studentId")
  );
  return created(res, ctx, "Avaliação da apresentação carregada.");
}

// Planilha da apresentação (critérios + alunos por grupo, com notas já lançadas).
export async function presentationSheet(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await assessment.presentationSheet(teacher, req.params.activityId));
}

// Salva as notas da apresentação de um aluno (conclusão automática quando completo).
export async function savePresentationScores(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  if (!Array.isArray(req.body.scores)) throw new HttpError(400, "'scores' deve ser lista.");
  const row = await assessment.savePresentationScores(teacher, req.params.activityId, req.params.studentId, {
    scores: req.body.scores, feedback: req.body.feedback
  });
  await recordAudit({ actorUserId: req.user.id, action: "SAVE_PRESENTATION_SCORES", entity: "Student", entityId: req.params.studentId, details: { activityId: req.params.activityId } });
  return ok(res, row, "Notas da apresentação salvas.");
}

// Visão por grupos: atividades (documentos) com critérios, grupos e integrantes.
export async function documentsOverview(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await assessment.documentsOverview(teacher));
}

// Abre a avaliação de documentos de um grupo/aluno (com ou sem envio).
export async function openDocumentsFor(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const ctx = await assessment.openDocumentsFor(teacher, req.params.activityId, { groupId: req.body.groupId, studentId: req.body.studentId });
  return ok(res, ctx, "Avaliação dos documentos carregada.");
}
