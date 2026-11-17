
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";
import { getCourse, enrollInCourse } from "./courseService.js";

function normalizeEmail(email) { return String(email).toLowerCase().trim(); }

async function createUserWithRole(role, { name, email, password }) {
  const normalized = normalizeEmail(email);
  if (!name || !name.trim()) throw new HttpError(400, "Nome é obrigatório.");
  if (!normalized.includes("@")) throw new HttpError(400, "E-mail inválido.");
  if (!password || password.length < 8) throw new HttpError(400, "A senha deve ter ao menos 8 caracteres.");

  const exists = await prisma.user.findUnique({ where: { email: normalized } });
  if (exists) throw new HttpError(409, "Já existe um usuário com este e-mail.");

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({ data: { name: name.trim(), email: normalized, passwordHash, role, mustChangePassword: true } });
}

// ---- Professores ----
export async function createTeacher({ name, email, password, employeeCode }) {
  const user = await createUserWithRole("TEACHER", { name, email, password });
  const teacher = await prisma.teacher.create({ data: { userId: user.id, employeeCode: employeeCode || null } });
  return { id: teacher.id, userId: user.id, name: user.name, email: user.email, employeeCode: teacher.employeeCode };
}

// ---- Alunos ----
// Todo aluno é matriculado automaticamente na turma única (Desenvolvimento de Sistemas)
// e pode, opcionalmente, já entrar em um grupo.
export async function createStudent({ name, email, password, registrationNumber, groupId }) {
  if (groupId) await getGroup(groupId);
  const user = await createUserWithRole("STUDENT", { name, email, password });
  const student = await prisma.student.create({ data: { userId: user.id, registrationNumber: registrationNumber || null } });
  await enrollInCourse(student.id);
  if (groupId) await setStudentGroup(student.id, groupId);
  return { id: student.id, userId: user.id, name: user.name, email: user.email, registrationNumber: student.registrationNumber, groupId: groupId || null };
}

export async function listUsers(role) {
  const where = role ? { role } : {};
  return prisma.user.findMany({
    where, orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true, mustChangePassword: true,
      teacher: { select: { id: true } }, student: { select: { id: true } } }
  });
}

// Alunos do curso com o grupo de cada um.
export async function listStudents() {
  const course = await getCourse();
  const students = await prisma.student.findMany({
    orderBy: { user: { name: "asc" } },
    include: {
      user: { select: { id: true, name: true, email: true, mustChangePassword: true } },
      groupMemberships: { where: { group: { classId: course.classId } }, include: { group: { select: { id: true, name: true } } } }
    }
  });
  return students.map(s => ({
    id: s.id, userId: s.user.id, name: s.user.name, email: s.user.email,
    registrationNumber: s.registrationNumber, mustChangePassword: s.user.mustChangePassword,
    group: s.groupMemberships[0]?.group || null
  }));
}

// Coloca o aluno em um grupo (ou tira de todos, com groupId vazio).
// Um aluno participa de no máximo um grupo do curso.
export async function setStudentGroup(studentId, groupId) {
  const course = await getCourse();
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new HttpError(404, "Aluno não encontrado.");
  if (groupId) {
    const group = await getGroup(groupId);
    if (group.classId !== course.classId) throw new HttpError(400, "Grupo não pertence ao curso.");
  }
  await enrollInCourse(studentId);
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.deleteMany({ where: { studentId, group: { classId: course.classId }, ...(groupId ? { NOT: { groupId } } : {}) } });
    if (groupId) {
      await tx.groupMember.upsert({
        where: { groupId_studentId: { groupId, studentId } },
        update: {}, create: { groupId, studentId }
      });
    }
  });
  return { studentId, groupId: groupId || null };
}

// ---- Grupos / Equipes (sempre na turma única) ----
export async function createGroup({ name, description, studentIds = [] }) {
  if (!name || !name.trim()) throw new HttpError(400, "Nome do grupo é obrigatório.");
  const course = await getCourse();
  const dup = await prisma.studentGroup.findFirst({ where: { classId: course.classId, name: { equals: name.trim(), mode: "insensitive" } } });
  if (dup) throw new HttpError(409, "Já existe um grupo com este nome.");
  const group = await prisma.studentGroup.create({ data: { name: name.trim(), classId: course.classId, description: description || null } });
  for (const studentId of studentIds) await setStudentGroup(studentId, group.id);
  return (await listGroups()).find(g => g.id === group.id);
}

const groupInclude = {
  schoolClass: { select: { id: true, name: true } },
  members: { include: { student: { select: { id: true, registrationNumber: true, user: { select: { name: true, email: true } } } } } }
};

export async function listGroups() {
  const course = await getCourse();
  const groups = await prisma.studentGroup.findMany({ where: { classId: course.classId }, orderBy: { name: "asc" }, include: groupInclude });
  return groups.map(g => ({
    id: g.id, name: g.name, description: g.description,
    members: g.members
      .map(m => ({ studentId: m.student.id, name: m.student.user.name, email: m.student.user.email, registrationNumber: m.student.registrationNumber }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }));
}

export async function getGroup(id) {
  const g = await prisma.studentGroup.findUnique({ where: { id }, include: groupInclude });
  if (!g) throw new HttpError(404, "Grupo não encontrado.");
  return g;
}

export async function renameGroup(id, name) {
  if (!name || !name.trim()) throw new HttpError(400, "Nome do grupo é obrigatório.");
  await getGroup(id);
  await prisma.studentGroup.update({ where: { id }, data: { name: name.trim() } });
  return (await listGroups()).find(g => g.id === id);
}

export async function addMember(groupId, studentId) {
  await getGroup(groupId);
  await setStudentGroup(studentId, groupId);
  return (await listGroups()).find(x => x.id === groupId);
}

export async function removeMember(groupId, studentId) {
  const member = await prisma.groupMember.findUnique({ where: { groupId_studentId: { groupId, studentId } } });
  if (!member) throw new HttpError(404, "Aluno não está no grupo.");
  await prisma.groupMember.delete({ where: { id: member.id } });
  return { groupId, studentId };
}

export async function deleteGroup(id) {
  await getGroup(id);
  const [subs, results] = await Promise.all([
    prisma.submission.count({ where: { groupId: id } }),
    prisma.evaluationResult.count({ where: { groupId: id } })
  ]);
  if (subs + results > 0) throw new HttpError(409, "Este grupo já enviou documentos e não pode ser excluído. Você pode remover os alunos dele.");
  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { groupId: id } }),
    prisma.evaluationGroup.deleteMany({ where: { groupId: id } }),
    prisma.studentGroup.delete({ where: { id } })
  ]);
  return { id };
}

// ---- Redefinir senha provisória (o usuário deverá trocá-la no próximo acesso) ----
export async function resetPassword(userId, password) {
  if (!password || password.length < 8) throw new HttpError(400, "A senha provisória deve ter ao menos 8 caracteres.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Usuário não encontrado.");
  if (user.role === "ADMIN") throw new HttpError(403, "Não é possível redefinir a senha de um administrador por aqui.");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } });
  return { id: userId, mustChangePassword: true };
}
