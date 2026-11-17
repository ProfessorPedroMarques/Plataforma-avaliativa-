
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";

const criterionSelect = {
  id: true, title: true, description: true, guidance: true,
  weight: true, maxPoints: true, position: true, required: true, active: true, scope: true
};

const versionInclude = {
  criteria: { orderBy: { position: "asc" }, select: criterionSelect }
};

// ---------- Rubricas ----------

export async function createRubric(adminId, { name, description }) {
  // Cria a rubrica já com a versão 1 (rascunho, editável).
  return prisma.rubric.create({
    data: {
      name,
      description,
      createdById: adminId,
      versions: { create: { versionNumber: 1, description } }
    },
    include: { versions: { include: versionInclude } }
  });
}

export async function listRubrics() {
  return prisma.rubric.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true, immutable: true, publishedAt: true, totalPoints: true }
      }
    }
  });
}

export async function getRubric(id) {
  const rubric = await prisma.rubric.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      versions: { orderBy: { versionNumber: "asc" }, include: versionInclude }
    }
  });
  if (!rubric) throw new HttpError(404, "Rubrica não encontrada.");
  for (const v of rubric.versions) v.scored = (await scoresInVersion(v.id)) > 0;
  return rubric;
}

// Exclui um conjunto de critérios inteiro, desde que não esteja vinculado a atividades.
export async function deleteRubric(id) {
  const rubric = await getRubric(id);
  const versionIds = rubric.versions.map(v => v.id);
  const [acts, evals] = await Promise.all([
    prisma.activity.count({ where: { rubricVersionId: { in: versionIds } } }),
    prisma.evaluation.count({ where: { rubricVersionId: { in: versionIds } } })
  ]);
  if (acts + evals > 0) {
    throw new HttpError(409, "Este conjunto está vinculado a atividades. Troque os critérios das atividades antes de excluí-lo.");
  }
  await prisma.$transaction([
    prisma.criterion.deleteMany({ where: { rubricVersionId: { in: versionIds } } }),
    prisma.rubricVersion.deleteMany({ where: { rubricId: id } }),
    prisma.rubric.delete({ where: { id } })
  ]);
  return { id };
}

export async function updateRubric(id, { name, description, active }) {
  await getRubric(id);
  return prisma.rubric.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(active !== undefined ? { active } : {})
    }
  });
}

// Duplica uma rubrica inteira (nova rubrica + cópia dos critérios da versão informada ou da última).
export async function duplicateRubric(adminId, sourceRubricId, { name, sourceVersionId }) {
  const source = await getRubric(sourceRubricId);
  const version = sourceVersionId
    ? source.versions.find(v => v.id === sourceVersionId)
    : source.versions[source.versions.length - 1];

  if (!version) throw new HttpError(404, "Versão de origem não encontrada.");

  return prisma.rubric.create({
    data: {
      name: name || `${source.name} (cópia)`,
      description: source.description,
      createdById: adminId,
      versions: {
        create: {
          versionNumber: 1,
          description: version.description,
          totalPoints: version.totalPoints,
          criteria: {
            create: version.criteria.map(c => ({
              title: c.title, description: c.description, guidance: c.guidance,
              weight: c.weight, maxPoints: c.maxPoints, position: c.position,
              required: c.required, active: c.active, scope: c.scope
            }))
          }
        }
      }
    },
    include: { versions: { include: versionInclude } }
  });
}

// ---------- Versões ----------

export async function createVersion(rubricId, { copyFromVersionId, description } = {}) {
  const rubric = await getRubric(rubricId);
  const last = rubric.versions[rubric.versions.length - 1];
  const nextNumber = (last?.versionNumber || 0) + 1;

  let criteriaData = [];
  let totalPoints = 10;
  if (copyFromVersionId) {
    const src = rubric.versions.find(v => v.id === copyFromVersionId);
    if (!src) throw new HttpError(404, "Versão de origem inexistente.");
    totalPoints = src.totalPoints;
    criteriaData = src.criteria.map(c => ({
      title: c.title, description: c.description, guidance: c.guidance,
      weight: c.weight, maxPoints: c.maxPoints, position: c.position,
      required: c.required, active: c.active, scope: c.scope
    }));
  }

  return prisma.rubricVersion.create({
    data: {
      rubricId,
      versionNumber: nextNumber,
      description,
      totalPoints,
      criteria: criteriaData.length ? { create: criteriaData } : undefined
    },
    include: versionInclude
  });
}

