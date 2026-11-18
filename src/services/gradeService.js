// =====================================================================
// COMPOSIÇÃO DA NOTA FINAL DO ALUNO
//   nota do grupo (critérios dos DOCUMENTOS, avaliados pelo professor dos documentos)
// + nota da apresentação (critérios da APRESENTAÇÃO, avaliação individual pela banca)
// Cálculos sempre pela fonte única: utils/rubricCalculation.js
// =====================================================================
import prisma from "../config/database.js";
import { calculateResult, calculatePresentation, averagePresentation } from "../utils/rubricCalculation.js";

const num = v => (v === null || v === undefined ? null : Number(v));

// Critérios de apresentação ativos (na ordem definida pelo ADMIN).
export function activePresentationCriteria(db = prisma) {
  return db.presentationCriterion.findMany({ where: { active: true, archived: false }, orderBy: { position: "asc" } });
}

// Recalcula a nota de UMA avaliação de apresentação a partir das notas gravadas.
// Regra de histórico: notas já dadas em critérios que depois foram desativados/excluídos
// continuam valendo nesta avaliação; "completa" = todos os critérios ATIVOS têm nota.
export async function scoreEvaluation(db, evaluationId, criteria) {
  const active = criteria || await activePresentationCriteria(db);
  const rows = await db.presentationScore.findMany({ where: { evaluationId }, include: { criterion: true } });
  const scores = Object.fromEntries(rows.map(r => [r.criterionId, Number(r.score)]));
  const activeIds = new Set(active.map(c => c.id));
  const legacy = rows.filter(r => !activeIds.has(r.criterionId)).map(r => r.criterion);
  const total = calculatePresentation({ criteria: [...active, ...legacy], scores });
  const complete = calculatePresentation({ criteria: active, scores }).complete;
  await db.presentationEvaluation.update({ where: { id: evaluationId }, data: { score: total.score, maxScore: total.max, complete } });
  return { ...total, complete };
}

// Situação da apresentação de um aluno numa atividade (todas as avaliações da banca).
export async function presentationOf(db, activityId, studentId) {
  const criteria = await activePresentationCriteria(db);
  const max = calculatePresentation({ criteria, scores: {} }).max;
  const evaluations = await db.presentationEvaluation.findMany({
    where: { activityId, studentId },
    include: { teacher: { select: { id: true, user: { select: { name: true } } } }, scores: true },
    orderBy: { createdAt: "asc" }
  });
  const avg = averagePresentation(evaluations.map(e => ({ score: num(e.score) || 0, complete: e.complete })));
  // Máximo: o das avaliações consideradas (preserva critérios antigos já pontuados); sem avaliações, o dos ativos.
  const base = evaluations.some(e => e.complete) ? evaluations.filter(e => e.complete) : evaluations;
  const evalMax = base.length ? base.reduce((s, e) => s + (num(e.maxScore) ?? max), 0) / base.length : max;
  return { ...avg, max: Number(evalMax.toFixed(2)), criteria, evaluations };
}

// Nota do grupo (documentos) a partir das notas gravadas no resultado.
async function groupPart(db, result) {
  const criteria = await db.criterion.findMany({
    where: { rubricVersionId: result.evaluation.rubricVersionId, active: true, scope: { not: "INDIVIDUAL" } }
  });
  const scores = Object.fromEntries(result.criterionScores.map(cs => [cs.criterionId, Number(cs.score)]));
  const calc = calculateResult({ criteria: criteria.map(c => ({ id: c.id, weight: c.weight, maxPoints: c.maxPoints, scope: "GROUP" })), scores });
  const complete = criteria.filter(c => c.required).every(c => scores[c.id] !== undefined);
  return { score: calc.groupScore, max: calc.groupMax, complete: criteria.length > 0 && complete, evaluated: criteria.some(c => scores[c.id] !== undefined) };
}

// Recalcula e grava a nota final de um resultado (grupo + apresentação).
// Resultado PUBLICADO não muda aqui: só pelo fluxo de revisão (com justificativa).
// Fica "pronto para publicar" quando documentos E apresentação estão completos.
export async function refreshResult(db, resultId, { force = false } = {}) {
  const result = await db.evaluationResult.findUnique({
    where: { id: resultId },
    include: { evaluation: { select: { activityId: true, rubricVersionId: true } }, criterionScores: true }
  });
  if (!result) return null;
  const published = result.status === "PUBLISHED" || result.status === "REVISED";
  if (published && !force) return result;

  const group = await groupPart(db, result);
  const pres = result.studentId && result.evaluation.activityId
    ? await presentationOf(db, result.evaluation.activityId, result.studentId)
    : { score: 0, max: 0, complete: false };
  const finalScore = Number((group.score + pres.score).toFixed(2));
  const data = {
    groupScore: group.score, groupMax: group.max,
    presentationScore: pres.score, presentationMax: pres.max,
    score: finalScore, maxScore: Number((group.max + pres.max).toFixed(2))
  };
  if (!published) {
    const ready = group.complete && pres.complete;
    data.finalizedAt = ready ? (result.finalizedAt || new Date()) : null;
  }
  return db.evaluationResult.update({ where: { id: resultId }, data });
}

// Composição já gravada (para telas): usa os valores congelados; calcula se ainda não houver.
export async function breakdown(db, result) {
  if (result.groupScore === null || result.groupScore === undefined) {
    const published = result.status === "PUBLISHED" || result.status === "REVISED";
    if (published) {
      // Nota publicada antes desta versão: mantém o total publicado e deriva as partes.
      const full = await db.evaluationResult.findUnique({ where: { id: result.id }, include: { evaluation: { select: { rubricVersionId: true } }, criterionScores: true } });
      const g = await groupPart(db, full);
      const total = num(full.score) ?? 0, maxTotal = num(full.maxScore) ?? 0;
      return { groupScore: g.score, groupMax: g.max, presentationScore: Number(Math.max(0, total - g.score).toFixed(2)),
        presentationMax: Number(Math.max(0, maxTotal - g.max).toFixed(2)), finalScore: total, maxScore: maxTotal };
    }
    const fresh = await refreshResult(db, result.id);
    if (fresh) result = { ...result, ...fresh };
  }
  return {
    groupScore: num(result.groupScore) ?? 0, groupMax: num(result.groupMax) ?? 0,
    presentationScore: num(result.presentationScore) ?? 0, presentationMax: num(result.presentationMax) ?? 0,
    finalScore: num(result.score) ?? 0, maxScore: num(result.maxScore) ?? 0
  };
}
