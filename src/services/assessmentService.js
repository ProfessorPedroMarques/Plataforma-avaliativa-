
// =====================================================================
// AVALIAÇÃO EM DUAS ETAPAS (Professor)
//  1) DOCUMENTOS enviados  → critérios de documento (scope GROUP)
//     A nota vale para TODOS os integrantes do grupo (nota do grupo).
//  2) APRESENTAÇÃO         → critérios de apresentação (scope INDIVIDUAL)
//     Nota individual de cada aluno.
//  NOTA FINAL do aluno = nota do grupo + nota da apresentação
//  (calculada pela fonte única: utils/rubricCalculation.js)
// =====================================================================
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";
import { allowedActivityIds } from "./teacherService.js";
import { assertActivityAllowed, getOrCreateEvaluation, getActiveCriteria } from "./evaluationService.js";
import { recompute } from "./groupEvaluationService.js";
import { calculateResult, validateCriterionScore } from "../utils/rubricCalculation.js";

const isEmpty = v => v === null || v === undefined || v === "";

function calcFor(criteria, criterionScores) {
  const scores = {};
  for (const cs of criterionScores || []) scores[cs.criterionId] = Number(cs.score);
  return calculateResult({
    criteria: criteria.map(c => ({ id: c.id, weight: c.weight, maxPoints: c.maxPoints, scope: c.scope })),
    scores
  });
}

function critDto(c, cs) {
  return {
    id: c.id, title: c.title, description: c.description, guidance: c.guidance,
    weight: Number(c.weight), maxPoints: Number(c.maxPoints), required: c.required,
    score: cs ? Number(cs.score) : null, comment: cs?.comment || null
  };
}

// Entrega que o professor pode ver (atividade nas suas turmas).
async function getAllowedSubmission(teacher, submissionId) {
  const ids = await allowedActivityIds(teacher, "documents");
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      activity: true,
      student: { select: { id: true, user: { select: { name: true } } } },
      group: { include: { members: { include: { student: { select: { id: true, user: { select: { name: true } } } } } } } },
      versions: { orderBy: { versionNumber: "asc" }, include: { files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } } } }
    }
  });
  if (!submission || !ids.includes(submission.activityId)) throw new HttpError(404, "Entrega não encontrada, ou você não é avaliador dos documentos desta atividade.");
  if (!submission.activity.rubricVersionId) throw new HttpError(409, "A atividade não possui rubrica vinculada. Configure no ADMIN.");
  return submission;
}

// Autores da entrega: integrantes do grupo (equipe) ou o próprio aluno (individual).
function ownersOf(submission) {
  if (submission.groupId) return submission.group.members.map(m => ({ studentId: m.student.id, name: m.student.user.name }));
  if (submission.studentId) return [{ studentId: submission.student.id, name: submission.student.user.name }];
  return [];
}

// Garante 1 resultado por aluno (idempotente), vinculado à entrega e ao grupo.
async function ensureResult(evaluationId, studentId, { groupId, submissionId }) {
  const existing = await prisma.evaluationResult.findUnique({
    where: { evaluationId_studentId: { evaluationId, studentId } },
    include: { criterionScores: true, feedbacks: true }
  });
  if (existing) {
    if ((submissionId && !existing.submissionId) || (groupId && !existing.groupId)) {
      return prisma.evaluationResult.update({
        where: { id: existing.id },
        data: { ...(submissionId && !existing.submissionId ? { submissionId } : {}), ...(groupId && !existing.groupId ? { groupId } : {}) },
        include: { criterionScores: true, feedbacks: true }
      });
    }
    return existing;
  }
  return prisma.evaluationResult.create({
    data: { evaluationId, studentId, groupId: groupId || null, submissionId: submissionId || null, maxScore: 0, status: "DRAFT" },
    include: { criterionScores: true, feedbacks: true }
  });
}

// ---------------- 1) AVALIAÇÃO DOS DOCUMENTOS ----------------

