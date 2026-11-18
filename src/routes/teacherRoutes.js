
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.js";
import { asyncHandler } from "../utils/http.js";
import * as c from "../controllers/teacherController.js";
import * as ev from "../controllers/evaluationController.js";
import * as pr from "../controllers/presentationController.js";

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

// Publicação e revisão controlada (Etapa 8)
router.post("/results/:resultId/publish", asyncHandler(ev.publish));
router.post("/activities/:activityId/publish-all", asyncHandler(ev.publishAll));
router.post("/results/:resultId/revise", asyncHandler(ev.revise));

// Avaliação dos DOCUMENTOS (nota do grupo)
router.post("/submissions/:id/document-evaluation", asyncHandler(ev.openDocumentEvaluation));
router.put("/submissions/:id/document-evaluation", asyncHandler(ev.saveDocumentScores));
router.get("/documents-overview", asyncHandler(ev.documentsOverview));
router.post("/activities/:activityId/documents/open", asyncHandler(ev.openDocumentsFor));

// Avaliação da APRESENTAÇÃO (critérios próprios, avaliação individual por aluno)
router.get("/presentation/activities", asyncHandler(pr.teacherProjects));
router.get("/presentation/activities/:activityId/students/:studentId", asyncHandler(pr.openStudent));
router.put("/presentation/activities/:activityId/students/:studentId", asyncHandler(pr.saveStudent));

export default router;
