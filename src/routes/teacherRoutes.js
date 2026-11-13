
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.js";
import { asyncHandler } from "../utils/http.js";
import * as c from "../controllers/teacherController.js";

const router = Router();

router.use(authenticateToken, authorizeRole("TEACHER"));

// Dashboard
router.get("/dashboard", asyncHandler(c.dashboard));

// Projetos recebidos
router.get("/submissions", asyncHandler(c.listReceived));
router.get("/submissions/:id", asyncHandler(c.getSubmission));
router.get("/files/:fileId/download", asyncHandler(c.downloadFile));

// Observações internas (não visíveis ao aluno)
router.post("/submissions/:id/notes", asyncHandler(c.addNote));
router.delete("/notes/:noteId", asyncHandler(c.deleteNote));

export default router;
