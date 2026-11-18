
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

// =====================================================================
// APRESENTAÇÃO (estrutura independente dos critérios de documento)
// ---------------------------------------------------------------------
// Nota de UMA avaliação (um professor avaliando um aluno):
//   nota = Σ (nota_do_critério × peso)        máximo = Σ (máximo × peso)
// Só entram os critérios ATIVOS. A avaliação está "completa" quando todos
// os critérios ativos têm nota.
//
// Nota de apresentação do ALUNO = média das avaliações completas da banca
// (com um único professor, é a nota dele). Sem avaliação completa, usa a
// média das parciais apenas para exibição (não conclui a nota).
//
// NOTA FINAL = nota do grupo (documentos) + nota da apresentação.
// =====================================================================

// criteria: [{ id, maxPoints, weight }] (somente ativos); scores: { [criterionId]: score }
export function calculatePresentation({ criteria, scores }) {
  let score = 0, max = 0, filled = 0;
  for (const c of criteria) {
    const w = toNumber(c.weight ?? 1) || 1;
    const m = toNumber(c.maxPoints);
    max += m * w;
    const raw = scores[c.id];
    if (raw !== undefined && raw !== null && raw !== "") { score += toNumber(raw) * w; filled++; }
  }
  return {
    score: Number(score.toFixed(2)),
    max: Number(max.toFixed(2)),
    complete: criteria.length > 0 && filled === criteria.length
  };
}

// evaluations: [{ score, complete }] → { score, complete, count }
export function averagePresentation(evaluations) {
  const done = evaluations.filter(e => e.complete);
  const base = done.length ? done : evaluations;
  if (!base.length) return { score: 0, complete: false, count: 0 };
  const avg = base.reduce((s, e) => s + toNumber(e.score), 0) / base.length;
  return { score: Number(avg.toFixed(2)), complete: done.length > 0, count: done.length };
}
