
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";

const criterionSelect = {
  id: true, title: true, description: true, guidance: true,
  weight: true, maxPoints: true, position: true, required: true, active: true
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
  return rubric;
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
              required: c.required, active: c.active
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
      required: c.required, active: c.active
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

async function getEditableVersion(versionId) {
  const version = await prisma.rubricVersion.findUnique({
    where: { id: versionId },
    include: versionInclude
  });
  if (!version) throw new HttpError(404, "Versão de rubrica não encontrada.");
  if (version.immutable) {
    throw new HttpError(409, "Versão publicada é imutável. Crie uma nova versão para alterar.");
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
      position: data.position ?? nextPosition
    },
    select: criterionSelect
  });
}

async function getCriterionEditable(criterionId) {
  const criterion = await prisma.criterion.findUnique({
    where: { id: criterionId },
    include: { rubricVersion: { select: { immutable: true } } }
  });
  if (!criterion) throw new HttpError(404, "Critério não encontrado.");
  if (criterion.rubricVersion.immutable) {
    throw new HttpError(409, "Critério pertence a versão publicada (imutável).");
  }
  return criterion;
}

export async function updateCriterion(criterionId, data) {
  await getCriterionEditable(criterionId);
  const fields = ["title", "description", "guidance", "weight", "maxPoints", "required", "active", "position"];
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
  const used = await prisma.criterionScore.count({ where: { criterionId } });
  if (used > 0) throw new HttpError(409, "Critério já possui pontuações; desative-o em vez de excluir.");
  await prisma.criterion.delete({ where: { id: criterionId } });
  return { id: criterionId };
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
