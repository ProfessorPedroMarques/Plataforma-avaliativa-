
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";

function normalizeEmail(email) { return String(email).toLowerCase().trim(); }

async function createUserWithRole(role, { name, email, password }) {
  const normalized = normalizeEmail(email);
  if (!name || !name.trim()) throw new HttpError(400, "Nome é obrigatório.");
  if (!normalized.includes("@")) throw new HttpError(400, "E-mail inválido.");
  if (!password || password.length < 8) throw new HttpError(400, "A senha deve ter ao menos 8 caracteres.");

  const exists = await prisma.user.findUnique({ where: { email: normalized } });
  if (exists) throw new HttpError(409, "Já existe um usuário com este e-mail.");

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({ data: { name: name.trim(), email: normalized, passwordHash, role } });
}

// ---- Professores ----
export async function createTeacher({ name, email, password, employeeCode }) {
  const user = await createUserWithRole("TEACHER", { name, email, password });
  const teacher = await prisma.teacher.create({ data: { userId: user.id, employeeCode: employeeCode || null } });
  return { id: teacher.id, userId: user.id, name: user.name, email: user.email, employeeCode: teacher.employeeCode };
}

// ---- Alunos ----
export async function createStudent({ name, email, password, registrationNumber }) {
  const user = await createUserWithRole("STUDENT", { name, email, password });
  const student = await prisma.student.create({ data: { userId: user.id, registrationNumber: registrationNumber || null } });
  return { id: student.id, userId: user.id, name: user.name, email: user.email, registrationNumber: student.registrationNumber };
}

export async function listUsers(role) {
  const where = role ? { role } : {};
  return prisma.user.findMany({
    where, orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true,
      teacher: { select: { id: true } }, student: { select: { id: true } } }
  });
}

// ---- Atribuir professor a turma+disciplina (professor avaliador da turma) ----
export async function assignTeacher({ classId, subjectId, teacherId }) {
  const [c, s, t] = await Promise.all([
    prisma.schoolClass.findUnique({ where: { id: classId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
    prisma.teacher.findUnique({ where: { id: teacherId } })
  ]);
  if (!c) throw new HttpError(400, "Turma inexistente.");
  if (!s) throw new HttpError(400, "Disciplina inexistente.");
  if (!t) throw new HttpError(400, "Professor inexistente.");

  const existing = await prisma.classSubject.findFirst({ where: { classId, subjectId, teacherId } });
  if (existing) throw new HttpError(409, "Este professor já está vinculado a esta turma/disciplina.");
  return prisma.classSubject.create({ data: { classId, subjectId, teacherId } });
}

// ---- Matrícula ----
export async function enrollStudent({ studentId, classId }) {
  const schoolClass = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { schoolYearId: true } });
  if (!schoolClass) throw new HttpError(400, "Turma inexistente.");
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new HttpError(400, "Aluno inexistente.");

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_schoolYearId: { studentId, schoolYearId: schoolClass.schoolYearId } }
  });
  if (existing) {
    if (existing.classId === classId) throw new HttpError(409, "Aluno já matriculado nesta turma.");
    return prisma.enrollment.update({ where: { id: existing.id }, data: { classId, status: "ACTIVE" } });
  }
  return prisma.enrollment.create({ data: { studentId, classId, schoolYearId: schoolClass.schoolYearId } });
}

export async function classStudents(classId) {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: "ACTIVE" },
    include: { student: { select: { id: true, registrationNumber: true, user: { select: { name: true } } } } },
    orderBy: { student: { user: { name: "asc" } } }
  });
  return enrollments.map(e => ({ id: e.student.id, name: e.student.user.name, registrationNumber: e.student.registrationNumber }));
}

// ---- Grupos / Equipes ----
export async function createGroup({ name, classId, description }) {
  if (!name || !name.trim()) throw new HttpError(400, "Nome do grupo é obrigatório.");
  const schoolClass = await prisma.schoolClass.findUnique({ where: { id: classId } });
  if (!schoolClass) throw new HttpError(400, "Turma inexistente.");
  return prisma.studentGroup.create({ data: { name: name.trim(), classId, description: description || null } });
}

const groupInclude = {
  schoolClass: { select: { id: true, name: true } },
  members: { include: { student: { select: { id: true, registrationNumber: true, user: { select: { name: true } } } } } }
};

export async function listGroups(classId) {
  const where = classId ? { classId } : {};
  const groups = await prisma.studentGroup.findMany({ where, orderBy: { name: "asc" }, include: groupInclude });
  return groups.map(g => ({
    id: g.id, name: g.name, description: g.description, schoolClass: g.schoolClass,
    members: g.members.map(m => ({ studentId: m.student.id, name: m.student.user.name, registrationNumber: m.student.registrationNumber }))
  }));
}

export async function getGroup(id) {
  const g = await prisma.studentGroup.findUnique({ where: { id }, include: groupInclude });
  if (!g) throw new HttpError(404, "Grupo não encontrado.");
  return g;
}

export async function addMember(groupId, studentId) {
  const group = await getGroup(groupId);
  // O aluno precisa estar matriculado na turma do grupo.
  const enrolled = await prisma.enrollment.findFirst({ where: { studentId, classId: group.classId, status: "ACTIVE" } });
  if (!enrolled) throw new HttpError(409, "O aluno precisa estar matriculado na turma do grupo.");
  const exists = await prisma.groupMember.findUnique({ where: { groupId_studentId: { groupId, studentId } } });
  if (exists) throw new HttpError(409, "Aluno já está no grupo.");
  await prisma.groupMember.create({ data: { groupId, studentId } });
  return listGroups(group.classId).then(gs => gs.find(x => x.id === groupId));
}

export async function removeMember(groupId, studentId) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_studentId: { groupId, studentId } } });
  if (!member) throw new HttpError(404, "Aluno não está no grupo.");
  await prisma.groupMember.delete({ where: { id: member.id } });
  return { groupId, studentId };
}

export async function deleteGroup(id) {
  await getGroup(id);
  await prisma.studentGroup.delete({ where: { id } });
  return { id };
}
