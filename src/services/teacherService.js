
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";

export async function getTeacherByUser(userId) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new HttpError(403, "Usuário não possui perfil de professor.");
  return teacher;
}

// Turmas em que o professor leciona (via ClassSubject).
export async function teacherClassIds(teacherId) {
  const rows = await prisma.classSubject.findMany({
    where: { teacherId }, select: { classId: true }
  });
  return [...new Set(rows.map(r => r.classId))];
}

// Filtro de atividades que o professor pode ver: nas suas turmas OU onde é o responsável.
async function allowedActivityFilter(teacher) {
  const classIds = await teacherClassIds(teacher.id);
  return {
    OR: [
      { classId: { in: classIds.length ? classIds : ["__none__"] } },
      { teacherId: teacher.id }
    ]
  };
}

// IDs das atividades autorizadas (para consultas de entregas).
export async function allowedActivityIds(teacher) {
  const filter = await allowedActivityFilter(teacher);
  const acts = await prisma.activity.findMany({ where: filter, select: { id: true } });
  return acts.map(a => a.id);
}

const RECEIVED_STATES = ["SUBMITTED", "UNDER_REVIEW", "EVALUATED", "RETURNED", "RESUBMITTED"];

export async function dashboard(teacher) {
  const classIds = await teacherClassIds(teacher.id);
  const activityIds = await allowedActivityIds(teacher);

  const [studentsCount, byStatusRaw, evalsByStatus, awaitingPublication] = await Promise.all([
    prisma.enrollment.count({ where: { classId: { in: classIds.length ? classIds : ["__none__"] }, status: "ACTIVE" } }),
    prisma.submission.groupBy({
      by: ["status"],
      where: { activityId: { in: activityIds.length ? activityIds : ["__none__"] } },
      _count: { _all: true }
    }),
    prisma.evaluation.groupBy({
      by: ["status"],
      where: { classId: { in: classIds.length ? classIds : ["__none__"] } },
      _count: { _all: true }
    }),
    prisma.evaluationResult.count({
      where: { status: "DRAFT", evaluation: { classId: { in: classIds.length ? classIds : ["__none__"] } } }
    })
  ]);

  const submissionsByStatus = Object.fromEntries(byStatusRaw.map(r => [r.status, r._count._all]));
  const received = RECEIVED_STATES.reduce((sum, s) => sum + (submissionsByStatus[s] || 0), 0);
  const pending = (submissionsByStatus.NOT_STARTED || 0) + (submissionsByStatus.IN_PROGRESS || 0);

  return {
    turmasVinculadas: classIds.length,
    totalAlunos: studentsCount,
    projetosRecebidos: received,
    projetosEmAndamento: pending,
    submissionsByStatus,
    avaliacoesPorStatus: Object.fromEntries(evalsByStatus.map(r => [r.status, r._count._all])),
    resultadosAguardandoPublicacao: awaitingPublication
  };
}

// Lista entregas recebidas com filtros (turma, atividade, aluno, status).
export async function listReceivedSubmissions(teacher, { classId, activityId, studentId, status } = {}) {
  const activityIds = await allowedActivityIds(teacher);
  const where = {
    activityId: { in: activityIds.length ? activityIds : ["__none__"] }
  };
  if (activityId) where.activityId = activityIds.includes(activityId) ? activityId : "__none__";
  if (classId) where.activity = { classId };
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;
  else where.status = { in: RECEIVED_STATES }; // por padrão, só os efetivamente recebidos

  return prisma.submission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: {
      activity: { select: { id: true, title: true, classId: true, dueDate: true, schoolClass: { select: { name: true } } } },
      student: { select: { id: true, registrationNumber: true, user: { select: { name: true } } } },
      versions: { select: { id: true, versionNumber: true, _count: { select: { files: true } } } }
    }
  });
}

async function assertSubmissionAllowed(teacher, submissionId, full = true) {
  const activityIds = await allowedActivityIds(teacher);
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: full ? {
      activity: { select: { id: true, title: true, classId: true, allowedFormats: true, rubricVersionId: true, mode: true, schoolClass: { select: { name: true } } } },
      student: { select: { id: true, registrationNumber: true, user: { select: { name: true } } } },
      versions: { orderBy: { versionNumber: "asc" }, include: { files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } } } },
      history: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { id: true, name: true } } } }
    } : undefined
  });
  if (!submission || !activityIds.includes(submission.activityId)) {
    throw new HttpError(404, "Entrega não encontrada ou fora das suas turmas.");
  }
  return submission;
}

export async function getSubmission(teacher, submissionId) {
  return assertSubmissionAllowed(teacher, submissionId, true);
}

// Autoriza download de um arquivo de entrega para o professor responsável.
export async function getFileForTeacher(teacher, fileId) {
  const activityIds = await allowedActivityIds(teacher);
  const file = await prisma.submissionFile.findUnique({
    where: { id: fileId },
    include: { version: { include: { submission: { select: { activityId: true } } } } }
  });
  if (!file || !activityIds.includes(file.version.submission.activityId)) {
    throw new HttpError(404, "Arquivo não encontrado.");
  }
  return file;
}

// ---- Observações internas ----
export async function addNote(teacher, authorUserId, submissionId, content) {
  await assertSubmissionAllowed(teacher, submissionId, false);
  return prisma.submissionNote.create({
    data: { submissionId, authorId: authorUserId, content },
    include: { author: { select: { id: true, name: true } } }
  });
}

export async function deleteNote(teacher, authorUserId, noteId) {
  const note = await prisma.submissionNote.findUnique({ where: { id: noteId } });
  if (!note) throw new HttpError(404, "Observação não encontrada.");
  await assertSubmissionAllowed(teacher, note.submissionId, false);
  if (note.authorId !== authorUserId) throw new HttpError(403, "Só o autor pode remover a observação.");
  await prisma.submissionNote.delete({ where: { id: noteId } });
  return { id: noteId };
}
