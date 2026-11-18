// =====================================================================
// AVALIAÇÃO DA APRESENTAÇÃO — estrutura independente dos critérios de documento
//  ADMIN:     cadastra/edita/exclui/ordena/ativa os critérios da apresentação.
//  PROFESSOR: (banca da atividade) avalia CADA aluno individualmente pelos
//             critérios ativos; cada professor tem a sua avaliação por aluno.
// =====================================================================
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";
import { allowedActivityIds } from "./teacherService.js";
import { getOrCreateEvaluation } from "./evaluationService.js";
import { activePresentationCriteria, scoreEvaluation, presentationOf, refreshResult } from "./gradeService.js";
import { calculatePresentation } from "../utils/rubricCalculation.js";

const isEmpty = v => v === null || v === undefined || v === "";
const key = t => String(t).trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
const critDto = (c, usage = 0) => ({
  id: c.id, title: c.title, description: c.description, maxPoints: Number(c.maxPoints), weight: Number(c.weight),
  active: c.active, position: c.position, used: usage > 0, usage
});

// ======================= ADMIN: CRITÉRIOS =======================

export async function listCriteria() {
  const list = await prisma.presentationCriterion.findMany({
    where: { archived: false }, orderBy: { position: "asc" },
    include: { _count: { select: { scores: true } } }
  });
  const items = list.map(c => critDto(c, c._count.scores));
  const active = items.filter(c => c.active);
  return { criteria: items, maxScore: calculatePresentation({ criteria: active, scores: {} }).max };
}

function parseCriterion(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title ?? "").trim();
    if (!title) throw new HttpError(400, "Informe o nome do critério.");
    if (title.length > 150) throw new HttpError(400, "Nome do critério muito longo (máx. 150).");
    data.title = title;
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (!partial || body.maxPoints !== undefined) {
    const m = Number(body.maxPoints ?? 10);
    if (!Number.isFinite(m) || m <= 0 || m > 1000) throw new HttpError(400, "Pontuação máxima inválida (maior que 0).");
    data.maxPoints = m;
  }
  if (!partial || body.weight !== undefined) {
    const w = Number(body.weight ?? 1);
    if (!Number.isFinite(w) || w <= 0 || w > 100) throw new HttpError(400, "Peso inválido (maior que 0).");
    data.weight = w;
  }
  if (body.active !== undefined) data.active = Boolean(body.active);
  return data;
}

async function assertUniqueTitle(title, exceptId) {
  const all = await prisma.presentationCriterion.findMany({ where: { archived: false }, select: { id: true, title: true } });
  if (all.some(c => c.id !== exceptId && key(c.title) === key(title))) throw new HttpError(409, `Já existe um critério de apresentação chamado "${title}".`);
}

export async function createCriterion(adminId, body) {
  const data = parseCriterion(body);
  await assertUniqueTitle(data.title);
  const last = await prisma.presentationCriterion.aggregate({ _max: { position: true } });
  await prisma.presentationCriterion.create({ data: { ...data, position: (last._max.position || 0) + 1, createdById: adminId } });
  await refreshOpenResults();
  return listCriteria();
}

export async function updateCriterion(id, body) {
  const current = await prisma.presentationCriterion.findUnique({ where: { id }, include: { _count: { select: { scores: true } } } });
  if (!current || current.archived) throw new HttpError(404, "Critério não encontrado.");
  const data = parseCriterion(body, { partial: true });
  if (data.title) await assertUniqueTitle(data.title, id);
  const changesPoints = (data.maxPoints !== undefined && data.maxPoints !== Number(current.maxPoints))
    || (data.weight !== undefined && data.weight !== Number(current.weight));
  if (changesPoints && current._count.scores > 0) {
    throw new HttpError(409, "Este critério já foi usado em avaliações: a pontuação máxima e o peso não podem mudar (isso alteraria notas já dadas). Crie um novo critério e desative este.");
  }
  await prisma.presentationCriterion.update({ where: { id }, data });
  if (data.active !== undefined || changesPoints) await refreshOpenResults();
  return listCriteria();
}

