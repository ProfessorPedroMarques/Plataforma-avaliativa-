
import * as teacherService from "../services/teacherService.js";
import * as evaluationService from "../services/evaluationService.js";
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
