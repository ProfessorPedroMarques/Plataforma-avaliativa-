
import prisma from "../config/database.js";

// =====================================================================
// CURSO ÚNICO: todos os alunos são da mesma turma e da mesma matéria
// (Desenvolvimento de Sistemas). Esta camada garante, de forma idempotente,
// que existam o ano letivo, o período, a turma e a disciplina padrão, para
// que o ADMIN não precise cadastrar nem escolher turma/matéria.
// =====================================================================

const CLASS_CODE = "DS";
const SUBJECT_CODE = "DS";
const COURSE_NAME = "Desenvolvimento de Sistemas";

let cache = null;

async function ensure() {
  // 1) Turma: a marcada com o código "DS". Se não houver, adota a turma ativa
  //    com mais alunos (dados já existentes) ou cria uma nova.
  let schoolClass = await prisma.schoolClass.findFirst({ where: { code: CLASS_CODE, status: "ACTIVE" } });
  if (!schoolClass) {
    const existing = await prisma.schoolClass.findMany({
      where: { status: "ACTIVE" },
      include: { _count: { select: { enrollments: true } } }
    });
    existing.sort((a, b) => b._count.enrollments - a._count.enrollments || a.name.localeCompare(b.name));
    if (existing.length) {
      schoolClass = await prisma.schoolClass.update({ where: { id: existing[0].id }, data: { code: CLASS_CODE } });
    } else {
      const yearNumber = new Date().getFullYear();
      const year = await prisma.schoolYear.upsert({
        where: { year: yearNumber }, update: {},
        create: { year: yearNumber, name: `Ano Letivo ${yearNumber}` }
      });
      schoolClass = await prisma.schoolClass.create({
        data: { name: COURSE_NAME, code: CLASS_CODE, schoolYearId: year.id }
      });
    }
  }

  // 2) Período letivo (necessário para registrar avaliações).
  const year = await prisma.schoolYear.findUnique({ where: { id: schoolClass.schoolYearId } });
  const term = await prisma.schoolTerm.findFirst({ where: { schoolYearId: year.id } });
  if (!term) {
    await prisma.schoolTerm.create({
      data: {
        name: "Ano letivo", number: 1, schoolYearId: year.id,
        startDate: new Date(`${year.year}-01-01T00:00:00Z`), endDate: new Date(`${year.year}-12-31T23:59:59Z`)
      }
    });
  }

  // 3) Disciplina padrão.
  const subject = await prisma.subject.upsert({
    where: { code: SUBJECT_CODE }, update: {},
    create: { name: COURSE_NAME, code: SUBJECT_CODE }
  });

  return { classId: schoolClass.id, className: schoolClass.name, schoolYearId: schoolClass.schoolYearId, subjectId: subject.id, subjectName: subject.name };
}

// Devolve { classId, subjectId, schoolYearId, ... } da turma/matéria únicas.
export async function getCourse() {
  if (cache) {
    const still = await prisma.schoolClass.findUnique({ where: { id: cache.classId }, select: { id: true } });
    if (still) return cache;
  }
  cache = await ensure();
  return cache;
}

// Matricula (ou move) o aluno na turma única.
export async function enrollInCourse(studentId) {
  const course = await getCourse();
  return prisma.enrollment.upsert({
    where: { studentId_schoolYearId: { studentId, schoolYearId: course.schoolYearId } },
    update: { classId: course.classId, status: "ACTIVE" },
    create: { studentId, classId: course.classId, schoolYearId: course.schoolYearId }
  });
}

// Executado na inicialização: garante a estrutura e matricula todos os alunos.
export async function syncCourse() {
  const course = await getCourse();
  const students = await prisma.student.findMany({
    where: { NOT: { enrollments: { some: { classId: course.classId, status: "ACTIVE" } } } },
    select: { id: true }
  });
  for (const s of students) await enrollInCourse(s.id);
  return { ...course, enrolled: students.length };
}
