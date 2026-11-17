
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  login,
  getProfile,
  changePassword
} from "../controllers/authController.js";

import {
  authenticateToken
} from "../middlewares/authMiddleware.js";

const router = Router();

// Proteção contra força bruta: conta apenas tentativas que FALHAM.
// (Na escola, vários alunos acessam pelo mesmo IP público; logins corretos
//  não podem bloquear a turma inteira.)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas incorretas. Aguarde 15 minutos."
  }
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Muitas tentativas incorretas. Aguarde 15 minutos." }
});

// Login
router.post("/login", loginLimiter, login);

// Perfil do usuário autenticado
router.get("/me", authenticateToken, getProfile);

// Troca da própria senha (liberada mesmo com senha provisória pendente)
router.post("/change-password", passwordLimiter, authenticateToken, changePassword);

export default router;