// Excluir: se já foi usado em avaliações, fica arquivado (some das telas, preserva o histórico).
export async function deleteCriterion(id) {
  const c = await prisma.presentationCriterion.findUnique({ where: { id }, include: { _count: { select: { scores: true } } } });
  if (!c || c.archived) throw new HttpError(404, "Critério não encontrado.");
  let archived = false;
  if (c._count.scores > 0) {
    await prisma.presentationCriterion.update({ where: { id }, data: { archived: true, active: false } });
    archived = true;
  } else {
    await prisma.presentationCriterion.delete({ where: { id } });
  }
  await refreshOpenResults();
  return { ...(await listCriteria()), archived };
}

// Reordena: recebe a lista de IDs na ordem desejada.
export async function reorderCriteria(ids) {
  if (!Array.isArray(ids) || ids.some(i => typeof i !== "string")) throw new HttpError(400, "Envie a lista de critérios na nova ordem.");
  const existing = await prisma.presentationCriterion.findMany({ where: { archived: false }, select: { id: true } });
  const set = new Set(existing.map(c => c.id));
  if (ids.length !== set.size || ids.some(i => !set.has(i))) throw new HttpError(400, "A nova ordem deve conter todos os critérios.");
  await prisma.$transaction(ids.map((id, i) => prisma.presentationCriterion.update({ where: { id }, data: { position: i + 1 } })));
  return listCriteria();
}

// Mudança nos critérios ativos altera o que é "completo": recalcula avaliações e notas ainda NÃO publicadas.
async function refreshOpenResults() {
  const criteria = await activePresentationCriteria();
  const evals = await prisma.presentationEvaluation.findMany({ select: { id: true, activityId: true, studentId: true } });
  for (const e of evals) await scoreEvaluation(prisma, e.id, criteria);
  const results = await prisma.evaluationResult.findMany({ where: { status: "DRAFT", studentId: { not: null } }, select: { id: true } });
  for (const r of results) await refreshResult(prisma, r.id);
}

// ======================= PROFESSOR: AVALIAÇÃO =======================

async function assertPresentationActivity(teacher, activityId) {
  const ids = await allowedActivityIds(teacher, "presentation");
  if (!ids.includes(activityId)) throw new HttpError(404, "Você não faz parte da banca de apresentação desta atividade.");
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) throw new HttpError(404, "Atividade não encontrada.");
  return activity;
}

// Valida que o aluno pertence ao projeto (grupo da atividade) e devolve o grupo.
async function assertStudentInProject(activity, studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { name: true } }, enrollments: { where: { classId: activity.classId, status: "ACTIVE" } } }
  });
  if (!student || student.enrollments.length === 0) throw new HttpError(404, "Aluno não pertence à turma desta atividade.");
  let group = null;
  if (activity.mode === "GROUP") {
    const m = await prisma.groupMember.findFirst({ where: { studentId, group: { classId: activity.classId } }, include: { group: true } });
    if (!m) throw new HttpError(409, "Este aluno não está em nenhum grupo do projeto.");
    group = m.group;
  }
  return { student, group };
}

// Garante o resultado do aluno (onde fica a nota final = grupo + apresentação).
async function ensureResult(teacher, activity, studentId, group) {
  const evaluation = await getOrCreateEvaluation(teacher, activity);
  const submission = await prisma.submission.findFirst({
    where: { activityId: activity.id, ...(group ? { groupId: group.id } : { studentId }) }, select: { id: true }
  });
  const existing = await prisma.evaluationResult.findUnique({ where: { evaluationId_studentId: { evaluationId: evaluation.id, studentId } } });
  if (existing) {
    if ((group && !existing.groupId) || (submission && !existing.submissionId)) {
      return prisma.evaluationResult.update({ where: { id: existing.id }, data: {
        ...(group && !existing.groupId ? { groupId: group.id } : {}), ...(submission && !existing.submissionId ? { submissionId: submission.id } : {}) } });
    }
    return existing;
  }
  return prisma.evaluationResult.create({ data: {
    evaluationId: evaluation.id, studentId, groupId: group?.id || null, submissionId: submission?.id || null, maxScore: 0, status: "DRAFT" } });
}

