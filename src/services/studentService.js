
import prisma from "../config/database.js";
import { breakdown } from "./gradeService.js";
import { HttpError } from "../utils/http.js";

// Resolve o registro Student a partir do userId autenticado.
export async function getStudentByUser(userId) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw new HttpError(403, "Usuário não possui perfil de estudante.");
  return student;
}

// IDs das turmas em que o estudante está matriculado (ativo).
async function enrolledClassIds(studentId) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    select: { classId: true }
  });
  return enrollments.map(e => e.classId);
}

// Grupos do estudante (com a turma de cada um).
export async function studentGroups(studentId) {
  const memberships = await prisma.groupMember.findMany({
    where: { studentId },
    include: { group: { select: { id: true, name: true, classId: true } } }
  });
  return memberships.map(m => m.group);
}

// Grupo do estudante na turma da atividade (para atividades em equipe).
async function groupForActivity(studentId, activity) {
  const groups = await studentGroups(studentId);
  // Curso de turma única: vale o grupo da turma da atividade ou, na falta, o grupo do aluno.
  return groups.find(g => g.classId === activity.classId) || groups[0] || null;
}

// Atividades disponíveis para o estudante (das suas turmas, não-rascunho).
export async function listAvailableActivities(studentId) {
  const classIds = await enrolledClassIds(studentId);
  if (classIds.length === 0) return [];

  const activities = await prisma.activity.findMany({
    where: { classId: { in: classIds }, status: { in: ["OPEN", "CLOSED"] } },
    orderBy: { dueDate: "asc" },
    include: {
      schoolClass: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } }
    }
  });

  const groups = await studentGroups(studentId);
  const groupIds = groups.map(g => g.id);

  // Entregas do aluno (individuais) e do(s) grupo(s) dele.
  const subs = await prisma.submission.findMany({
    where: {
      activityId: { in: activities.map(a => a.id) },
      OR: [{ studentId }, ...(groupIds.length ? [{ groupId: { in: groupIds } }] : [])]
    },
    select: { id: true, activityId: true, status: true, submittedAt: true, groupId: true }
  });
  const byActivity = new Map(subs.map(s => [s.activityId, s]));

  return activities.map(a => ({
    ...a,
    myGroup: a.mode === "GROUP" ? (groups.find(g => g.classId === a.classId) || groups[0] || null) : null,
    mySubmission: byActivity.get(a.id) || null,
    windowOpen: isWindowOpen(a)
  }));
}

function isWindowOpen(activity) {
  if (activity.status !== "OPEN") return false;
  const now = new Date();
  if (activity.openDate && now < activity.openDate) return false;
  if (activity.dueDate && now > activity.dueDate) return false;
  return true;
}

export async function getAvailableActivity(studentId, activityId) {
  const classIds = await enrolledClassIds(studentId);
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      schoolClass: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { user: { select: { name: true } } } }
    }
  });
  if (!activity || !classIds.includes(activity.classId) || activity.status === "DRAFT") {
    throw new HttpError(404, "Atividade não encontrada ou indisponível.");
  }
  const myGroup = activity.mode === "GROUP" ? await groupForActivity(studentId, activity) : null;
  return { ...activity, myGroup, windowOpen: isWindowOpen(activity) };
}

// Garante que a atividade pertence ao aluno e devolve-a (para validações de envio).
export async function assertActivityForStudent(studentId, activityId) {
  const classIds = await enrolledClassIds(studentId);
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity || !classIds.includes(activity.classId)) {
    throw new HttpError(404, "Atividade indisponível para você.");
  }
  return activity;
}

const submissionInclude = {
  activity: { select: { id: true, title: true, dueDate: true, allowedFormats: true, maxFiles: true, maxFileSizeMb: true, allowResubmission: true, status: true } },
  versions: {
    orderBy: { versionNumber: "asc" },
    include: { files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } } }
  },
  history: { orderBy: { createdAt: "asc" } },
  group: { select: { id: true, name: true } }
};

