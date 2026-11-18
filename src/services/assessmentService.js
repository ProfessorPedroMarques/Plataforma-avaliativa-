
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
import { deriveState, recompute, saveIndividualScores } from "./groupEvaluationService.js";
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

// Conclusão automática: o resultado fica "concluído" (pronto para publicar) quando
// todos os critérios obrigatórios (documentos + apresentação) têm nota.
async function autoConclude(tx, resultId, criteria) {
  const r = await tx.evaluationResult.findUnique({ where: { id: resultId }, include: { criterionScores: true } });
  if (!r || r.status !== "DRAFT") return;
  const scored = new Set(r.criterionScores.map(cs => cs.criterionId));
  const complete = criteria.filter(c => c.required).every(c => scored.has(c.id));
  if (complete && !r.finalizedAt) await tx.evaluationResult.update({ where: { id: resultId }, data: { finalizedAt: new Date() } });
  if (!complete && r.finalizedAt) await tx.evaluationResult.update({ where: { id: resultId }, data: { finalizedAt: null } });
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
      await recompute(tx, r.id, criteria);
      await autoConclude(tx, r.id, criteria);
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

// Lista os alunos da atividade com o andamento das duas etapas.
export async function listPresentationStudents(teacher, activityId) {
  const activity = await assertActivityAllowed(teacher, activityId, "presentation");
  if (!activity.rubricVersionId) throw new HttpError(409, "A atividade não possui rubrica vinculada. Configure no ADMIN.");
  const criteria = await getActiveCriteria(activity.rubricVersionId);
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: activity.classId, status: "ACTIVE" },
    include: { student: { select: { id: true, user: { select: { name: true } } } } },
    orderBy: { student: { user: { name: "asc" } } }
  });
  const groups = await prisma.studentGroup.findMany({
    where: { classId: activity.classId },
    include: { members: { select: { studentId: true } } }
  });
  const evaluation = await prisma.evaluation.findUnique({ where: { activityId } });
  const results = evaluation
    ? await prisma.evaluationResult.findMany({ where: { evaluationId: evaluation.id }, include: { criterionScores: true, feedbacks: { where: { type: "FINAL" } } } })
    : [];
  const byStudent = new Map(results.map(r => [r.studentId, r]));
  const docIds = new Set(criteria.filter(c => c.scope !== "INDIVIDUAL").map(c => c.id));

  return enrollments.map(e => {
    const g = groups.find(gr => gr.members.some(m => m.studentId === e.student.id));
    const r = byStudent.get(e.student.id);
    const calc = calcFor(criteria, r?.criterionScores);
    return {
      student: { id: e.student.id, name: e.student.user.name },
      group: activity.mode === "GROUP" && g ? { id: g.id, name: g.name } : null,
      documentsEvaluated: !!r && r.criterionScores.some(cs => docIds.has(cs.criterionId)),
      groupScore: calc.groupScore, presentationScore: calc.individualScore, finalScore: calc.finalScore,
      resultId: r?.id || null,
      state: deriveState(r),
      status: r?.status || null,
      presentationScores: Object.fromEntries((r?.criterionScores || []).filter(cs => !docIds.has(cs.criterionId)).map(cs => [cs.criterionId, { score: Number(cs.score), comment: cs.comment }])),
      feedback: r?.feedbacks?.[0]?.content || null
    };
  });
}

// Planilha de avaliação da apresentação: critérios + alunos (por grupo) com as notas já lançadas.
export async function presentationSheet(teacher, activityId) {
  const activity = await assertActivityAllowed(teacher, activityId, "presentation");
  if (!activity.rubricVersionId) throw new HttpError(409, "A atividade não possui critérios. Peça ao administrador para cadastrá-los.");
  const criteria = await getActiveCriteria(activity.rubricVersionId);
  const presentationCriteria = criteria.filter(c => c.scope === "INDIVIDUAL").map(c => critDto(c));
  const documentMax = criteria.filter(c => c.scope !== "INDIVIDUAL").reduce((s, c) => s + Number(c.maxPoints) * Number(c.weight), 0);
  const students = await listPresentationStudents(teacher, activityId);
  return { activity: { id: activity.id, title: activity.title, mode: activity.mode }, presentationCriteria, documentMax, students };
}

// Lança/atualiza as notas da apresentação de UM aluno (sem etapas de "rascunho/concluir").
// A avaliação é concluída automaticamente quando todos os critérios obrigatórios têm nota.
export async function savePresentationScores(teacher, activityId, studentId, { scores, feedback }) {
  const ctx = await openPresentationEvaluation(teacher, activityId, studentId);
  if (ctx.status === "PUBLISHED" || ctx.status === "REVISED") {
    throw new HttpError(409, `A nota de ${ctx.student.name} já foi publicada. Use "Revisar" para alterá-la.`);
  }
  await saveIndividualScores(teacher, ctx.resultId, { scores, generalFeedback: feedback });
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { rubricVersionId: true } });
  const criteria = await getActiveCriteria(activity.rubricVersionId);
  await prisma.$transaction(async (tx) => { await autoConclude(tx, ctx.resultId, criteria); });
  const list = await listPresentationStudents(teacher, activityId);
  return list.find(s => s.student.id === studentId);
}

export async function openPresentationEvaluation(teacher, activityId, studentId) {
  const activity = await assertActivityAllowed(teacher, activityId, "presentation");
  if (!activity.rubricVersionId) throw new HttpError(409, "A atividade não possui rubrica vinculada. Configure no ADMIN.");
  const evaluation = await getOrCreateEvaluation(teacher, activity);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { name: true } }, enrollments: { where: { classId: activity.classId, status: "ACTIVE" } } }
  });
  if (!student || student.enrollments.length === 0) throw new HttpError(404, "Aluno não pertence à turma desta atividade.");

  // Grupo e entrega do aluno nesta atividade.
  const membership = await prisma.groupMember.findFirst({ where: { studentId, group: { classId: activity.classId } }, include: { group: true } });
  const group = activity.mode === "GROUP" ? membership?.group || null : null;
  const submission = await prisma.submission.findFirst({
    where: { activityId, ...(group ? { groupId: group.id } : { studentId }) },
    select: { id: true, title: true, status: true }
  });

  const result = await ensureResult(evaluation.id, studentId, { groupId: group?.id, submissionId: submission?.id });
  const criteria = await getActiveCriteria(activity.rubricVersionId);
  const byCrit = new Map(result.criterionScores.map(cs => [cs.criterionId, cs]));
  const calc = calcFor(criteria, result.criterionScores);
  const docIds = new Set(criteria.filter(c => c.scope !== "INDIVIDUAL").map(c => c.id));

  return {
    resultId: result.id,
    status: result.status,
    state: deriveState(result),
    student: { id: student.id, name: student.user.name },
    activity: { id: activity.id, title: activity.title, mode: activity.mode },
    group: group ? { id: group.id, name: group.name } : null,
    submission,
    documentsEvaluated: result.criterionScores.some(cs => docIds.has(cs.criterionId)),
    presentationCriteria: criteria.filter(c => c.scope === "INDIVIDUAL").map(c => critDto(c, byCrit.get(c.id))),
    generalFeedback: result.feedbacks.find(f => f.type === "FINAL")?.content || null,
    groupScore: calc.groupScore, groupMax: calc.groupMax,
    presentationScore: calc.individualScore, presentationMax: calc.individualMax,
    finalScore: calc.finalScore, maxScore: calc.maxScore
  };
}

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
