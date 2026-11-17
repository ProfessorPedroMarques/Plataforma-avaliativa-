
import * as adminService from "../services/adminService.js";
import { recordAudit } from "../services/auditService.js";
import { ok, created, requireString, optionalString, HttpError } from "../utils/http.js";

// ---- Usuários ----
export async function createTeacher(req, res) {
  const data = {
    name: requireString(req.body.name, "name"),
    email: requireString(req.body.email, "email"),
    password: requireString(req.body.password, "password"),
    employeeCode: optionalString(req.body.employeeCode, "employeeCode")
  };
  const teacher = await adminService.createTeacher(data);
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "Teacher", entityId: teacher.id });
  return created(res, teacher, "Professor cadastrado.");
}

export async function createStudent(req, res) {
  const data = {
    name: requireString(req.body.name, "name"),
    email: requireString(req.body.email, "email"),
    password: requireString(req.body.password, "password"),
    registrationNumber: optionalString(req.body.registrationNumber, "registrationNumber")
  };
  const student = await adminService.createStudent(data);
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "Student", entityId: student.id });
  return created(res, student, "Aluno cadastrado.");
}

export async function listUsers(req, res) {
  return ok(res, await adminService.listUsers(req.query.role));
}

export async function assignTeacher(req, res) {
  const cs = await adminService.assignTeacher({
    classId: requireString(req.body.classId, "classId"),
    subjectId: requireString(req.body.subjectId, "subjectId"),
    teacherId: requireString(req.body.teacherId, "teacherId")
  });
  await recordAudit({ actorUserId: req.user.id, action: "ASSIGN", entity: "ClassSubject", entityId: cs.id });
  return created(res, cs, "Professor vinculado à turma/disciplina.");
}

export async function enroll(req, res) {
  const e = await adminService.enrollStudent({
    studentId: requireString(req.body.studentId, "studentId"),
    classId: requireString(req.params.classId, "classId")
  });
  await recordAudit({ actorUserId: req.user.id, action: "ENROLL", entity: "Enrollment", entityId: e.id });
  return created(res, e, "Aluno matriculado.");
}

export async function classStudents(req, res) {
  return ok(res, await adminService.classStudents(req.params.classId));
}

// ---- Grupos ----
export async function createGroup(req, res) {
  const g = await adminService.createGroup({
    name: requireString(req.body.name, "name"),
    classId: requireString(req.body.classId, "classId"),
    description: optionalString(req.body.description, "description")
  });
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "StudentGroup", entityId: g.id });
  return created(res, g, "Grupo criado.");
}

export async function listGroups(req, res) {
  return ok(res, await adminService.listGroups(req.query.classId));
}

export async function addMember(req, res) {
  const g = await adminService.addMember(req.params.id, requireString(req.body.studentId, "studentId"));
  return ok(res, g, "Aluno adicionado ao grupo.");
}

export async function removeMember(req, res) {
  const r = await adminService.removeMember(req.params.id, req.params.studentId);
  return ok(res, r, "Aluno removido do grupo.");
}

export async function deleteGroup(req, res) {
  const r = await adminService.deleteGroup(req.params.id);
  return ok(res, r, "Grupo removido.");
}

export async function resetPassword(req, res) {
  const r = await adminService.resetPassword(req.params.id, requireString(req.body.password, "password"));
  await recordAudit({ actorUserId: req.user.id, action: "RESET_PASSWORD", entity: "User", entityId: req.params.id });
  return ok(res, r, "Senha provisória redefinida. O usuário deverá trocá-la no próximo acesso.");
}
