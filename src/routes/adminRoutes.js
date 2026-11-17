
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.js";
import { asyncHandler } from "../utils/http.js";
import * as c from "../controllers/adminController.js";

const router = Router();

router.use(authenticateToken, authorizeRole("ADMIN"));

// Usuários
router.get("/users", asyncHandler(c.listUsers));
router.post("/teachers", asyncHandler(c.createTeacher));
router.post("/students", asyncHandler(c.createStudent));
router.post("/users/:id/reset-password", asyncHandler(c.resetPassword));

// Alunos (turma única: matrícula automática) e vínculo com grupo
router.get("/students", asyncHandler(c.listStudents));
router.put("/students/:studentId/group", asyncHandler(c.setStudentGroup));

// Grupos / equipes
router.get("/groups", asyncHandler(c.listGroups));
router.post("/groups", asyncHandler(c.createGroup));
router.patch("/groups/:id", asyncHandler(c.renameGroup));
router.delete("/groups/:id", asyncHandler(c.deleteGroup));
router.post("/groups/:id/members", asyncHandler(c.addMember));
router.delete("/groups/:id/members/:studentId", asyncHandler(c.removeMember));

export default router;
