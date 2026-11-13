
// Seed de DESENVOLVIMENTO: cria dados mínimos para testar o fluxo.
// NÃO usar em produção. Idempotente (upsert por chaves naturais).
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";

dotenv.config();

async function main() {
  const pass = await bcrypt.hash("Senha123456", 12);

  // Professor
  const teacherUser = await prisma.user.upsert({
    where: { email: "professor@escola.dev" },
    update: {},
    create: { name: "Professor Teste", email: "professor@escola.dev", passwordHash: pass, role: "TEACHER" }
  });
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: { userId: teacherUser.id, employeeCode: "PROF001" }
  });

  // Aluno
  const studentUser = await prisma.user.upsert({
    where: { email: "aluno@escola.dev" },
    update: {},
    create: { name: "Aluno Teste", email: "aluno@escola.dev", passwordHash: pass, role: "STUDENT" }
  });
  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: { userId: studentUser.id, registrationNumber: "2026001" }
  });

  // Estrutura acadêmica
  const year = await prisma.schoolYear.upsert({
    where: { year: 2026 }, update: {},
    create: { year: 2026, name: "Ano Letivo 2026" }
  });
  const term = await prisma.schoolTerm.upsert({
    where: { schoolYearId_number: { schoolYearId: year.id, number: 1 } }, update: {},
    create: { name: "1º Bimestre", number: 1, startDate: new Date("2026-02-01"), endDate: new Date("2026-04-30"), schoolYearId: year.id }
  });
  let schoolClass = await prisma.schoolClass.findFirst({ where: { name: "3º DS", schoolYearId: year.id } });
  if (!schoolClass) {
    schoolClass = await prisma.schoolClass.create({ data: { name: "3º DS", code: "3DS", grade: "3", schoolYearId: year.id } });
  }
  const subject = await prisma.subject.upsert({
    where: { code: "DS" }, update: {},
    create: { name: "Desenvolvimento de Sistemas", code: "DS" }
  });
  await prisma.classSubject.upsert({
    where: { classId_subjectId_teacherId: { classId: schoolClass.id, subjectId: subject.id, teacherId: teacher.id } },
    update: {},
    create: { classId: schoolClass.id, subjectId: subject.id, teacherId: teacher.id }
  });
  await prisma.enrollment.upsert({
    where: { studentId_schoolYearId: { studentId: student.id, schoolYearId: year.id } },
    update: {},
    create: { studentId: student.id, classId: schoolClass.id, schoolYearId: year.id }
  });

  console.log(JSON.stringify({
    teacherId: teacher.id, teacherUserId: teacherUser.id,
    studentId: student.id, studentUserId: studentUser.id,
    yearId: year.id, termId: term.id, classId: schoolClass.id, subjectId: subject.id
  }, null, 2));
  console.log("Seed de desenvolvimento concluído.");
}

main()
  .catch(e => { console.error("Erro no seed:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
