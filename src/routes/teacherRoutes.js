
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.js";
import { asyncHandler } from "../utils/http.js";
import * as c from "../controllers/teacherController.js";
import * as ev from "../controllers/evaluationController.js";

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

// ===== Avaliação de Apresentações =====
router.get("/activities/:activityId/evaluables", asyncHandler(ev.listEvaluables));
router.post("/evaluations/open", asyncHandler(ev.openEvaluation));
router.put("/results/:resultId/scores", asyncHandler(ev.saveScores));

// Publicação e revisão controlada (Etapa 8)
router.post("/results/:resultId/publish", asyncHandler(ev.publish));
router.post("/activities/:activityId/publish-all", asyncHandler(ev.publishAll));
router.post("/results/:resultId/revise", asyncHandler(ev.revise));

export default router;
