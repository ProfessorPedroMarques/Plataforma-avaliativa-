
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";
import { getCourse } from "./courseService.js";

const activityInclude = {
  schoolClass: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { id: true, name: true } } } },
  evaluators: { orderBy: { createdAt: "asc" }, select: { teacher: { select: { id: true, user: { select: { name: true, email: true } } } } } },
  rubricVersion: {
    select: {
      id: true, versionNumber: true, immutable: true, totalPoints: true,
      rubric: { select: { id: true, name: true } }
    }
  }
};

async function assertTeachers(teacherIds) {
  const unique = [...new Set(teacherIds)];
  const found = await prisma.teacher.count({ where: { id: { in: unique } } });
  if (found !== unique.length) throw new HttpError(400, "Professor avaliador inexistente.");
  return unique;
}

// Formata a atividade com a lista de professores avaliadores.
function shape(activity) {
  if (!activity) return activity;
  const { evaluators, ...rest } = activity;
  return { ...rest, teachers: (evaluators || []).map(e => ({ id: e.teacher.id, name: e.teacher.user.name, email: e.teacher.user.email })) };
}

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

// Turma e disciplina são sempre as do curso único; teacherIds = professores avaliadores.
export async function createActivity(adminId, { teacherIds = [], ...data }) {
  const course = await getCourse();
  data.classId = course.classId;
  data.subjectId = course.subjectId;
  if (!data.rubricVersionId) throw new HttpError(400, "Selecione os critérios de avaliação da atividade.");
  await assertReferences(data);
  const ids = await assertTeachers(teacherIds);
  if (ids.length === 0) throw new HttpError(400, "Selecione ao menos um professor avaliador.");
  const activity = await prisma.activity.create({
    data: {
      ...data, teacherId: ids[0], createdById: adminId,
      evaluators: { create: ids.map(teacherId => ({ teacherId })) }
    },
    include: activityInclude
  });
  return shape(activity);
}

export async function listActivities(filter = {}) {
  const where = {};
  if (filter.teacherId) where.evaluators = { some: { teacherId: filter.teacherId } };
  if (filter.status) where.status = filter.status;
  const list = await prisma.activity.findMany({ where, orderBy: { createdAt: "desc" }, include: activityInclude });
  return list.map(shape);
}

export async function getActivity(id) {
  const activity = await prisma.activity.findUnique({ where: { id }, include: activityInclude });
  if (!activity) throw new HttpError(404, "Atividade não encontrada.");
  return shape(activity);
}

export async function updateActivity(id, { teacherIds, ...data }) {
  await getActivity(id);
  delete data.classId; delete data.subjectId;
  await assertReferences(data);
  if (teacherIds !== undefined) {
    const ids = await assertTeachers(teacherIds);
    if (ids.length === 0) throw new HttpError(400, "A atividade precisa de ao menos um professor avaliador.");
    data.teacherId = ids[0];
    await prisma.$transaction([
      prisma.activityEvaluator.deleteMany({ where: { activityId: id, teacherId: { notIn: ids } } }),
      ...ids.map(teacherId => prisma.activityEvaluator.upsert({
        where: { activityId_teacherId: { activityId: id, teacherId } }, update: {}, create: { activityId: id, teacherId }
      }))
    ]);
  }
  return shape(await prisma.activity.update({ where: { id }, data, include: activityInclude }));
}

export async function setStatus(id, status) {
  await getActivity(id);
  return shape(await prisma.activity.update({ where: { id }, data: { status }, include: activityInclude }));
}

export async function deleteActivity(id) {
  await getActivity(id);
  const [subs, evals] = await Promise.all([
    prisma.submission.count({ where: { activityId: id } }),
    prisma.evaluation.count({ where: { activityId: id } })
  ]);
  if (subs + evals > 0) throw new HttpError(409, "A atividade já recebeu envios e não pode ser excluída. Encerre-a em vez de excluir.");
  await prisma.activity.delete({ where: { id } });
  return { id };
}
