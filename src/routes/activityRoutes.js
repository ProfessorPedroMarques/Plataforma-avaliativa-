
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.js";
import { asyncHandler } from "../utils/http.js";
import * as c from "../controllers/activityController.js";

const router = Router();

router.use(authenticateToken);

// Leitura: ADMIN e TEACHER podem listar/consultar atividades.
router.get("/", authorizeRole("ADMIN", "TEACHER"), asyncHandler(c.list));
router.get("/:id", authorizeRole("ADMIN", "TEACHER"), asyncHandler(c.getById));

// Escrita: apenas ADMIN configura atividades (regra fundamental).
router.post("/", authorizeRole("ADMIN"), asyncHandler(c.create));
router.patch("/:id", authorizeRole("ADMIN"), asyncHandler(c.update));
router.patch("/:id/status", authorizeRole("ADMIN"), asyncHandler(c.setStatus));
router.delete("/:id", authorizeRole("ADMIN"), asyncHandler(c.remove));

export default router;