export async function openDocumentEvaluation(teacher, submissionId) {
  const submission = await getAllowedSubmission(teacher, submissionId);
  const evaluation = await getOrCreateEvaluation(teacher, submission.activity);
  const owners = ownersOf(submission);
  if (owners.length === 0) throw new HttpError(409, "A entrega não possui alunos vinculados.");

  const results = [];
  for (const o of owners) {
    results.push(await ensureResult(evaluation.id, o.studentId, { groupId: submission.groupId, submissionId: submission.id }));
  }

  if (submission.status === "SUBMITTED" || submission.status === "RESUBMITTED") {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: "UNDER_REVIEW", history: { create: { status: "UNDER_REVIEW", note: "Documentos em avaliação." } } }
    });
    submission.status = "UNDER_REVIEW";
  }

  const criteria = await getActiveCriteria(submission.activity.rubricVersionId);
  const docCriteria = criteria.filter(c => c.scope !== "INDIVIDUAL");
  const ref = results[0];
  const byCrit = new Map(ref.criterionScores.map(cs => [cs.criterionId, cs]));
  const calc = calcFor(criteria, ref.criterionScores);
  const locked = results.some(r => r.status === "PUBLISHED" || r.status === "REVISED");

  return {
    submission: {
      id: submission.id, title: submission.title, description: submission.description, status: submission.status,
      submittedAt: submission.submittedAt,
      files: submission.versions.flatMap(v => v.files.map(f => ({ ...f, version: v.versionNumber })))
    },
    activity: { id: submission.activity.id, title: submission.activity.title, mode: submission.activity.mode },
    group: submission.group ? { id: submission.group.id, name: submission.group.name } : null,
    owners,
    documentCriteria: docCriteria.map(c => critDto(c, byCrit.get(c.id))),
    documentFeedback: ref.feedbacks.find(f => f.type === "GENERAL")?.content || null,
    groupScore: calc.groupScore, groupMax: calc.groupMax,
    locked
  };
}

export async function saveDocumentScores(teacher, submissionId, { scores, feedback }) {
  const submission = await getAllowedSubmission(teacher, submissionId);
  const evaluation = await getOrCreateEvaluation(teacher, submission.activity);
  const criteria = await getActiveCriteria(submission.activity.rubricVersionId);
  const byId = new Map(criteria.map(c => [c.id, c]));

  for (const item of (scores || [])) {
    const c = byId.get(item.criterionId);
    if (!c || c.scope === "INDIVIDUAL") throw new HttpError(400, "Critério inválido: não é um critério de documento.");
    if (!isEmpty(item.score)) {
      const check = validateCriterionScore(item.score, c.maxPoints);
      if (!check.valid) throw new HttpError(400, `${c.title}: ${check.message}`);
    }
  }

  const owners = ownersOf(submission);
  const results = [];
  for (const o of owners) results.push(await ensureResult(evaluation.id, o.studentId, { groupId: submission.groupId, submissionId: submission.id }));
  if (results.some(r => r.status === "PUBLISHED" || r.status === "REVISED")) {
    throw new HttpError(409, "Há notas já publicadas para este grupo/aluno. Use o fluxo de revisão.");
  }

  await prisma.$transaction(async (tx) => {
    for (const r of results) {
      for (const item of (scores || [])) {
        if (isEmpty(item.score)) {
          await tx.criterionScore.deleteMany({ where: { resultId: r.id, criterionId: item.criterionId } });
          continue;
        }
        await tx.criterionScore.upsert({
          where: { resultId_criterionId: { resultId: r.id, criterionId: item.criterionId } },
          update: { score: Number(item.score), comment: item.comment ?? null },
          create: { resultId: r.id, criterionId: item.criterionId, score: Number(item.score), comment: item.comment ?? null }
        });
      }
      if (feedback !== undefined) {
        await tx.feedback.deleteMany({ where: { resultId: r.id, type: "GENERAL" } });
        if (feedback) await tx.feedback.create({ data: { resultId: r.id, authorId: teacher.userId, type: "GENERAL", content: feedback } });
      }
      await recompute(tx, r.id);
    }
    // Professor avaliou um envio que o aluno não confirmou: o envio passa a "em avaliação".
    if (["NOT_STARTED", "IN_PROGRESS"].includes(submission.status)) {
      await tx.submission.update({
        where: { id: submission.id },
        data: { status: "UNDER_REVIEW", submittedAt: submission.submittedAt || new Date(),
          history: { create: { status: "UNDER_REVIEW", note: "Avaliação iniciada pelo professor (envio não confirmado pelo aluno)." } } }
      });
    }
  });

  return openDocumentEvaluation(teacher, submissionId);
}

// ---------------- 2) AVALIAÇÃO DA APRESENTAÇÃO ----------------
// Estrutura própria e independente dos critérios de documento: ver presentationService.js.

