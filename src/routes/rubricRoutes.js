
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { authorizeRole } from "../middlewares/authorizeRole.js";
import { asyncHandler } from "../utils/http.js";
import * as c from "../controllers/rubricController.js";

const router = Router();

// Toda a gestão de rubricas/critérios é EXCLUSIVA do ADMIN (regra fundamental).
router.use(authenticateToken, authorizeRole("ADMIN"));

// Rubricas
router.post("/", asyncHandler(c.create));
router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getById));
router.patch("/:id", asyncHandler(c.update));
router.post("/:id/duplicate", asyncHandler(c.duplicate));

// Versões
router.post("/:id/versions", asyncHandler(c.createVersion));
router.patch("/versions/:versionId", asyncHandler(c.updateVersion));
router.post("/versions/:versionId/publish", asyncHandler(c.publishVersion));

// Critérios
router.post("/versions/:versionId/criteria", asyncHandler(c.addCriterion));
router.patch("/versions/:versionId/reorder", asyncHandler(c.reorderCriteria));
router.patch("/criteria/:criterionId", asyncHandler(c.updateCriterion));
router.patch("/criteria/:criterionId/active", asyncHandler(c.setCriterionActive));
router.delete("/criteria/:criterionId", asyncHandler(c.deleteCriterion));

export default router;
