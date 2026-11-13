
import fs from "fs";
import * as teacherService from "../services/teacherService.js";
import { recordAudit } from "../services/auditService.js";
import { storedPath } from "../utils/fileStorage.js";
import { ok, created, requireString, HttpError } from "../utils/http.js";

export async function dashboard(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await teacherService.dashboard(teacher));
}

export async function listReceived(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const { classId, activityId, studentId, status } = req.query;
  return ok(res, await teacherService.listReceivedSubmissions(teacher, { classId, activityId, studentId, status }));
}

export async function getSubmission(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  return ok(res, await teacherService.getSubmission(teacher, req.params.id));
}

export async function downloadFile(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const file = await teacherService.getFileForTeacher(teacher, req.params.fileId);
  const path = storedPath(file.storedName);
  if (!fs.existsSync(path)) throw new HttpError(404, "Arquivo físico não encontrado.");
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
  fs.createReadStream(path).pipe(res);
}

export async function addNote(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const content = requireString(req.body.content, "content");
  const note = await teacherService.addNote(teacher, req.user.id, req.params.id, content);
  await recordAudit({ actorUserId: req.user.id, action: "NOTE", entity: "Submission", entityId: req.params.id });
  return created(res, note, "Observação registrada.");
}

export async function deleteNote(req, res) {
  const teacher = await teacherService.getTeacherByUser(req.user.id);
  const result = await teacherService.deleteNote(teacher, req.user.id, req.params.noteId);
  return ok(res, result, "Observação removida.");
}