// ---------------- VISÃO DO PROFESSOR POR GRUPOS (documentos) ----------------
// Atividades em que o professor avalia os documentos, com os critérios cadastrados,
// os grupos, os integrantes de cada grupo e a situação do envio — mesmo sem envios.
export async function documentsOverview(teacher) {
  const ids = await allowedActivityIds(teacher, "documents");
  const activities = await prisma.activity.findMany({
    where: { id: { in: ids.length ? ids : ["__none__"] } },
    orderBy: { createdAt: "desc" }
  });
  const out = [];
  for (const activity of activities) {
    const criteria = activity.rubricVersionId ? await getActiveCriteria(activity.rubricVersionId) : [];
    const documentCriteria = criteria.filter(c => c.scope !== "INDIVIDUAL").map(c => critDto(c));
    const evaluation = await prisma.evaluation.findUnique({ where: { activityId: activity.id } });
    const results = evaluation
      ? await prisma.evaluationResult.findMany({ where: { evaluationId: evaluation.id }, include: { criterionScores: true } })
      : [];
    const resultByStudent = new Map(results.map(r => [r.studentId, r]));
    const submissions = await prisma.submission.findMany({
      where: { activityId: activity.id },
      include: { versions: { select: { _count: { select: { files: true } } } } }
    });
    const subDto = (s) => s ? { id: s.id, title: s.title, status: s.status, submittedAt: s.submittedAt, files: s.versions.reduce((n, v) => n + v._count.files, 0) } : null;
    const scoreOf = (studentId) => {
      const r = resultByStudent.get(studentId);
      const docIds = new Set(documentCriteria.map(c => c.id));
      const evaluated = !!r && r.criterionScores.some(cs => docIds.has(cs.criterionId));
      return { evaluated, groupScore: calcFor(criteria, r?.criterionScores).groupScore, published: r?.status === "PUBLISHED" || r?.status === "REVISED" };
    };

    const enrollments = await prisma.enrollment.findMany({
      where: { classId: activity.classId, status: "ACTIVE" },
      include: { student: { select: { id: true, user: { select: { name: true } } } } },
      orderBy: { student: { user: { name: "asc" } } }
    });
    let entries = [], ungrouped = [];
    if (activity.mode === "GROUP") {
      const groups = await prisma.studentGroup.findMany({
        where: { classId: activity.classId }, orderBy: { name: "asc" },
        include: { members: { include: { student: { select: { id: true, user: { select: { name: true } } } } } } }
      });
      const grouped = new Set(groups.flatMap(g => g.members.map(m => m.studentId)));
      ungrouped = enrollments.filter(e => !grouped.has(e.student.id)).map(e => e.student.user.name);
      entries = groups.map(g => {
        const members = g.members.map(m => ({ id: m.student.id, name: m.student.user.name })).sort((a, b) => a.name.localeCompare(b.name));
        const sc = members.length ? scoreOf(members[0].id) : { evaluated: false, groupScore: 0, published: false };
        return { kind: "GROUP", groupId: g.id, name: g.name, members, submission: subDto(submissions.find(s => s.groupId === g.id)), ...sc };
      });
    } else {
      entries = enrollments.map(e => ({
        kind: "STUDENT", studentId: e.student.id, name: e.student.user.name, members: [{ id: e.student.id, name: e.student.user.name }],
        submission: subDto(submissions.find(s => s.studentId === e.student.id)), ...scoreOf(e.student.id)
      }));
    }
    out.push({
      activity: { id: activity.id, title: activity.title, mode: activity.mode, status: activity.status, dueDate: activity.dueDate },
      documentCriteria,
      documentMax: documentCriteria.reduce((s, c) => s + c.maxPoints * c.weight, 0),
      entries, ungrouped
    });
  }
  return out;
}

// Abre a avaliação dos documentos de um GRUPO (ou aluno) — mesmo que não tenha enviado pelo sistema
// (ex.: entregou impresso). Nesse caso cria um registro de entrega "sem arquivos" para guardar a nota;
// só abrir não bloqueia o aluno — o envio é travado quando o professor SALVA as notas.
export async function openDocumentsFor(teacher, activityId, { groupId, studentId }) {
  const activity = await assertActivityAllowed(teacher, activityId, "documents");
  let submission;
  if (activity.mode === "GROUP") {
    const group = groupId ? await prisma.studentGroup.findUnique({ where: { id: groupId }, include: { _count: { select: { members: true } } } }) : null;
    if (!group) throw new HttpError(404, "Grupo não encontrado.");
    if (group._count.members === 0) throw new HttpError(409, "Este grupo não tem integrantes.");
    submission = await prisma.submission.findFirst({ where: { activityId, groupId } });
    if (!submission) {
      submission = await prisma.submission.create({ data: {
        activityId, groupId, title: `Documentos — ${group.name}`, status: "NOT_STARTED",
        history: { create: { status: "NOT_STARTED", note: "Avaliação aberta pelo professor antes do envio pelo sistema.", changedById: teacher.userId } } } });
    }
  } else {
    if (!studentId) throw new HttpError(400, "Informe o aluno.");
    submission = await prisma.submission.findFirst({ where: { activityId, studentId } });
    if (!submission) {
      submission = await prisma.submission.create({ data: {
        activityId, studentId, title: "Documentos", status: "NOT_STARTED",
        history: { create: { status: "NOT_STARTED", note: "Avaliação aberta pelo professor antes do envio pelo sistema.", changedById: teacher.userId } } } });
    }
  }
  return openDocumentEvaluation(teacher, submission.id);
}
