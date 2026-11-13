
// =====================================================================
// FONTE ÚNICA DE CÁLCULO DE NOTAS
// ---------------------------------------------------------------------
// Toda pontuação final da plataforma DEVE passar por esta função.
// Não crie fórmulas paralelas em controllers/services: importe daqui.
//
// Modelo: cada critério tem uma pontuação atribuída (score, 0..maxPoints)
// e um peso (weight). A nota final é a média ponderada normalizada para
// o totalPoints da versão da rubrica.
//
//   final = ( Σ(score_i * weight_i) / Σ(maxPoints_i * weight_i) ) * totalPoints
//
// Isso respeita simultaneamente pesos, pontuação máxima por critério e a
// pontuação total definida pelo ADMIN na versão da rubrica.
// =====================================================================

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  // Suporta Prisma.Decimal, string e number.
  const n = typeof value === "object" && typeof value.toNumber === "function"
    ? value.toNumber()
    : Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Valida uma pontuação individual contra o máximo do critério.
// Retorna { valid, message }.
export function validateCriterionScore(score, maxPoints) {
  const s = toNumber(score);
  const max = toNumber(maxPoints);

  if (!Number.isFinite(s) || s < 0) {
    return { valid: false, message: "Pontuação não pode ser negativa ou inválida." };
  }
  if (s > max) {
    return { valid: false, message: `Pontuação ${s} excede o máximo do critério (${max}).` };
  }
  return { valid: true };
}

// criteria: [{ id, weight, maxPoints, required }]
// scores:   Map/obj { [criterionId]: score }
// totalPoints: pontuação total da versão da rubrica
//
// Retorna { finalScore, maxScore, rawWeighted, maxWeighted, breakdown[] }
export function calculateResult({ criteria, scores, totalPoints }) {
  const total = toNumber(totalPoints) || 0;

  let rawWeighted = 0;
  let maxWeighted = 0;
  const breakdown = [];

  for (const c of criteria) {
    const weight = toNumber(c.weight);
    const max = toNumber(c.maxPoints);
    const rawScore = scores[c.id];
    const score = toNumber(rawScore);

    rawWeighted += score * weight;
    maxWeighted += max * weight;

    breakdown.push({
      criterionId: c.id,
      score,
      maxPoints: max,
      weight
    });
  }

  const finalScore = maxWeighted > 0
    ? Number(((rawWeighted / maxWeighted) * total).toFixed(2))
    : 0;

  return {
    finalScore,
    maxScore: Number(total.toFixed(2)),
    rawWeighted: Number(rawWeighted.toFixed(2)),
    maxWeighted: Number(maxWeighted.toFixed(2)),
    breakdown
  };
}

// Garante que todos os critérios obrigatórios foram pontuados.
// criteria: [{ id, required, title }]; scores: obj { [criterionId]: score }
export function validateRequiredCriteria(criteria, scores) {
  const missing = criteria
    .filter(c => c.required)
    .filter(c => scores[c.id] === undefined || scores[c.id] === null || scores[c.id] === "")
    .map(c => c.title || c.id);

  return { valid: missing.length === 0, missing };
}