export async function listMySubmissions(studentId) {
  const groupIds = (await studentGroups(studentId)).map(g => g.id);
  return prisma.submission.findMany({
    where: { OR: [{ studentId }, ...(groupIds.length ? [{ groupId: { in: groupIds } }] : [])] },
    orderBy: { updatedAt: "desc" },
    include: {
      activity: { select: { id: true, title: true, dueDate: true } },
      group: { select: { id: true, name: true } },
      versions: { select: { id: true, versionNumber: true, _count: { select: { files: true } } } }
    }
  });
}

// O aluno pode acessar a entrega se ela for dele ou do grupo do qual participa.
export async function canAccessSubmission(studentId, submission) {
  if (!submission) return false;
  if (submission.studentId && submission.studentId === studentId) return true;
  if (submission.groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_studentId: { groupId: submission.groupId, studentId } }
    });
    return !!member;
  }
  return false;
}

// Busca entrega garantindo que pertence ao estudante (ou ao seu grupo).
export async function getOwnedSubmission(studentId, submissionId, full = true) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: full ? submissionInclude : undefined
  });
  if (!(await canAccessSubmission(studentId, submission))) {
    throw new HttpError(404, "Entrega não encontrada.");
  }
  return submission;
}

export async function createSubmission(studentId, { activityId, title, description }) {
  const activity = await assertActivityForStudent(studentId, activityId);

  // Atividade em equipe: a entrega pertence ao GRUPO (qualquer integrante pode iniciar/enviar).
  if (activity.mode === "GROUP") {
    const group = await groupForActivity(studentId, activity);
    if (!group) throw new HttpError(409, "Você ainda não está em um grupo. Peça ao administrador para incluí-lo (Admin › Grupos).");
    const existing = await prisma.submission.findFirst({ where: { activityId, groupId: group.id }, include: submissionInclude });
    if (existing) return existing; // já iniciada por outro integrante: reaproveita
    return prisma.submission.create({
      data: {
        activityId, groupId: group.id, title, description,
        status: "NOT_STARTED",
        history: { create: { status: "NOT_STARTED", note: "Entrega do grupo iniciada.", changedById: studentId } }
      },
      include: submissionInclude
    });
  }

  const existing = await prisma.submission.findFirst({ where: { activityId, studentId } });
  if (existing) throw new HttpError(409, "Você já possui uma entrega para esta atividade.");

  return prisma.submission.create({
    data: {
      activityId, studentId, title, description,
      status: "NOT_STARTED",
      history: { create: { status: "NOT_STARTED", note: "Entrega iniciada." } }
    },
    include: submissionInclude
  });
}

// ================= ETAPA 9: MINHAS NOTAS =================

const PUBLISHED_STATES = ["PUBLISHED", "REVISED"];

// Calcula a divisão da nota (grupo/documentos × apresentação) pela fonte única de cálculo.
// Critérios dos DOCUMENTOS da atividade (nota do grupo).
async function documentCriteriaOf(result) {
  return prisma.criterion.findMany({
    where: { rubricVersionId: result.evaluation.rubricVersionId, active: true, scope: { not: "INDIVIDUAL" } },
    orderBy: { position: "asc" }
  });
}

// Lista apenas resultados PUBLICADOS do próprio aluno, com a composição da nota.
export async function listPublishedGrades(studentId) {
  const results = await prisma.evaluationResult.findMany({
    where: { studentId, status: { in: PUBLISHED_STATES } },
    orderBy: { publishedAt: "desc" },
    include: {
      evaluation: { select: { title: true, rubricVersionId: true, activity: { select: { id: true, title: true } } } },
      submission: { select: { id: true, title: true } },
      group: { select: { id: true, name: true } }
    }
  });
  const out = [];
  for (const r of results) {
    const b = await breakdown(prisma, r);
    out.push({
      resultId: r.id,
      activity: r.evaluation.activity ? { id: r.evaluation.activity.id, title: r.evaluation.activity.title } : null,
      projectTitle: r.submission?.title || null,
      group: r.group ? { id: r.group.id, name: r.group.name } : null,
      ...b,
      status: r.status,
      publishedAt: r.publishedAt
    });
  }
  return out;
}

