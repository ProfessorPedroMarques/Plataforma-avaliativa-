
import prisma from "../config/database.js";
import { ok } from "../utils/http.js";

// Catálogos de leitura para popular formulários (turmas, disciplinas, professores).
export async function classes(req, res) {
  const data = await prisma.schoolClass.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, grade: true, schoolYear: { select: { year: true } } }
  });
  return ok(res, data);
}

export async function subjects(req, res) {
  const data = await prisma.subject.findMany({
    where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true }
  });
  return ok(res, data);
}

export async function teachers(req, res) {
  const data = await prisma.teacher.findMany({
    orderBy: { user: { name: "asc" } },
    select: { id: true, employeeCode: true, user: { select: { name: true, email: true } } }
  });
  return ok(res, data.map(t => ({ id: t.id, name: t.user.name, email: t.user.email, employeeCode: t.employeeCode })));
}
