
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.js";
import { handleUpload } from "../middlewares/upload.js";
import { asyncHandler } from "../utils/http.js";
import * as c from "../controllers/studentController.js";

const router = Router();

// Toda a área do aluno exige papel STUDENT.
router.use(authenticateToken, authorizeRole("STUDENT"));

// Atividades disponíveis
router.get("/activities", asyncHandler(c.listActivities));
router.get("/activities/:id", asyncHandler(c.getActivity));

// Minhas entregas
router.get("/submissions", asyncHandler(c.listSubmissions));
router.post("/submissions", asyncHandler(c.createSubmission));
router.get("/submissions/:id", asyncHandler(c.getSubmission));
router.patch("/submissions/:id", asyncHandler(c.updateSubmission));
router.post("/submissions/:id/files", handleUpload, asyncHandler(c.uploadFiles));
router.post("/submissions/:id/submit", asyncHandler(c.submit));
router.post("/submissions/:id/resubmit", asyncHandler(c.resubmit));

// Minhas Notas (somente resultados publicados)
router.get("/grades", asyncHandler(c.listGrades));
router.get("/grades/:resultId", asyncHandler(c.getGrade));

// Download autorizado dos próprios arquivos
router.get("/files/:fileId/download", asyncHandler(c.downloadFile));

export default router;
