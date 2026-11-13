
import fs from "fs";
import * as studentService from "../services/studentService.js";
import * as submissionService from "../services/submissionService.js";
import { recordAudit } from "../services/auditService.js";
import { storedPath } from "../utils/fileStorage.js";
import { ok, created, requireString, optionalString, HttpError } from "../utils/http.js";

// --- Atividades disponíveis ---
export async function listActivities(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  return ok(res, await studentService.listAvailableActivities(student.id));
}

export async function getActivity(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  return ok(res, await studentService.getAvailableActivity(student.id, req.params.id));
}

// --- Entregas ---
export async function listSubmissions(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  return ok(res, await studentService.listMySubmissions(student.id));
}

export async function getSubmission(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  return ok(res, await studentService.getOwnedSubmission(student.id, req.params.id));
}

export async function createSubmission(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  const activityId = requireString(req.body.activityId, "activityId");
  const title = requireString(req.body.title, "title");
  const description = optionalString(req.body.description, "description");
  const submission = await studentService.createSubmission(student.id, { activityId, title, description });
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "Submission", entityId: submission.id });
  return created(res, submission, "Entrega iniciada.");
}

export async function updateSubmission(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  const submission = await studentService.updateSubmissionMeta(student.id, req.params.id, {
    title: req.body.title !== undefined ? requireString(req.body.title, "title") : undefined,
    description: req.body.description
  });
  return ok(res, submission, "Entrega atualizada.");
}

// --- Upload de arquivos ---
export async function uploadFiles(req, res) {
  const filesMeta = (req.files || []).map(f => ({
    originalName: f.originalname, storedName: f.filename,
    mimeType: f.mimetype, sizeBytes: f.size
  }));

  try {
    const student = await studentService.getStudentByUser(req.user.id);
    const submission = await studentService.getOwnedSubmission(student.id, req.params.id, false);
    const activity = await studentService.assertActivityForStudent(student.id, submission.activityId);

    // Conta arquivos já existentes na versão atual (aberta) para respeitar maxFiles.
    const prisma = (await import("../config/database.js")).default;
    const lastVersion = await prisma.submissionVersion.findFirst({
      where: { submissionId: submission.id }, orderBy: { versionNumber: "desc" },
      include: { _count: { select: { files: true } } }
    });
    const currentCount = (submission.status === "IN_PROGRESS" || submission.status === "RESUBMITTED")
      ? (lastVersion?._count.files || 0) : 0;

    submissionService.validateFilesAgainstActivity(activity, req.files, currentCount);

    const version = await submissionService.attachFiles(submission, filesMeta);
    await recordAudit({ actorUserId: req.user.id, action: "UPLOAD", entity: "Submission", entityId: submission.id, details: { files: filesMeta.length } });
    return created(res, version, "Arquivos anexados.");
  } catch (err) {
    // Rollback: remove do disco os arquivos recém-gravados.
    submissionService.cleanupStoredFiles(filesMeta);
    throw err;
  }
}

export async function submit(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  const submission = await studentService.getOwnedSubmission(student.id, req.params.id, false);
  const result = await submissionService.submit(submission);
  await recordAudit({ actorUserId: req.user.id, action: "SUBMIT", entity: "Submission", entityId: submission.id });
  return ok(res, result, "Entrega enviada com sucesso.");
}

export async function resubmit(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  const submission = await studentService.getOwnedSubmission(student.id, req.params.id, false);
  const result = await submissionService.reopenForResubmission(submission);
  await recordAudit({ actorUserId: req.user.id, action: "RESUBMIT", entity: "Submission", entityId: submission.id });
  return ok(res, result, "Entrega reaberta para reenvio.");
}

// --- Download autorizado (somente o dono) ---
export async function downloadFile(req, res) {
  const student = await studentService.getStudentByUser(req.user.id);
  const file = await submissionService.getFileForOwner(student.id, req.params.fileId);
  const path = storedPath(file.storedName);
  if (!fs.existsSync(path)) throw new HttpError(404, "Arquivo físico não encontrado.");
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
  fs.createReadStream(path).pipe(res);
}
