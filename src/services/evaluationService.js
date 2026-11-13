
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";
import { allowedActivityIds } from "./teacherService.js";
import {
  calculateResult, validateCriterionScore, validateRequiredCriteria
} from "../utils/rubricCalculation.js";

// Garante que a atividade pertence ao professor (suas turmas).
async function assertActivityAllowed(teacher, activityId) {
  const ids = await allowedActivityIds(teacher);
  if (!ids.includes(activityId)) throw new HttpError(404, "Atividade fora das suas turmas.");
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) throw new HttpError(404, "Atividade não encontrada.");
  return activity;
}

// Deriva um período letivo (SchoolTerm) para a avaliação, a partir da turma da atividade.
async function deriveSchoolTermId(activity) {
  const schoolClass = await prisma.schoolClass.findUnique({
    where: { id: activity.classId },
    select: { schoolYearId: true }
  });
  const term = await prisma.schoolTerm.findFirst({
    where: { schoolYearId: schoolClass.schoolYearId },
    orderBy: { number: "desc" }
  });
  if (!term) throw new HttpError(409, "A turma não possui período letivo (SchoolTerm) configurado pelo ADMIN.");
  return term.id;
}

// Cria (uma vez) ou recupera a Evaluation vinculada à atividade.
async function getOrCreateEvaluation(teacher, activity) {
  if (!activity.rubricVersionId) {
    throw new HttpError(409, "A atividade não possui rubrica vinculada. Configure no ADMIN.");
  }
  if (!activity.subjectId) {
    throw new HttpError(409, "A atividade não possui disciplina vinculada. Configure no ADMIN.");
  }

  let evaluation = await prisma.evaluation.findUnique({ where: { activityId: activity.id } });
  if (evaluation) return evaluation;

  const schoolTermId = await deriveSchoolTermId(activity);
  evaluation = await prisma.evaluation.create({
    data: {
      title: `Avaliação — ${activity.title}`,
      mode: activity.mode,
      status: "DRAFT",
      createdById: teacher.userId,
      classId: activity.classId,
      subjectId: activity.subjectId,
      schoolTermId,
      activityId: activity.id,
      rubricVersionId: activity.rubricVersionId
    }
  });
  return evaluation;
}

// Critérios ATIVOS da rubrica vinculada (configurados pelo ADMIN).
async function getActiveCriteria(rubricVersionId) {
  return prisma.criterion.findMany({
    where: { rubricVersionId, active: true },
    orderBy: { position: "asc" }
  });
}

// Lista estudantes avaliáveis de uma atividade (matriculados na turma) + status.
export async function listEvaluables(teacher, activityId) {
  const activity = await assertActivityAllowed(teacher, activityId);
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: activity.classId, status: "ACTIVE" },
    include: { student: { select: { id: true, registrationNumber: true, user: { select: { name: true } } } } }
  });

  const evaluation = await prisma.evaluation.findUnique({ where: { activityId } });
  const results = evaluation
    ? await prisma.evaluationResult.findMany({ where: { evaluationId: evaluation.id }, select: { studentId: true, status: true, finalizedAt: true, score: true } })
    : [];
  const byStudent = new Map(results.map(r => [r.studentId, r]));

  const submissions = await prisma.submission.findMany({
    where: { activityId }, select: { id: true, studentId: true, status: true }
  });
  const subByStudent = new Map(submissions.map(s => [s.studentId, s]));

  return enrollments.map(e => {
    const r = byStudent.get(e.student.id);
    return {
      student: { id: e.student.id, name: e.student.user.name, registrationNumber: e.student.registrationNumber },
      submission: subByStudent.get(e.student.id) || null,
      evaluationState: deriveState(r),
      score: r?.score ?? null
    };
  });
}

function deriveState(result) {
  if (!result) return "NOT_STARTED";
  if (result.status === "PUBLISHED") return "PUBLISHED";
  if (result.finalizedAt) return "CONCLUDED";
  return "IN_PROGRESS";
}

