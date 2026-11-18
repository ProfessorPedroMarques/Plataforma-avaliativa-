import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";
import { getCourse } from "./courseService.js";
import { activePresentationCriteria } from "./gradeService.js";

// =====================================================================
// ATIVIDADES (ADMIN)
// Cada atividade tem DUAS partes, configuradas em menus separados:
//   📄 Documentos   → critérios de documento (nota do grupo) + professores que avaliam os documentos
//   🎤 Apresentação → critérios de apresentação (nota individual) + professores que avaliam a apresentação
// Os critérios ficam num conjunto PRÓPRIO da atividade (criado automaticamente),
// para que alterar uma atividade nunca afete outra.
// =====================================================================

const SCOPE = { DOCUMENT: "GROUP", PRESENTATION: "INDIVIDUAL" };

const activityInclude = {
  schoolClass: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { id: true, name: true } } } },
  evaluators: {
    orderBy: { createdAt: "asc" },
    select: { documents: true, presentation: true, teacher: { select: { id: true, user: { select: { name: true, email: true } } } } }
  },
  rubricVersion: {
    select: {
      id: true, versionNumber: true, immutable: true, totalPoints: true,
      rubric: { select: { id: true, name: true } },
      criteria: { where: { active: true }, orderBy: { position: "asc" }, select: { id: true, title: true, description: true, maxPoints: true, weight: true, scope: true, required: true } }
    }
  }
};

async function assertTeachers(teacherIds = []) {
  const unique = [...new Set(teacherIds)];
  const found = await prisma.teacher.count({ where: { id: { in: unique } } });
  if (found !== unique.length) throw new HttpError(400, "Professor avaliador inexistente.");
  return unique;
}

async function scoresInVersion(versionId) {
  return prisma.criterionScore.count({ where: { criterion: { rubricVersionId: versionId } } });
}

// Formata a atividade: professores por papel e critérios por parte.
async function shape(activity) {
  if (!activity) return activity;
  const { evaluators = [], rubricVersion, ...rest } = activity;
  const t = e => ({ id: e.teacher.id, name: e.teacher.user.name, email: e.teacher.user.email });
  const criteria = (rubricVersion?.criteria || []).map(c => ({
    id: c.id, title: c.title, description: c.description, maxPoints: Number(c.maxPoints), weight: Number(c.weight), required: c.required, scope: c.scope
  }));
  const sum = list => list.reduce((s, c) => s + c.maxPoints * c.weight, 0);
  const documentCriteria = criteria.filter(c => c.scope !== "INDIVIDUAL");
  // Critérios da apresentação: cadastro próprio e independente (Admin › Critérios de Avaliação da Apresentação).
  const presentationCriteria = (await activePresentationCriteria()).map(c => ({ id: c.id, title: c.title, description: c.description, maxPoints: Number(c.maxPoints), weight: Number(c.weight) }));
  return {
    ...rest,
    rubricVersion: rubricVersion ? { id: rubricVersion.id, versionNumber: rubricVersion.versionNumber, immutable: rubricVersion.immutable, rubric: rubricVersion.rubric } : null,
    teachers: evaluators.map(t),
    documentTeachers: evaluators.filter(e => e.documents).map(t),
    presentationTeachers: evaluators.filter(e => e.presentation).map(t),
    documentCriteria, presentationCriteria,
    documentMax: sum(documentCriteria), presentationMax: sum(presentationCriteria),
    criteriaLocked: rubricVersion ? (await scoresInVersion(rubricVersion.id)) > 0 : false
  };
}

function normalizeCriteria(list, scope) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new HttpError(400, "A lista de critérios é inválida.");
  return list.map((c, i) => {
    const title = String(c?.title || "").trim();
    const maxPoints = Number(c?.maxPoints);
    if (!title) throw new HttpError(400, `Informe o nome do critério ${i + 1}.`);
    if (!Number.isFinite(maxPoints) || maxPoints <= 0 || maxPoints > 1000) throw new HttpError(400, `Nota máxima inválida no critério "${title}".`);
    return { title, description: c.description ? String(c.description).trim() : null, maxPoints, weight: 1, required: true, active: true, scope };
  });
}

const key = t => String(t).trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const partName = scope => scope === "INDIVIDUAL" ? "da apresentação" : "dos documentos";

