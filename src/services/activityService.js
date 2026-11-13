
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";

const activityInclude = {
  schoolClass: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { id: true, name: true } } } },
  rubricVersion: {
    select: {
      id: true, versionNumber: true, immutable: true, totalPoints: true,
      rubric: { select: { id: true, name: true } }
    }
  }
};

async function assertReferences({ classId, subjectId, teacherId, rubricVersionId }) {
  if (classId) {
    const exists = await prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!exists) throw new HttpError(400, "Turma (classId) inexistente.");
  }
  if (subjectId) {
    const exists = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!exists) throw new HttpError(400, "Disciplina (subjectId) inexistente.");
  }
  if (teacherId) {
    const exists = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!exists) throw new HttpError(400, "Professor (teacherId) inexistente.");
  }
  if (rubricVersionId) {
    const version = await prisma.rubricVersion.findUnique({ where: { id: rubricVersionId } });
    if (!version) throw new HttpError(400, "Versão de rubrica (rubricVersionId) inexistente.");
    // Boa prática: atividade deve apontar para uma versão PUBLICADA (imutável).
    if (!version.immutable) {
      throw new HttpError(409, "A rubrica vinculada deve estar publicada (versão imutável).");
    }
  }
}

export async function createActivity(adminId, data) {
  await assertReferences(data);
  return prisma.activity.create({
    data: { ...data, createdById: adminId },
    include: activityInclude
  });
}

export async function listActivities(filter = {}) {
  const where = {};
  if (filter.classId) where.classId = filter.classId;
  if (filter.teacherId) where.teacherId = filter.teacherId;
  if (filter.status) where.status = filter.status;
  return prisma.activity.findMany({ where, orderBy: { createdAt: "desc" }, include: activityInclude });
}

export async function getActivity(id) {
  const activity = await prisma.activity.findUnique({ where: { id }, include: activityInclude });
  if (!activity) throw new HttpError(404, "Atividade não encontrada.");
  return activity;
}

export async function updateActivity(id, data) {
  await getActivity(id);
  await assertReferences(data);
  return prisma.activity.update({ where: { id }, data, include: activityInclude });
}

export async function setStatus(id, status) {
  await getActivity(id);
  return prisma.activity.update({ where: { id }, data: { status }, include: activityInclude });
}

export async function deleteActivity(id) {
  await getActivity(id);
  await prisma.activity.delete({ where: { id } });
  return { id };
}