// Abre (ou retoma) a avaliação de um estudante: carrega rubrica + critérios + notas já lançadas.
export async function openEvaluation(teacher, activityId, studentId) {
  const activity = await assertActivityAllowed(teacher, activityId);
  const evaluation = await getOrCreateEvaluation(teacher, activity);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { name: true } }, enrollments: { where: { classId: activity.classId }, select: { id: true } } }
  });
  if (!student || student.enrollments.length === 0) {
    throw new HttpError(404, "Estudante não pertence à turma desta atividade.");
  }

  const submission = await prisma.submission.findFirst({
    where: { activityId, studentId },
    include: {
      versions: { orderBy: { versionNumber: "asc" }, include: { files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } } } }
    }
  });

  const criteria = await getActiveCriteria(activity.rubricVersionId);
  const rubricVersion = await prisma.rubricVersion.findUnique({ where: { id: activity.rubricVersionId }, select: { totalPoints: true, versionNumber: true } });

  // Cria/recupera o resultado do estudante (rascunho).
  let result = await prisma.evaluationResult.findUnique({
    where: { evaluationId_studentId: { evaluationId: evaluation.id, studentId } },
    include: { criterionScores: true, feedbacks: { where: { type: "FINAL" }, orderBy: { createdAt: "desc" }, take: 1 } }
  });
  if (!result) {
    result = await prisma.evaluationResult.create({
      data: {
        evaluationId: evaluation.id, studentId, submissionId: submission?.id || null,
        maxScore: rubricVersion.totalPoints, status: "DRAFT"
      },
      include: { criterionScores: true, feedbacks: true }
    });
  }

  if (result.status === "PUBLISHED") {
    // Não bloqueia leitura, mas sinaliza que alterações exigem fluxo de revisão (Etapa 8).
  }

  // Marca a entrega como "em avaliação" e reflete o novo status na resposta.
  if (submission && submission.status === "SUBMITTED") {
    await prisma.submission.update({ where: { id: submission.id }, data: { status: "UNDER_REVIEW" } });
    submission.status = "UNDER_REVIEW";
  }

  const scoreByCriterion = new Map(result.criterionScores.map(cs => [cs.criterionId, cs]));

  return {
    evaluationId: evaluation.id,
    resultId: result.id,
    status: result.status,
    state: deriveState(result),
    finalizedAt: result.finalizedAt,
    totalPoints: rubricVersion.totalPoints,
    finalScore: result.score,
    generalFeedback: result.feedbacks?.[0]?.content || null,
    student: { id: student.id, name: student.user.name },
    activity: { id: activity.id, title: activity.title, mode: activity.mode },
    submission: submission ? {
      id: submission.id, title: submission.title, status: submission.status,
      files: submission.versions.flatMap(v => v.files.map(f => ({ ...f, version: v.versionNumber })))
    } : null,
    criteria: criteria.map(c => {
      const cs = scoreByCriterion.get(c.id);
      return {
        id: c.id, title: c.title, description: c.description, guidance: c.guidance,
        weight: Number(c.weight), maxPoints: Number(c.maxPoints), required: c.required,
        score: cs ? Number(cs.score) : null, comment: cs?.comment || null
      };
    })
  };
}

// Recupera um resultado garantindo que pertence às turmas do professor.
async function getOwnedResult(teacher, resultId) {
  const ids = await allowedActivityIds(teacher);
  const result = await prisma.evaluationResult.findUnique({
    where: { id: resultId },
    include: { evaluation: { select: { id: true, activityId: true, rubricVersionId: true } } }
  });
  if (!result || !result.evaluation.activityId || !ids.includes(result.evaluation.activityId)) {
    throw new HttpError(404, "Avaliação não encontrada.");
  }
  return result;
}