// Critérios não se repetem: os da apresentação precisam ser diferentes dos dos documentos.
function assertDistinct(list) {
  const seen = new Map();
  for (const c of list) {
    const k = key(c.title);
    if (seen.has(k)) {
      const other = seen.get(k);
      throw new HttpError(409, other.scope === c.scope
        ? `O critério "${c.title}" está repetido nos critérios ${partName(c.scope)}.`
        : `O critério "${c.title}" já existe nos critérios ${partName(other.scope)}. Os critérios da apresentação devem ser diferentes dos critérios dos documentos.`);
    }
    seen.set(k, c);
  }
}

// Grava os papéis (documentos/apresentação) de cada professor na atividade.
async function writeEvaluators(tx, activityId, documentIds, presentationIds) {
  const all = [...new Set([...documentIds, ...presentationIds])];
  await tx.activityEvaluator.deleteMany({ where: { activityId, teacherId: { notIn: all.length ? all : ["__none__"] } } });
  for (const teacherId of all) {
    const roles = { documents: documentIds.includes(teacherId), presentation: presentationIds.includes(teacherId) };
    await tx.activityEvaluator.upsert({
      where: { activityId_teacherId: { activityId, teacherId } },
      update: roles, create: { activityId, teacherId, ...roles }
    });
  }
  await tx.activity.update({ where: { id: activityId }, data: { teacherId: documentIds[0] || presentationIds[0] || null } });
}

async function assertPublishedVersion(rubricVersionId) {
  const version = await prisma.rubricVersion.findUnique({ where: { id: rubricVersionId } });
  if (!version) throw new HttpError(400, "Conjunto de critérios inexistente.");
  if (!version.immutable) throw new HttpError(409, "O conjunto de critérios precisa estar publicado.");
}

// data: campos da atividade + documentCriteria[], presentationCriteria[],
//       documentTeacherIds[], presentationTeacherIds[] (ou teacherIds[] = os dois papéis).
export async function createActivity(adminId, input) {
  const { documentCriteria, presentationCriteria, teacherIds, documentTeacherIds, presentationTeacherIds, ...data } = input;
  const course = await getCourse();
  data.classId = course.classId;
  data.subjectId = course.subjectId;

  const docIds = await assertTeachers(documentTeacherIds ?? teacherIds ?? []);
  const presIds = await assertTeachers(presentationTeacherIds ?? teacherIds ?? []);
  if (docIds.length === 0) throw new HttpError(400, "Marque ao menos um professor para avaliar os documentos.");

  const docs = normalizeCriteria(documentCriteria, SCOPE.DOCUMENT);
  if (presentationCriteria !== undefined && presentationCriteria.length) {
    throw new HttpError(400, "Os critérios da apresentação são cadastrados em Admin › Critérios de Avaliação da Apresentação.");
  }
  const pres = [];
  assertDistinct(docs);
  if (!data.rubricVersionId && docs.length === 0) throw new HttpError(400, "Cadastre ao menos um critério de avaliação dos documentos.");
  if (data.rubricVersionId) await assertPublishedVersion(data.rubricVersionId);

  const id = await prisma.$transaction(async (tx) => {
    if (!data.rubricVersionId) {
      const rubric = await tx.rubric.create({
        data: {
          name: `Critérios — ${data.title}`, createdById: adminId,
          versions: { create: { versionNumber: 1, immutable: true, publishedAt: new Date(),
            criteria: { create: [...docs, ...pres].map((c, i) => ({ ...c, position: i + 1 })) } } }
        },
        include: { versions: true }
      });
      data.rubricVersionId = rubric.versions[0].id;
    }
    const activity = await tx.activity.create({ data: { ...data, createdById: adminId } });
    await writeEvaluators(tx, activity.id, docIds, presIds);
    return activity.id;
  });
  return getActivity(id);
}

export async function listActivities(filter = {}) {
  const where = {};
  if (filter.teacherId) where.evaluators = { some: { teacherId: filter.teacherId } };
  if (filter.status) where.status = filter.status;
  const list = await prisma.activity.findMany({ where, orderBy: { createdAt: "desc" }, include: activityInclude });
  return Promise.all(list.map(shape));
}

export async function getActivity(id) {
  const activity = await prisma.activity.findUnique({ where: { id }, include: activityInclude });
  if (!activity) throw new HttpError(404, "Atividade não encontrada.");
  return shape(activity);
}

