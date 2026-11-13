
import * as activityService from "../services/activityService.js";
import { recordAudit } from "../services/auditService.js";
import {
  ok, created, requireString, optionalString, optionalDate, requireNumber, HttpError
} from "../utils/http.js";

const ACTIVITY_STATUS = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"];
const MODES = ["INDIVIDUAL", "GROUP"];

function parseActivityBody(body, { partial = false } = {}) {
  const data = {};

  if (!partial || body.title !== undefined) data.title = requireString(body.title, "title");
  if (body.description !== undefined) data.description = optionalString(body.description, "description");
  if (body.instructions !== undefined) data.instructions = optionalString(body.instructions, "instructions");

  if (!partial || body.classId !== undefined) data.classId = requireString(body.classId, "classId");
  if (body.subjectId !== undefined) data.subjectId = optionalString(body.subjectId, "subjectId");
  if (body.teacherId !== undefined) data.teacherId = optionalString(body.teacherId, "teacherId");
  if (body.rubricVersionId !== undefined) data.rubricVersionId = optionalString(body.rubricVersionId, "rubricVersionId");

  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode)) throw new HttpError(400, "mode deve ser INDIVIDUAL ou GROUP.");
    data.mode = body.mode;
  }
  if (body.status !== undefined) {
    if (!ACTIVITY_STATUS.includes(body.status)) throw new HttpError(400, "status inválido.");
    data.status = body.status;
  }

  if (body.openDate !== undefined) data.openDate = optionalDate(body.openDate, "openDate");
  if (body.dueDate !== undefined) data.dueDate = optionalDate(body.dueDate, "dueDate");

  if (body.allowedFormats !== undefined) {
    if (!Array.isArray(body.allowedFormats)) throw new HttpError(400, "allowedFormats deve ser uma lista.");
    data.allowedFormats = body.allowedFormats.map(f => String(f).toLowerCase().replace(/^\./, "").trim());
  }
  if (body.maxFileSizeMb !== undefined) data.maxFileSizeMb = requireNumber(body.maxFileSizeMb, "maxFileSizeMb", { min: 1, max: 500 });
  if (body.maxFiles !== undefined) data.maxFiles = requireNumber(body.maxFiles, "maxFiles", { min: 1, max: 50 });
  if (body.allowResubmission !== undefined) data.allowResubmission = Boolean(body.allowResubmission);

  if (data.openDate && data.dueDate && data.dueDate < data.openDate) {
    throw new HttpError(400, "O prazo (dueDate) não pode ser anterior à abertura (openDate).");
  }
  return data;
}

export async function create(req, res) {
  const data = parseActivityBody(req.body);
  const activity = await activityService.createActivity(req.user.id, data);
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "Activity", entityId: activity.id });
  return created(res, activity, "Atividade criada.");
}

export async function list(req, res) {
  const { classId, teacherId, status } = req.query;
  return ok(res, await activityService.listActivities({ classId, teacherId, status }));
}

export async function getById(req, res) {
  return ok(res, await activityService.getActivity(req.params.id));
}

export async function update(req, res) {
  const data = parseActivityBody(req.body, { partial: true });
  const activity = await activityService.updateActivity(req.params.id, data);
  await recordAudit({ actorUserId: req.user.id, action: "UPDATE", entity: "Activity", entityId: activity.id });
  return ok(res, activity, "Atividade atualizada.");
}

export async function setStatus(req, res) {
  if (!ACTIVITY_STATUS.includes(req.body.status)) throw new HttpError(400, "status inválido.");
  const activity = await activityService.setStatus(req.params.id, req.body.status);
  await recordAudit({ actorUserId: req.user.id, action: "STATUS", entity: "Activity", entityId: activity.id, details: { status: req.body.status } });
  return ok(res, activity, "Status atualizado.");
}

export async function remove(req, res) {
  const result = await activityService.deleteActivity(req.params.id);
  await recordAudit({ actorUserId: req.user.id, action: "DELETE", entity: "Activity", entityId: result.id });
  return ok(res, result, "Atividade removida.");
}