// Salva pontuações/comentários (rascunho) e, opcionalmente, finaliza (conclui).
export async function saveScores(teacher, resultId, { scores, generalFeedback, finalize }) {
  const result = await getOwnedResult(teacher, resultId);

  if (result.status === "PUBLISHED") {
    throw new HttpError(409, "Resultado já publicado. Use o fluxo de revisão para alterar.");
  }

  const criteria = await getActiveCriteria(result.evaluation.rubricVersionId);
  const criteriaById = new Map(criteria.map(c => [c.id, c]));
  const rubricVersion = await prisma.rubricVersion.findUnique({
    where: { id: result.evaluation.rubricVersionId }, select: { totalPoints: true }
  });

  const scoreMap = {};
  for (const item of (scores || [])) {
    const criterion = criteriaById.get(item.criterionId);
    if (!criterion) throw new HttpError(400, `Critério inválido: ${item.criterionId}.`);
    if (item.score !== null && item.score !== undefined && item.score !== "") {
      const check = validateCriterionScore(item.score, criterion.maxPoints);
      if (!check.valid) throw new HttpError(400, `${criterion.title}: ${check.message}`);
      scoreMap[item.criterionId] = Number(item.score);
    }
  }

  // Validação de obrigatórios somente ao finalizar.
  if (finalize) {
    const { valid, missing } = validateRequiredCriteria(
      criteria.map(c => ({ id: c.id, required: c.required, title: c.title })),
      scoreMap
    );
    if (!valid) throw new HttpError(400, `Critérios obrigatórios sem pontuação: ${missing.join(", ")}.`);
  }

  const calc = calculateResult({
    criteria: criteria.map(c => ({ id: c.id, weight: c.weight, maxPoints: c.maxPoints })),
    scores: scoreMap,
    totalPoints: rubricVersion.totalPoints
  });

  await prisma.$transaction(async (tx) => {
    // Upsert das pontuações por critério.
    for (const item of (scores || [])) {
      if (item.score === null || item.score === undefined || item.score === "") {
        // Remove pontuação se enviada vazia.
        await tx.criterionScore.deleteMany({ where: { resultId, criterionId: item.criterionId } });
        continue;
      }
      await tx.criterionScore.upsert({
        where: { resultId_criterionId: { resultId, criterionId: item.criterionId } },
        update: { score: Number(item.score), comment: item.comment ?? null },
        create: { resultId, criterionId: item.criterionId, score: Number(item.score), comment: item.comment ?? null }
      });
    }

    // Feedback geral (type FINAL) — mantém um único registro.
    if (generalFeedback !== undefined) {
      await tx.feedback.deleteMany({ where: { resultId, type: "FINAL" } });
      if (generalFeedback) {
        await tx.feedback.create({ data: { resultId, authorId: teacher.userId, type: "FINAL", content: generalFeedback } });
      }
    }

    await tx.evaluationResult.update({
      where: { id: resultId },
      data: {
        score: calc.finalScore,
        maxScore: calc.maxScore,
        finalizedAt: finalize ? new Date() : (result.finalizedAt && !finalize ? result.finalizedAt : (finalize === false ? null : result.finalizedAt))
      }
    });
  });

  return getResultDetail(resultId);
}

// ================= ETAPA 8: PUBLICAÇÃO E REVISÃO =================

// Publica um resultado CONCLUÍDO: torna visível ao aluno e marca a entrega como avaliada.
export async function publishResult(teacher, resultId) {
  const result = await getOwnedResult(teacher, resultId);
  if (result.status === "PUBLISHED" || result.status === "REVISED") {
    throw new HttpError(409, "Resultado já está publicado.");
  }
  if (!result.finalizedAt) {
    throw new HttpError(409, "Conclua a avaliação antes de publicar.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.evaluationResult.update({
      where: { id: resultId },
      data: { status: "PUBLISHED", publishedAt: new Date() }
    });
    if (r.submissionId) {
      await tx.submission.update({
        where: { id: r.submissionId },
        data: {
          status: "EVALUATED",
          history: { create: { status: "EVALUATED", note: "Resultado publicado." } }
        }
      });
    }
    return r;
  });
  return getResultDetail(updated.id);
}

// Publica TODOS os resultados concluídos (e ainda não publicados) de uma atividade.
export async function publishAllForActivity(teacher, activityId) {
  await assertActivityAllowed(teacher, activityId);
  const evaluation = await prisma.evaluation.findUnique({ where: { activityId } });
  if (!evaluation) throw new HttpError(404, "Nenhuma avaliação iniciada para esta atividade.");

  const pending = await prisma.evaluationResult.findMany({
    where: { evaluationId: evaluation.id, status: "DRAFT", finalizedAt: { not: null } },
    select: { id: true }
  });

  let published = 0;
  for (const r of pending) {
    await publishResult(teacher, r.id);
    published++;
  }
  return { published, total: pending.length };
}