// Detalhe de uma nota PUBLICADA do próprio aluno:
//  📄 critérios dos documentos (nota do grupo) + 🎤 critérios da apresentação (avaliação individual da banca).
export async function getPublishedGradeDetail(studentId, resultId) {
  const result = await prisma.evaluationResult.findUnique({
    where: { id: resultId },
    include: {
      evaluation: { select: { title: true, rubricVersionId: true, activityId: true, activity: { select: { id: true, title: true } } } },
      submission: { select: { id: true, title: true } },
      group: { select: { id: true, name: true } },
      criterionScores: true,
      feedbacks: { where: { type: { in: ["FINAL", "GENERAL"] } }, orderBy: { createdAt: "desc" } }
    }
  });

  // Regra de segurança: só o dono e somente se PUBLICADO.
  if (!result || result.studentId !== studentId || !PUBLISHED_STATES.includes(result.status)) {
    throw new HttpError(404, "Nota não encontrada ou ainda não publicada.");
  }

  const b = await breakdown(prisma, result);
  const docCriteria = await documentCriteriaOf(result);
  const scoreByCriterion = new Map(result.criterionScores.map(cs => [cs.criterionId, cs]));
  const documentCriteria = docCriteria.map(c => {
    const cs = scoreByCriterion.get(c.id);
    return { title: c.title, description: c.description, maxPoints: Number(c.maxPoints), weight: Number(c.weight), score: cs ? Number(cs.score) : null, comment: cs?.comment || null };
  });

  // Apresentação: média por critério das avaliações completas da banca + observações de cada professor.
  const evals = result.evaluation.activityId ? await prisma.presentationEvaluation.findMany({
    where: { activityId: result.evaluation.activityId, studentId },
    include: { scores: { include: { criterion: true } }, teacher: { select: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" }
  }) : [];
  const base = evals.some(e => e.complete) ? evals.filter(e => e.complete) : evals;
  const perCrit = new Map();
  for (const e of base) for (const s of e.scores) {
    if (!perCrit.has(s.criterionId)) perCrit.set(s.criterionId, { c: s.criterion, total: 0, n: 0 });
    const x = perCrit.get(s.criterionId); x.total += Number(s.score); x.n++;
  }
  const presentationCriteria = [...perCrit.values()].sort((x, y) => x.c.position - y.c.position).map(x => ({
    title: x.c.title, description: x.c.description, maxPoints: Number(x.c.maxPoints), weight: Number(x.c.weight),
    score: Number((x.total / x.n).toFixed(2)), comment: null
  }));
  const presentationNotes = base.filter(e => e.notes).map(e => ({ teacher: e.teacher.user.name, notes: e.notes }));

  return {
    resultId: result.id,
    activity: result.evaluation.activity,
    projectTitle: result.submission?.title || null,
    group: result.group ? { id: result.group.id, name: result.group.name } : null,
    ...b,
    status: result.status,
    publishedAt: result.publishedAt,
    evaluatedAt: result.finalizedAt,
    documentFeedback: result.feedbacks.find(f => f.type === "GENERAL")?.content || null,
    generalFeedback: result.feedbacks.find(f => f.type === "FINAL")?.content || null,
    documentCriteria, presentationCriteria, presentationNotes,
    evaluators: base.length
  };
}

export async function updateSubmissionMeta(studentId, submissionId, { title, description }) {
  const submission = await getOwnedSubmission(studentId, submissionId, false);
  if (["SUBMITTED", "UNDER_REVIEW", "EVALUATED"].includes(submission.status)) {
    throw new HttpError(409, "Entrega já enviada não pode ser alterada.");
  }
  return prisma.submission.update({
    where: { id: submissionId },
    data: { ...(title !== undefined ? { title } : {}), ...(description !== undefined ? { description } : {}) },
    include: submissionInclude
  });
}
