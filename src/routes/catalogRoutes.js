
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.js";
import { asyncHandler } from "../utils/http.js";
import * as c from "../controllers/catalogController.js";

const router = Router();

// Leitura de catálogos para ADMIN e TEACHER (montagem de formulários e filtros).
router.use(authenticateToken, authorizeRole("ADMIN", "TEACHER"));

router.get("/classes", asyncHandler(c.classes));
router.get("/subjects", asyncHandler(c.subjects));
router.get("/teachers", asyncHandler(c.teachers));

export default router;