// Revisão CONTROLADA de resultado já publicado: exige justificativa e registra histórico (GradeRevision).
export async function reviseResult(teacher, resultId, { scores, generalFeedback, justification }) {
  const result = await getOwnedResult(teacher, resultId);
  if (result.status !== "PUBLISHED" && result.status !== "REVISED") {
    throw new HttpError(409, "Só é possível revisar resultados já publicados.");
  }
  if (!justification || !justification.trim()) {
    throw new HttpError(400, "A revisão exige uma justificativa.");
  }

  const criteria = await getActiveCriteria(result.evaluation.rubricVersionId);
  const criteriaById = new Map(criteria.map(c => [c.id, c]));
  const rubricVersion = await prisma.rubricVersion.findUnique({
    where: { id: result.evaluation.rubricVersionId }, select: { totalPoints: true }
  });

  // Monta o mapa de notas final (mescla as existentes com as alteradas).
  const existing = await prisma.criterionScore.findMany({ where: { resultId } });
  const scoreMap = {};
  for (const cs of existing) scoreMap[cs.criterionId] = Number(cs.score);
  for (const item of (scores || [])) {
    const criterion = criteriaById.get(item.criterionId);
    if (!criterion) throw new HttpError(400, `Critério inválido: ${item.criterionId}.`);
    if (item.score === null || item.score === undefined || item.score === "") { delete scoreMap[item.criterionId]; continue; }
    const check = validateCriterionScore(item.score, criterion.maxPoints);
    if (!check.valid) throw new HttpError(400, `${criterion.title}: ${check.message}`);
    scoreMap[item.criterionId] = Number(item.score);
  }

  const calc = calculateResult({
    criteria: criteria.map(c => ({ id: c.id, weight: c.weight, maxPoints: c.maxPoints })),
    scores: scoreMap, totalPoints: rubricVersion.totalPoints
  });

  await prisma.$transaction(async (tx) => {
    for (const item of (scores || [])) {
      if (item.score === null || item.score === undefined || item.score === "") {
        await tx.criterionScore.deleteMany({ where: { resultId, criterionId: item.criterionId } });
        continue;
      }
      await tx.criterionScore.upsert({
        where: { resultId_criterionId: { resultId, criterionId: item.criterionId } },
        update: { score: Number(item.score), comment: item.comment ?? undefined },
        create: { resultId, criterionId: item.criterionId, score: Number(item.score), comment: item.comment ?? null }
      });
    }
    if (generalFeedback !== undefined) {
      await tx.feedback.deleteMany({ where: { resultId, type: "FINAL" } });
      if (generalFeedback) await tx.feedback.create({ data: { resultId, authorId: teacher.userId, type: "FINAL", content: generalFeedback } });
    }
    // Registra a revisão (histórico auditável).
    await tx.gradeRevision.create({
      data: {
        resultId, authorId: teacher.userId,
        previousScore: result.score, newScore: calc.finalScore, justification: justification.trim()
      }
    });
    await tx.evaluationResult.update({
      where: { id: resultId },
      data: { score: calc.finalScore, maxScore: calc.maxScore, status: "REVISED" }
    });
  });

  return getResultDetail(resultId);
}

export async function getResultDetail(resultId) {
  const result = await prisma.evaluationResult.findUnique({
    where: { id: resultId },
    include: {
      criterionScores: true,
      feedbacks: { where: { type: "FINAL" }, take: 1, orderBy: { createdAt: "desc" } },
      student: { select: { id: true, user: { select: { name: true } } } }
    }
  });
  return {
    resultId: result.id,
    status: result.status,
    state: deriveState(result),
    finalizedAt: result.finalizedAt,
    finalScore: result.score !== null ? Number(result.score) : null,
    maxScore: Number(result.maxScore),
    generalFeedback: result.feedbacks?.[0]?.content || null,
    student: { id: result.student?.id, name: result.student?.user?.name },
    criterionScores: result.criterionScores.map(cs => ({ criterionId: cs.criterionId, score: Number(cs.score), comment: cs.comment }))
  };
}