const stateOf = (result) => !result ? "NOT_STARTED"
  : (result.status === "PUBLISHED" || result.status === "REVISED") ? "PUBLISHED"
  : result.finalizedAt ? "READY" : "IN_PROGRESS";

// Projetos (atividades) da banca do professor → grupos → integrantes, com a situação de cada aluno.
export async function teacherProjects(teacher) {
  const ids = await allowedActivityIds(teacher, "presentation");
  const activities = await prisma.activity.findMany({ where: { id: { in: ids.length ? ids : ["__none__"] } }, orderBy: { createdAt: "desc" } });
  const { criteria, maxScore } = await listCriteria();
  const active = criteria.filter(c => c.active);
  const out = [];
  for (const a of activities) {
    const evaluation = await prisma.evaluation.findUnique({ where: { activityId: a.id } });
    const results = evaluation ? await prisma.evaluationResult.findMany({
      where: { evaluationId: evaluation.id },
      include: { _count: { select: { criterionScores: { where: { criterion: { scope: { not: "INDIVIDUAL" } } } } } } }
    }) : [];
    const resultBy = new Map(results.map(r => [r.studentId, r]));
    const evals = await prisma.presentationEvaluation.findMany({ where: { activityId: a.id } });
    const row = (st) => {
      const mine = evals.find(e => e.studentId === st.id && e.teacherId === teacher.id);
      const all = evals.filter(e => e.studentId === st.id);
      const r = resultBy.get(st.id);
      return {
        id: st.id, name: st.user.name,
        myEvaluation: mine ? { score: Number(mine.score ?? 0), complete: mine.complete } : null,
        evaluators: all.length,
        groupScore: r?._count?.criterionScores ? Number(r.groupScore ?? 0) : null,
        presentationScore: r?.presentationScore !== null && r?.presentationScore !== undefined ? Number(r.presentationScore) : null,
        finalScore: r?.score !== null && r?.score !== undefined ? Number(r.score) : null,
        state: stateOf(r)
      };
    };
    let groups = [];
    if (a.mode === "GROUP") {
      const gs = await prisma.studentGroup.findMany({
        where: { classId: a.classId }, orderBy: { name: "asc" },
        include: { members: { include: { student: { include: { user: { select: { name: true } } } } } } }
      });
      groups = gs.map(g => ({ id: g.id, name: g.name, members: g.members.map(m => row(m.student)).sort((x, y) => x.name.localeCompare(y.name)) }));
    } else {
      const ens = await prisma.enrollment.findMany({ where: { classId: a.classId, status: "ACTIVE" }, include: { student: { include: { user: { select: { name: true } } } } } });
      groups = [{ id: null, name: "Alunos", members: ens.map(e => row(e.student)).sort((x, y) => x.name.localeCompare(y.name)) }];
    }
    out.push({ activity: { id: a.id, title: a.title, mode: a.mode, status: a.status }, criteriaCount: active.length, maxScore, groups });
  }
  return out;
}

// Abre a avaliação de UM aluno: critérios ativos (do ADMIN) + a avaliação deste professor.
export async function openStudent(teacher, activityId, studentId) {
  const activity = await assertPresentationActivity(teacher, activityId);
  const { student, group } = await assertStudentInProject(activity, studentId);
  const criteria = await activePresentationCriteria();
  const mine = await prisma.presentationEvaluation.findUnique({
    where: { activityId_studentId_teacherId: { activityId, studentId, teacherId: teacher.id } }, include: { scores: true }
  });
  const byCrit = new Map((mine?.scores || []).map(s => [s.criterionId, Number(s.score)]));
  const pres = await presentationOf(prisma, activityId, studentId);
  const evaluation = await prisma.evaluation.findUnique({ where: { activityId } });
  const result = evaluation ? await prisma.evaluationResult.findUnique({
    where: { evaluationId_studentId: { evaluationId: evaluation.id, studentId } },
    include: { _count: { select: { criterionScores: { where: { criterion: { scope: { not: "INDIVIDUAL" } } } } } } }
  }) : null;
  const members = group ? (await prisma.groupMember.findMany({ where: { groupId: group.id }, include: { student: { include: { user: { select: { name: true } } } } } }))
    .map(m => ({ id: m.student.id, name: m.student.user.name })).sort((x, y) => x.name.localeCompare(y.name)) : [];
  return {
    activity: { id: activity.id, title: activity.title },
    student: { id: student.id, name: student.user.name },
    group: group ? { id: group.id, name: group.name, members } : null,
    criteria: criteria.map(c => ({ ...critDto(c), score: byCrit.has(c.id) ? byCrit.get(c.id) : null })),
    notes: mine?.notes || null,
    myScore: mine ? Number(mine.score ?? 0) : null, myComplete: mine?.complete || false,
    maxScore: pres.max,
    banca: pres.evaluations.map(e => ({ teacher: e.teacher.user.name, mine: e.teacherId === teacher.id, score: Number(e.score ?? 0), complete: e.complete })),
    presentationScore: pres.score, presentationComplete: pres.complete,
    groupScore: result?._count?.criterionScores ? Number(result.groupScore ?? 0) : null,
    finalScore: result?.score !== null && result?.score !== undefined ? Number(result.score) : null,
    state: stateOf(result)
  };
}

