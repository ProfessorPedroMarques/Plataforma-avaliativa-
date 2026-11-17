
// =====================================================================
// FONTE ÚNICA DE CÁLCULO DE NOTAS
// ---------------------------------------------------------------------
// Toda pontuação final da plataforma DEVE passar por esta função.
// Não crie fórmulas paralelas em controllers/services: importe daqui.
//
// Regra (definida pela coordenação):
//   • Critérios de DOCUMENTO  (scope = GROUP)      → NOTA DO GRUPO
//       notaGrupo      = Σ (nota_i × peso_i)   dos critérios de documento
//   • Critérios de APRESENTAÇÃO (scope = INDIVIDUAL) → nota da apresentação
//       notaApresent.  = Σ (nota_i × peso_i)   dos critérios de apresentação
//   • NOTA INDIVIDUAL FINAL do aluno = notaGrupo + notaApresentação
//
// Com peso 1 (padrão), é a soma simples das notas lançadas.
// =====================================================================

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "object" && typeof value.toNumber === "function"
    ? value.toNumber()
    : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n) => Number(n.toFixed(2));

// Valida uma pontuação individual contra o máximo do critério.
export function validateCriterionScore(score, maxPoints) {
  const s = Number(score);
  const max = toNumber(maxPoints);
  if (!Number.isFinite(s) || s < 0) {
    return { valid: false, message: "Pontuação não pode ser negativa ou inválida." };
  }
  if (s > max) {
    return { valid: false, message: `Pontuação ${s} excede o máximo do critério (${max}).` };
  }
  return { valid: true };
}

// criteria: [{ id, weight, maxPoints, scope }]  (scope: "GROUP" | "INDIVIDUAL"; ausente = GROUP)
// scores:   { [criterionId]: score }
// (totalPoints é aceito por compatibilidade, mas não é usado: a nota é soma.)
export function calculateResult({ criteria, scores }) {
  let groupScore = 0, groupMax = 0, individualScore = 0, individualMax = 0;
  const breakdown = [];

  for (const c of criteria) {
    const weight = toNumber(c.weight) || 1;
    const max = toNumber(c.maxPoints);
    const score = toNumber(scores[c.id]);
    const isIndividual = c.scope === "INDIVIDUAL";

    if (isIndividual) { individualScore += score * weight; individualMax += max * weight; }
    else { groupScore += score * weight; groupMax += max * weight; }

    breakdown.push({ criterionId: c.id, scope: isIndividual ? "INDIVIDUAL" : "GROUP", score, maxPoints: max, weight });
  }

  return {
    groupScore: round2(groupScore),
    groupMax: round2(groupMax),
    individualScore: round2(individualScore),
    individualMax: round2(individualMax),
    finalScore: round2(groupScore + individualScore),
    maxScore: round2(groupMax + individualMax),
    breakdown
  };
}

// Garante que todos os critérios obrigatórios foram pontuados.
export function validateRequiredCriteria(criteria, scores) {
  const missing = criteria
    .filter(c => c.required)
    .filter(c => scores[c.id] === undefined || scores[c.id] === null || scores[c.id] === "")
    .map(c => c.title || c.id);
  return { valid: missing.length === 0, missing };
}