// Quantas notas já foram lançadas com os critérios desta versão.
async function scoresInVersion(versionId) {
  return prisma.criterionScore.count({ where: { criterion: { rubricVersionId: versionId } } });
}

// Os critérios podem ser alterados/excluídos enquanto nenhum professor tiver
// lançado nota com eles (mesmo depois de publicados). Depois disso, ficam
// congelados para preservar o histórico das notas.
async function getEditableVersion(versionId) {
  const version = await prisma.rubricVersion.findUnique({
    where: { id: versionId },
    include: versionInclude
  });
  if (!version) throw new HttpError(404, "Versão de rubrica não encontrada.");
  if (await scoresInVersion(versionId) > 0) {
    throw new HttpError(409, "Estes critérios já foram usados em notas e não podem mais ser alterados. Use \"Duplicar\" para criar um novo conjunto.");
  }
  return version;
}

export async function updateVersion(versionId, { description, totalPoints }) {
  await getEditableVersion(versionId);
  return prisma.rubricVersion.update({
    where: { id: versionId },
    data: {
      ...(description !== undefined ? { description } : {}),
      ...(totalPoints !== undefined ? { totalPoints } : {})
    },
    include: versionInclude
  });
}

// Publicar = torna a versão imutável (congela critérios) e disponível para uso.
export async function publishVersion(versionId) {
  const version = await prisma.rubricVersion.findUnique({
    where: { id: versionId }, include: versionInclude
  });
  if (!version) throw new HttpError(404, "Versão não encontrada.");
  if (version.criteria.length === 0) {
    throw new HttpError(400, "Não é possível publicar uma versão sem critérios.");
  }
  return prisma.rubricVersion.update({
    where: { id: versionId },
    data: { immutable: true, publishedAt: new Date() },
    include: versionInclude
  });
}

// ---------- Critérios ----------

export async function addCriterion(versionId, data) {
  const version = await getEditableVersion(versionId);
  const nextPosition = version.criteria.length
    ? Math.max(...version.criteria.map(c => c.position)) + 1
    : 1;

  return prisma.criterion.create({
    data: {
      rubricVersionId: versionId,
      title: data.title,
      description: data.description,
      guidance: data.guidance,
      weight: data.weight ?? 1,
      maxPoints: data.maxPoints ?? 10,
      required: data.required ?? true,
      active: data.active ?? true,
      scope: data.scope === "INDIVIDUAL" ? "INDIVIDUAL" : "GROUP",
      position: data.position ?? nextPosition
    },
    select: criterionSelect
  });
}

async function getCriterionEditable(criterionId) {
  const criterion = await prisma.criterion.findUnique({ where: { id: criterionId } });
  if (!criterion) throw new HttpError(404, "Critério não encontrado.");
  await getEditableVersion(criterion.rubricVersionId);
  return criterion;
}

export async function updateCriterion(criterionId, data) {
  await getCriterionEditable(criterionId);
  const fields = ["title", "description", "guidance", "weight", "maxPoints", "required", "active", "position", "scope"];
  const updateData = {};
  for (const f of fields) if (data[f] !== undefined) updateData[f] = data[f];
  return prisma.criterion.update({ where: { id: criterionId }, data: updateData, select: criterionSelect });
}

export async function setCriterionActive(criterionId, active) {
  await getCriterionEditable(criterionId);
  return prisma.criterion.update({ where: { id: criterionId }, data: { active }, select: criterionSelect });
}

export async function deleteCriterion(criterionId) {
  const criterion = await getCriterionEditable(criterionId);
  // Se já houver pontuações associadas, não excluir (integridade).
  await prisma.criterion.delete({ where: { id: criterionId } });
  return { id: criterionId, rubricVersionId: criterion.rubricVersionId };
}

// Reordena critérios: recebe [{ id, position }]. Usa posições temporárias para evitar colisão de @@unique.
export async function reorderCriteria(versionId, order) {
  await getEditableVersion(versionId);
  await prisma.$transaction(async (tx) => {
    // 1ª passada: desloca para posições temporárias altas evitando conflito.
    let tmp = 1000;
    for (const item of order) {
      await tx.criterion.update({ where: { id: item.id }, data: { position: tmp++ } });
    }
    // 2ª passada: aplica posições finais.
    for (const item of order) {
      await tx.criterion.update({ where: { id: item.id }, data: { position: item.position } });
    }
  });
  return prisma.criterion.findMany({
    where: { rubricVersionId: versionId }, orderBy: { position: "asc" }, select: criterionSelect
  });
}
