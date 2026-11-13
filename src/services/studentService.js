
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";

// Resolve o registro Student a partir do userId autenticado.
export async function getStudentByUser(userId) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new HttpError(403, "Usuário não possui perfil de estudante.");
  return student;
}

// IDs das turmas em que o estudante está matriculado (ativo).
async function enrolledClassIds(studentId) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    select: { classId: true }
  });
  return enrollments.map(e => e.classId);
}

// Atividades disponíveis para o estudante (das suas turmas, não-rascunho).
export async function listAvailableActivities(studentId) {
  const classIds = await enrolledClassIds(studentId);
  if (classIds.length === 0) return [];

  const activities = await prisma.activity.findMany({
    where: { classId: { in: classIds }, status: { in: ["OPEN", "CLOSED"] } },
    orderBy: { dueDate: "asc" },
    include: {
      schoolClass: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } }
    }
  });

  // Anexa a entrega do próprio aluno (se houver) a cada atividade.
  const subs = await prisma.submission.findMany({
    where: { studentId, activityId: { in: activities.map(a => a.id) } },
    select: { id: true, activityId: true, status: true, submittedAt: true }
  });
  const byActivity = new Map(subs.map(s => [s.activityId, s]));

  return activities.map(a => ({
    ...a,
    mySubmission: byActivity.get(a.id) || null,
    windowOpen: isWindowOpen(a)
  }));
}

function isWindowOpen(activity) {
  if (activity.status !== "OPEN") return false;
  const now = new Date();
  if (activity.openDate && now < activity.openDate) return false;
  if (activity.dueDate && now > activity.dueDate) return false;
  return true;
}

export async function getAvailableActivity(studentId, activityId) {
  const classIds = await enrolledClassIds(studentId);
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      schoolClass: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { user: { select: { name: true } } } }
    }
  });
  if (!activity || !classIds.includes(activity.classId) || activity.status === "DRAFT") {
    throw new HttpError(404, "Atividade não encontrada ou indisponível.");
  }
  return { ...activity, windowOpen: isWindowOpen(activity) };
}

// Garante que a atividade pertence ao aluno e devolve-a (para validações de envio).
export async function assertActivityForStudent(studentId, activityId) {
  const classIds = await enrolledClassIds(studentId);
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity || !classIds.includes(activity.classId)) {
    throw new HttpError(404, "Atividade indisponível para você.");
  }
  return activity;
}

const submissionInclude = {
  activity: { select: { id: true, title: true, dueDate: true, allowedFormats: true, maxFiles: true, maxFileSizeMb: true, allowResubmission: true, status: true } },
  versions: {
    orderBy: { versionNumber: "asc" },
    include: { files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } } }
  },
  history: { orderBy: { createdAt: "asc" } }
};

export async function listMySubmissions(studentId) {
  return prisma.submission.findMany({
    where: { studentId },
    orderBy: { updatedAt: "desc" },
    include: {
      activity: { select: { id: true, title: true, dueDate: true } },
      versions: { select: { id: true, versionNumber: true, _count: { select: { files: true } } } }
    }
  });
}

// Busca entrega garantindo que pertence ao estudante.
export async function getOwnedSubmission(studentId, submissionId, full = true) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: full ? submissionInclude : undefined
  });
  if (!submission || submission.studentId !== studentId) {
    throw new HttpError(404, "Entrega não encontrada.");
  }
  return submission;
}

export async function createSubmission(studentId, { activityId, title, description }) {
  const activity = await assertActivityForStudent(studentId, activityId);
  if (activity.mode !== "INDIVIDUAL") {
    throw new HttpError(409, "Esta atividade é em equipe; a entrega individual não se aplica.");
  }
  const existing = await prisma.submission.findFirst({ where: { activityId, studentId } });
  if (existing) throw new HttpError(409, "Você já possui uma entrega para esta atividade.");

  const submission = await prisma.submission.create({
    data: {
      activityId, studentId, title, description,
      status: "NOT_STARTED",
      history: { create: { status: "NOT_STARTED", note: "Entrega iniciada." } }
    },
    include: submissionInclude
  });
  return submission;
}

export async function updateSubmissionMeta(studentId, submissionId, { title, description }) {
  const submission = await getOwnedSubmission(studentId, submissionId, false);
  if (["SUBMITTED", "UNDER_REVIEW", "EVALUATED"].includes(submission.status)) {
    throw new HttpError(409, "Entrega já enviada não pode ser alterada.");
  }
  return prisma.submission.update({
    where: { id: submissionId },
    data: { ...(title !== undefined ? { title } : {}), ...(description !== undefined ? { description } : {}) },
    include: submissionInclude
  });
}