// Salva a avaliação individual de UM aluno feita por ESTE professor.
// Não altera a avaliação dos outros integrantes nem a dos outros professores.
export async function saveStudent(teacher, activityId, studentId, { scores, notes, justification }) {
  const activity = await assertPresentationActivity(teacher, activityId);
  const { group } = await assertStudentInProject(activity, studentId);
  if (!Array.isArray(scores)) throw new HttpError(400, "Envie as notas dos critérios.");
  const criteria = await activePresentationCriteria();
  if (!criteria.length) throw new HttpError(409, "O administrador ainda não cadastrou critérios de apresentação ativos.");
  const byId = new Map(criteria.map(c => [c.id, c]));
  for (const item of scores) {
    const c = byId.get(item?.criterionId);
    if (!c) throw new HttpError(400, "Critério inexistente ou inativo.");
    if (!isEmpty(item.score)) {
      const v = Number(item.score);
      if (!Number.isFinite(v) || v < 0) throw new HttpError(400, `${c.title}: a nota não pode ser negativa.`);
      if (v > Number(c.maxPoints)) throw new HttpError(400, `${c.title}: a nota ${v} passa do máximo (${Number(c.maxPoints)}).`);
    }
  }

  const result = await ensureResult(teacher, activity, studentId, group);
  const published = result.status === "PUBLISHED" || result.status === "REVISED";
  if (published && !String(justification || "").trim()) {
    throw new HttpError(409, "A nota deste aluno já foi publicada. Para alterar, informe a justificativa da revisão.");
  }

  await prisma.$transaction(async (tx) => {
    const ev = await tx.presentationEvaluation.upsert({
      where: { activityId_studentId_teacherId: { activityId, studentId, teacherId: teacher.id } },
      update: { notes: notes === undefined ? undefined : (notes ? String(notes).trim() : null), groupId: group?.id || null },
      create: { activityId, studentId, teacherId: teacher.id, groupId: group?.id || null, notes: notes ? String(notes).trim() : null }
    });
    for (const item of scores) {
      if (isEmpty(item.score)) { await tx.presentationScore.deleteMany({ where: { evaluationId: ev.id, criterionId: item.criterionId } }); continue; }
      await tx.presentationScore.upsert({
        where: { evaluationId_criterionId: { evaluationId: ev.id, criterionId: item.criterionId } },
        update: { score: Number(item.score) }, create: { evaluationId: ev.id, criterionId: item.criterionId, score: Number(item.score) }
      });
    }
    await scoreEvaluation(tx, ev.id, criteria);
    const fresh = await refreshResult(tx, result.id, { force: published });
    if (published) {
      await tx.gradeRevision.create({ data: { resultId: result.id, authorId: teacher.userId, previousScore: result.score, newScore: fresh.score, justification: String(justification).trim() } });
      await tx.evaluationResult.update({ where: { id: result.id }, data: { status: "REVISED" } });
    }
  });
  return openStudent(teacher, activityId, studentId);
}
