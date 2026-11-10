
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  login,
  getProfile
} from "../controllers/authController.js";

import {
  authenticateToken
} from "../middlewares/authMiddleware.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas. Aguarde 15 minutos."
  }
});

// Login
router.post("/login", loginLimiter, login);

// Perfil do usuário autenticado
router.get("/me", authenticateToken, getProfile);

export default router;
