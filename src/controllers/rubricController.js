
import * as rubricService from "../services/rubricService.js";
import { recordAudit } from "../services/auditService.js";
import {
  ok, created, requireString, optionalString, requireNumber, HttpError
} from "../utils/http.js";

export async function create(req, res) {
  const name = requireString(req.body.name, "name");
  const description = optionalString(req.body.description, "description");
  const rubric = await rubricService.createRubric(req.user.id, { name, description });
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "Rubric", entityId: rubric.id });
  return created(res, rubric, "Rubrica criada.");
}

export async function list(req, res) {
  return ok(res, await rubricService.listRubrics());
}

export async function getById(req, res) {
  return ok(res, await rubricService.getRubric(req.params.id));
}

export async function update(req, res) {
  const rubric = await rubricService.updateRubric(req.params.id, req.body);
  await recordAudit({ actorUserId: req.user.id, action: "UPDATE", entity: "Rubric", entityId: rubric.id });
  return ok(res, rubric, "Rubrica atualizada.");
}

export async function duplicate(req, res) {
  const copy = await rubricService.duplicateRubric(req.user.id, req.params.id, {
    name: optionalString(req.body.name, "name"),
    sourceVersionId: req.body.sourceVersionId
  });
  await recordAudit({ actorUserId: req.user.id, action: "DUPLICATE", entity: "Rubric", entityId: copy.id, details: { source: req.params.id } });
  return created(res, copy, "Rubrica duplicada.");
}

export async function createVersion(req, res) {
  const version = await rubricService.createVersion(req.params.id, {
    copyFromVersionId: req.body.copyFromVersionId,
    description: optionalString(req.body.description, "description")
  });
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "RubricVersion", entityId: version.id });
  return created(res, version, "Versão criada.");
}

export async function updateVersion(req, res) {
  const data = {};
  if (req.body.description !== undefined) data.description = optionalString(req.body.description, "description");
  if (req.body.totalPoints !== undefined) data.totalPoints = requireNumber(req.body.totalPoints, "totalPoints", { min: 0 });
  const version = await rubricService.updateVersion(req.params.versionId, data);
  return ok(res, version, "Versão atualizada.");
}

export async function publishVersion(req, res) {
  const version = await rubricService.publishVersion(req.params.versionId);
  await recordAudit({ actorUserId: req.user.id, action: "PUBLISH", entity: "RubricVersion", entityId: version.id });
  return ok(res, version, "Versão publicada (imutável).");
}

export async function addCriterion(req, res) {
  const data = {
    title: requireString(req.body.title, "title"),
    description: optionalString(req.body.description, "description"),
    guidance: optionalString(req.body.guidance, "guidance"),
    weight: req.body.weight !== undefined ? requireNumber(req.body.weight, "weight", { min: 0 }) : undefined,
    maxPoints: req.body.maxPoints !== undefined ? requireNumber(req.body.maxPoints, "maxPoints", { min: 0 }) : undefined,
    required: req.body.required,
    position: req.body.position !== undefined ? requireNumber(req.body.position, "position", { min: 1 }) : undefined
  };
  const criterion = await rubricService.addCriterion(req.params.versionId, data);
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "Criterion", entityId: criterion.id });
  return created(res, criterion, "Critério adicionado.");
}

export async function updateCriterion(req, res) {
  const data = { ...req.body };
  if (data.weight !== undefined) data.weight = requireNumber(data.weight, "weight", { min: 0 });
  if (data.maxPoints !== undefined) data.maxPoints = requireNumber(data.maxPoints, "maxPoints", { min: 0 });
  const criterion = await rubricService.updateCriterion(req.params.criterionId, data);
  return ok(res, criterion, "Critério atualizado.");
}

export async function setCriterionActive(req, res) {
  if (typeof req.body.active !== "boolean") throw new HttpError(400, "Campo 'active' deve ser booleano.");
  const criterion = await rubricService.setCriterionActive(req.params.criterionId, req.body.active);
  return ok(res, criterion, "Status do critério atualizado.");
}

export async function deleteCriterion(req, res) {
  const result = await rubricService.deleteCriterion(req.params.criterionId);
  await recordAudit({ actorUserId: req.user.id, action: "DELETE", entity: "Criterion", entityId: result.id });
  return ok(res, result, "Critério removido.");
}

export async function reorderCriteria(req, res) {
  if (!Array.isArray(req.body.order)) throw new HttpError(400, "Campo 'order' deve ser uma lista.");
  const criteria = await rubricService.reorderCriteria(req.params.versionId, req.body.order);
  return ok(res, criteria, "Critérios reordenados.");
}
