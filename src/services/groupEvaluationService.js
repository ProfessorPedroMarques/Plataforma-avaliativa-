
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";
import {
  assertActivityAllowed, getOrCreateEvaluation, getActiveCriteria
} from "./evaluationService.js";
import {
  calculateResult, validateCriterionScore, validateRequiredCriteria
} from "../utils/rubricCalculation.js";

function deriveState(result) {
  if (!result) return "NOT_STARTED";
  if (result.status === "PUBLISHED" || result.status === "REVISED") return "PUBLISHED";
  if (result.finalizedAt) return "CONCLUDED";
  if (result.criterionScores && result.criterionScores.length) return "IN_PROGRESS";
  return "NOT_STARTED";
}

// Recalcula a nota de um resultado a partir das pontuações salvas (critérios do grupo + individuais).
async function recompute(tx, resultId, allCriteria, totalPoints) {
  const scores = await tx.criterionScore.findMany({ where: { resultId } });
  const map = {};
  for (const cs of scores) map[cs.criterionId] = Number(cs.score);
  const calc = calculateResult({
    criteria: allCriteria.map(c => ({ id: c.id, weight: c.weight, maxPoints: c.maxPoints })),
    scores: map, totalPoints
  });
  await tx.evaluationResult.update({ where: { id: resultId }, data: { score: calc.finalScore, maxScore: calc.maxScore } });
  return calc.finalScore;
}

// Lista os grupos de uma atividade (em modo equipe).
export async function listGroupsForActivity(teacher, activityId) {
  const activity = await assertActivityAllowed(teacher, activityId);
  const groups = await prisma.studentGroup.findMany({
    where: { classId: activity.classId },
    orderBy: { name: "asc" },
    include: { members: { include: { student: { select: { id: true, user: { select: { name: true } } } } } } }
  });
  return groups.map(g => ({
    id: g.id, name: g.name,
    members: g.members.map(m => ({ studentId: m.student.id, name: m.student.user.name }))
  }));
}

// Abre a avaliação de um grupo: cria resultados por membro e devolve critérios coletivos + individuais.
export async function openGroupEvaluation(teacher, activityId, groupId) {
  const activity = await assertActivityAllowed(teacher, activityId);
  if (activity.mode !== "GROUP") throw new HttpError(409, "Esta atividade não é em equipe.");
  const evaluation = await getOrCreateEvaluation(teacher, activity);

  const group = await prisma.studentGroup.findUnique({
    where: { id: groupId },
    include: { members: { include: { student: { select: { id: true, user: { select: { name: true } } } } } } }
  });
  if (!group || group.classId !== activity.classId) throw new HttpError(404, "Grupo não encontrado nesta turma.");
  if (group.members.length === 0) throw new HttpError(409, "O grupo não possui integrantes.");

  const criteria = await getActiveCriteria(activity.rubricVersionId);
  const groupCriteria = criteria.filter(c => c.scope === "GROUP");
  const individualCriteria = criteria.filter(c => c.scope === "INDIVIDUAL");
  const rubricVersion = await prisma.rubricVersion.findUnique({ where: { id: activity.rubricVersionId }, select: { totalPoints: true } });

  // Garante um EvaluationResult por integrante.
  const members = [];
  for (const m of group.members) {
    let result = await prisma.evaluationResult.findUnique({
      where: { evaluationId_studentId: { evaluationId: evaluation.id, studentId: m.student.id } },
      include: { criterionScores: true, feedbacks: { where: { type: "FINAL" }, take: 1, orderBy: { createdAt: "desc" } } }
    });
    if (!result) {
      result = await prisma.evaluationResult.create({
        data: { evaluationId: evaluation.id, studentId: m.student.id, groupId, maxScore: rubricVersion.totalPoints, status: "DRAFT" },
        include: { criterionScores: true, feedbacks: true }
      });
    }
    const byCrit = new Map(result.criterionScores.map(cs => [cs.criterionId, cs]));
    members.push({
      studentId: m.student.id, name: m.student.user.name,
      resultId: result.id, state: deriveState(result),
      finalScore: result.score !== null ? Number(result.score) : null,
      generalFeedback: result.feedbacks?.[0]?.content || null,
      individualScores: individualCriteria.map(c => {
        const cs = byCrit.get(c.id);
        return { criterionId: c.id, score: cs ? Number(cs.score) : null, comment: cs?.comment || null };
      })
    });
  }

  // Pontuações coletivas: lidas do primeiro integrante (são replicadas a todos).
  const firstScores = new Map((members[0] ? await prisma.criterionScore.findMany({ where: { resultId: members[0].resultId } }) : []).map(cs => [cs.criterionId, cs]));

  return {
    evaluationId: evaluation.id,
    activity: { id: activity.id, title: activity.title, mode: activity.mode },
    group: { id: group.id, name: group.name },
    totalPoints: Number(rubricVersion.totalPoints),
    groupCriteria: groupCriteria.map(c => {
      const cs = firstScores.get(c.id);
      return { id: c.id, title: c.title, description: c.description, guidance: c.guidance, weight: Number(c.weight), maxPoints: Number(c.maxPoints), required: c.required, score: cs ? Number(cs.score) : null, comment: cs?.comment || null };
    }),
    individualCriteria: individualCriteria.map(c => ({ id: c.id, title: c.title, description: c.description, guidance: c.guidance, weight: Number(c.weight), maxPoints: Number(c.maxPoints), required: c.required })),
    members
  };
}

