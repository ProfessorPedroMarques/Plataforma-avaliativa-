
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";
import { getExtension, removeFile } from "../utils/fileStorage.js";

// Estados em que a entrega ainda está "aberta" para receber arquivos.
const OPEN_STATES = ["NOT_STARTED", "IN_PROGRESS", "RETURNED", "RESUBMITTED"];

// Valida regras de arquivo definidas pela ATIVIDADE (config do ADMIN).
// files: array do multer [{ originalname, size, mimetype }]
// Lança HttpError se algo violar; não persiste nada.
export function validateFilesAgainstActivity(activity, files, currentFileCount = 0) {
  if (!files || files.length === 0) {
    throw new HttpError(400, "Nenhum arquivo enviado.");
  }

  // Prazo
  if (activity.dueDate && new Date() > new Date(activity.dueDate)) {
    throw new HttpError(409, "O prazo de entrega desta atividade já encerrou.");
  }
  // Atividade precisa estar aberta
  if (activity.status !== "OPEN") {
    throw new HttpError(409, "A atividade não está aberta para envios.");
  }

  // Quantidade
  if (currentFileCount + files.length > activity.maxFiles) {
    throw new HttpError(400, `Número de arquivos excede o máximo permitido (${activity.maxFiles}).`);
  }

  const allowed = (activity.allowedFormats || []).map(f => String(f).toLowerCase());
  const maxBytes = activity.maxFileSizeMb * 1024 * 1024;

  for (const f of files) {
    const ext = getExtension(f.originalname);
    if (allowed.length > 0 && !allowed.includes(ext)) {
      throw new HttpError(400, `Formato não permitido: .${ext || "?"}. Permitidos: ${allowed.join(", ")}.`);
    }
    if (f.size > maxBytes) {
      throw new HttpError(400, `Arquivo "${f.originalname}" excede o tamanho máximo (${activity.maxFileSizeMb} MB).`);
    }
  }
}

// Retorna a versão de rascunho atual ou cria a próxima versão.
async function getOrCreateDraftVersion(tx, submission) {
  const last = await tx.submissionVersion.findFirst({
    where: { submissionId: submission.id },
    orderBy: { versionNumber: "desc" },
    include: { _count: { select: { files: true } } }
  });

  // Reusar a última versão apenas enquanto a entrega não foi enviada.
  if (last && ["NOT_STARTED", "IN_PROGRESS", "RESUBMITTED"].includes(submission.status)) {
    return last;
  }
  const nextNumber = (last?.versionNumber || 0) + 1;
  return tx.submissionVersion.create({
    data: { submissionId: submission.id, versionNumber: nextNumber }
  });
}

// Persiste arquivos já gravados em disco (metadados do multer) numa versão.
// filesMeta: [{ originalName, storedName, mimeType, sizeBytes }]
export async function attachFiles(submission, filesMeta) {
  if (!OPEN_STATES.includes(submission.status)) {
    throw new HttpError(409, "Esta entrega não está aberta para novos arquivos.");
  }

  return prisma.$transaction(async (tx) => {
    const version = await getOrCreateDraftVersion(tx, submission);

    const currentCount = await tx.submissionFile.count({ where: { versionId: version.id } });
    void currentCount; // contagem já validada no controller

    await tx.submissionFile.createMany({
      data: filesMeta.map(f => ({
        versionId: version.id,
        originalName: f.originalName,
        storedName: f.storedName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes
      }))
    });

    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: submission.status === "NOT_STARTED" ? "IN_PROGRESS" : submission.status,
        currentVersion: version.versionNumber
      }
    });

    return tx.submissionVersion.findUnique({
      where: { id: version.id },
      include: { files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } } }
    });
  });
}

export async function submit(submission) {
  if (!["IN_PROGRESS", "RESUBMITTED", "RETURNED"].includes(submission.status)) {
    throw new HttpError(409, "Não há rascunho pronto para envio.");
  }
  const version = await prisma.submissionVersion.findFirst({
    where: { submissionId: submission.id },
    orderBy: { versionNumber: "desc" },
    include: { _count: { select: { files: true } } }
  });
  if (!version || version._count.files === 0) {
    throw new HttpError(400, "Anexe ao menos um arquivo antes de enviar.");
  }

  return prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      history: { create: { status: "SUBMITTED", note: `Versão ${version.versionNumber} enviada.` } }
    },
    include: {
      versions: { orderBy: { versionNumber: "asc" }, include: { files: true } },
      history: { orderBy: { createdAt: "asc" } }
    }
  });
}

// Reabre para reenvio (apenas se devolvido e a atividade permitir).
export async function reopenForResubmission(submission) {
  const activity = await prisma.activity.findUnique({ where: { id: submission.activityId } });
  if (!activity.allowResubmission) {
    throw new HttpError(409, "Esta atividade não permite reenvio.");
  }
  if (submission.status !== "RETURNED") {
    throw new HttpError(409, "O reenvio só é permitido quando a entrega foi devolvida para ajustes.");
  }
  const last = await prisma.submissionVersion.findFirst({
    where: { submissionId: submission.id }, orderBy: { versionNumber: "desc" }
  });
  await prisma.submissionVersion.create({
    data: { submissionId: submission.id, versionNumber: (last?.versionNumber || 0) + 1, note: "Reenvio" }
  });
  return prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "RESUBMITTED",
      history: { create: { status: "RESUBMITTED", note: "Entrega reaberta para reenvio." } }
    }
  });
}

// Autoriza e retorna metadados do arquivo para download pelo DONO (estudante).
export async function getFileForOwner(studentId, fileId) {
  const file = await prisma.submissionFile.findUnique({
    where: { id: fileId },
    include: { version: { include: { submission: { select: { studentId: true } } } } }
  });
  if (!file || file.version.submission.studentId !== studentId) {
    throw new HttpError(404, "Arquivo não encontrado.");
  }
  return file;
}

// Remove do disco arquivos órfãos (usado em rollback de upload).
export function cleanupStoredFiles(filesMeta) {
  for (const f of filesMeta) removeFile(f.storedName);
}
