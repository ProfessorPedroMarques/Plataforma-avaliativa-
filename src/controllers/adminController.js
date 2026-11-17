
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
    registrationNumber: optionalString(req.body.registrationNumber, "registrationNumber"),
    groupId: optionalString(req.body.groupId, "groupId")
  };
  const student = await adminService.createStudent(data);
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "Student", entityId: student.id });
  return created(res, student, "Aluno cadastrado.");
}

export async function listUsers(req, res) {
  return ok(res, await adminService.listUsers(req.query.role));
}

export async function listStudents(req, res) {
  return ok(res, await adminService.listStudents());
}

export async function setStudentGroup(req, res) {
  const groupId = optionalString(req.body.groupId, "groupId");
  const r = await adminService.setStudentGroup(req.params.studentId, groupId);
  await recordAudit({ actorUserId: req.user.id, action: "SET_GROUP", entity: "Student", entityId: req.params.studentId, details: { groupId } });
  return ok(res, r, groupId ? "Aluno vinculado ao grupo." : "Aluno retirado do grupo.");
}

// ---- Grupos ----
export async function createGroup(req, res) {
  const studentIds = req.body.studentIds === undefined ? [] : req.body.studentIds;
  if (!Array.isArray(studentIds) || studentIds.some(id => typeof id !== "string")) throw new HttpError(400, "studentIds deve ser uma lista.");
  const g = await adminService.createGroup({
    name: requireString(req.body.name, "name"),
    description: optionalString(req.body.description, "description"),
    studentIds
  });
  await recordAudit({ actorUserId: req.user.id, action: "CREATE", entity: "StudentGroup", entityId: g.id });
  return created(res, g, "Grupo criado.");
}

export async function listGroups(req, res) {
  return ok(res, await adminService.listGroups());
}

export async function renameGroup(req, res) {
  const g = await adminService.renameGroup(req.params.id, requireString(req.body.name, "name"));
  return ok(res, g, "Grupo renomeado.");
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
  await recordAudit({ actorUserId: req.user.id, action: "DELETE", entity: "StudentGroup", entityId: req.params.id });
  return ok(res, r, "Grupo removido.");
}

export async function resetPassword(req, res) {
  const r = await adminService.resetPassword(req.params.id, requireString(req.body.password, "password"));
  await recordAudit({ actorUserId: req.user.id, action: "RESET_PASSWORD", entity: "User", entityId: req.params.id });
  return ok(res, r, "Senha provisória redefinida. O usuário deverá trocá-la no próximo acesso.");
}