export async function updateActivity(id, input) {
  const { teacherIds, documentTeacherIds, presentationTeacherIds, documentCriteria, presentationCriteria, ...data } = input;
  const current = await getActivity(id);
  delete data.classId; delete data.subjectId;
  if (data.rubricVersionId) await assertPublishedVersion(data.rubricVersionId);

  const wantsTeachers = teacherIds !== undefined || documentTeacherIds !== undefined || presentationTeacherIds !== undefined;
  let docIds, presIds;
  if (wantsTeachers) {
    docIds = await assertTeachers(documentTeacherIds ?? teacherIds ?? current.documentTeachers.map(t => t.id));
    presIds = await assertTeachers(presentationTeacherIds ?? teacherIds ?? current.presentationTeachers.map(t => t.id));
    if (docIds.length === 0) throw new HttpError(400, "A atividade precisa de ao menos um professor avaliando os documentos.");
  }
  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.activity.update({ where: { id }, data });
    if (wantsTeachers) await writeEvaluators(tx, id, docIds, presIds);
  });
  return getActivity(id);
}

// Garante que a atividade tenha um conjunto de critérios só dela (copia se for compartilhado).
async function ensureOwnVersion(activityId, adminId) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) throw new HttpError(404, "Atividade não encontrada.");
  if (activity.rubricVersionId) {
    if (await scoresInVersion(activity.rubricVersionId) > 0) {
      throw new HttpError(409, "Já existem notas lançadas com estes critérios; eles não podem mais ser alterados.");
    }
    const sharedWith = await prisma.activity.count({ where: { rubricVersionId: activity.rubricVersionId, NOT: { id: activityId } } });
    if (sharedWith === 0) return { version: activity.rubricVersionId, map: null };
  }
  // Cria um conjunto próprio (copiando os critérios atuais, se houver).
  const source = activity.rubricVersionId
    ? await prisma.criterion.findMany({ where: { rubricVersionId: activity.rubricVersionId }, orderBy: { position: "asc" } })
    : [];
  const map = new Map();
  const versionId = await prisma.$transaction(async (tx) => {
    const rubric = await tx.rubric.create({
      data: { name: `Critérios — ${activity.title}`, createdById: adminId || activity.createdById,
        versions: { create: { versionNumber: 1, immutable: true, publishedAt: new Date() } } },
      include: { versions: true }
    });
    const vId = rubric.versions[0].id;
    for (const c of source) {
      const copy = await tx.criterion.create({ data: {
        rubricVersionId: vId, title: c.title, description: c.description, guidance: c.guidance, weight: c.weight,
        maxPoints: c.maxPoints, position: c.position, required: c.required, active: c.active, scope: c.scope } });
      map.set(c.id, copy.id);
    }
    await tx.activity.update({ where: { id: activityId }, data: { rubricVersionId: vId } });
    await tx.evaluation.updateMany({ where: { activityId }, data: { rubricVersionId: vId } });
    return vId;
  });
  return { version: versionId, map };
}

// Adiciona um critério a uma das partes da atividade. part: "DOCUMENT" | "PRESENTATION".
export async function addCriterion(adminId, activityId, part, body) {
  if (part === "PRESENTATION") throw new HttpError(400, "Os critérios da apresentação são cadastrados em Admin › Critérios de Avaliação da Apresentação.");
  if (part !== "DOCUMENT") throw new HttpError(400, "Parte inválida.");
  const [c] = normalizeCriteria([body], SCOPE[part]);
  const { version } = await ensureOwnVersion(activityId, adminId);
  const existing = await prisma.criterion.findMany({ where: { rubricVersionId: version, active: true, scope: { not: "INDIVIDUAL" } }, select: { title: true, scope: true } });
  assertDistinct([...existing, c]);
  const last = await prisma.criterion.aggregate({ where: { rubricVersionId: version }, _max: { position: true } });
  await prisma.criterion.create({ data: { ...c, rubricVersionId: version, position: (last._max.position || 0) + 1 } });
  return getActivity(activityId);
}

export async function removeCriterion(adminId, activityId, criterionId) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) throw new HttpError(404, "Atividade não encontrada.");
  const criterion = await prisma.criterion.findUnique({ where: { id: criterionId } });
  if (!criterion || criterion.rubricVersionId !== activity.rubricVersionId) throw new HttpError(404, "Critério não pertence a esta atividade.");
  const { map } = await ensureOwnVersion(activityId, adminId);
  const targetId = map ? map.get(criterionId) : criterionId;
  await prisma.criterion.delete({ where: { id: targetId } });
  return getActivity(activityId);
}

export async function setStatus(id, status) {
  await getActivity(id);
  await prisma.activity.update({ where: { id }, data: { status } });
  return getActivity(id);
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
