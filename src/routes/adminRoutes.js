
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
router.post("/class-subjects", asyncHandler(c.assignTeacher));

// Matrícula e alunos da turma
router.post("/classes/:classId/enroll", asyncHandler(c.enroll));
router.get("/classes/:classId/students", asyncHandler(c.classStudents));

// Grupos / equipes
router.get("/groups", asyncHandler(c.listGroups));
router.post("/groups", asyncHandler(c.createGroup));
router.delete("/groups/:id", asyncHandler(c.deleteGroup));
router.post("/groups/:id/members", asyncHandler(c.addMember));
router.delete("/groups/:id/members/:studentId", asyncHandler(c.removeMember));

export default router;