// Salva as pontuações COLETIVAS (replicadas a todos os integrantes do grupo).
export async function saveGroupScores(teacher, activityId, groupId, scores) {
  const activity = await assertActivityAllowed(teacher, activityId);
  const evaluation = await prisma.evaluation.findUnique({ where: { activityId } });
  if (!evaluation) throw new HttpError(404, "Avaliação não iniciada.");

  const criteria = await getActiveCriteria(activity.rubricVersionId);
  const groupCriteriaIds = new Set(criteria.filter(c => c.scope === "GROUP").map(c => c.id));
  const criteriaById = new Map(criteria.map(c => [c.id, c]));
  const rubricVersion = await prisma.rubricVersion.findUnique({ where: { id: activity.rubricVersionId }, select: { totalPoints: true } });

  // Valida
  for (const item of (scores || [])) {
    if (!groupCriteriaIds.has(item.criterionId)) throw new HttpError(400, "Critério não é coletivo (do grupo).");
    if (item.score !== null && item.score !== undefined && item.score !== "") {
      const check = validateCriterionScore(item.score, criteriaById.get(item.criterionId).maxPoints);
      if (!check.valid) throw new HttpError(400, `${criteriaById.get(item.criterionId).title}: ${check.message}`);
    }
  }

  const results = await prisma.evaluationResult.findMany({ where: { evaluationId: evaluation.id, groupId, status: { in: ["DRAFT"] } } });
  if (results.length === 0) throw new HttpError(409, "Nenhum integrante em rascunho para pontuar (verifique se já foi publicado).");

  await prisma.$transaction(async (tx) => {
    for (const r of results) {
      for (const item of (scores || [])) {
        if (item.score === null || item.score === undefined || item.score === "") {
          await tx.criterionScore.deleteMany({ where: { resultId: r.id, criterionId: item.criterionId } });
          continue;
        }
        await tx.criterionScore.upsert({
          where: { resultId_criterionId: { resultId: r.id, criterionId: item.criterionId } },
          update: { score: Number(item.score), comment: item.comment ?? null },
          create: { resultId: r.id, criterionId: item.criterionId, score: Number(item.score), comment: item.comment ?? null }
        });
      }
      await recompute(tx, r.id, criteria, rubricVersion.totalPoints);
    }
  });

  return openGroupEvaluation(teacher, activityId, groupId);
}

// Salva pontuações INDIVIDUAIS de um estudante do grupo (e opcionalmente conclui).
export async function saveIndividualScores(teacher, resultId, { scores, generalFeedback, finalize }) {
  const result = await prisma.evaluationResult.findUnique({
    where: { id: resultId },
    include: { evaluation: { select: { activityId: true, rubricVersionId: true } } }
  });
  if (!result) throw new HttpError(404, "Resultado não encontrado.");
  await assertActivityAllowed(teacher, result.evaluation.activityId);
  if (result.status === "PUBLISHED" || result.status === "REVISED") throw new HttpError(409, "Resultado já publicado. Use o fluxo de revisão.");

  const criteria = await getActiveCriteria(result.evaluation.rubricVersionId);
  const individualIds = new Set(criteria.filter(c => c.scope === "INDIVIDUAL").map(c => c.id));
  const criteriaById = new Map(criteria.map(c => [c.id, c]));
  const rubricVersion = await prisma.rubricVersion.findUnique({ where: { id: result.evaluation.rubricVersionId }, select: { totalPoints: true } });

  for (const item of (scores || [])) {
    if (!individualIds.has(item.criterionId)) throw new HttpError(400, "Critério não é individual.");
    if (item.score !== null && item.score !== undefined && item.score !== "") {
      const check = validateCriterionScore(item.score, criteriaById.get(item.criterionId).maxPoints);
      if (!check.valid) throw new HttpError(400, `${criteriaById.get(item.criterionId).title}: ${check.message}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of (scores || [])) {
      if (item.score === null || item.score === undefined || item.score === "") {
        await tx.criterionScore.deleteMany({ where: { resultId, criterionId: item.criterionId } });
        continue;
      }
      await tx.criterionScore.upsert({
        where: { resultId_criterionId: { resultId, criterionId: item.criterionId } },
        update: { score: Number(item.score), comment: item.comment ?? null },
        create: { resultId, criterionId: item.criterionId, score: Number(item.score), comment: item.comment ?? null }
      });
    }
    if (generalFeedback !== undefined) {
      await tx.feedback.deleteMany({ where: { resultId, type: "FINAL" } });
      if (generalFeedback) await tx.feedback.create({ data: { resultId, authorId: teacher.userId, type: "FINAL", content: generalFeedback } });
    }

    if (finalize) {
      // Exige todos os critérios obrigatórios (coletivos + individuais) pontuados para este aluno.
      const saved = await tx.criterionScore.findMany({ where: { resultId } });
      const map = {}; for (const cs of saved) map[cs.criterionId] = Number(cs.score);
      const { valid, missing } = validateRequiredCriteria(
        criteria.map(c => ({ id: c.id, required: c.required, title: c.title })), map
      );
      if (!valid) throw new HttpError(400, `Critérios obrigatórios sem pontuação: ${missing.join(", ")}.`);
    }

    await recompute(tx, resultId, criteria, rubricVersion.totalPoints);
    await tx.evaluationResult.update({
      where: { id: resultId },
      data: { finalizedAt: finalize ? new Date() : (finalize === false ? null : result.finalizedAt) }
    });
  });

  const updated = await prisma.evaluationResult.findUnique({ where: { id: resultId }, select: { score: true, finalizedAt: true, status: true } });
  return { resultId, finalScore: updated.score !== null ? Number(updated.score) : null, state: deriveState(updated) };
}
