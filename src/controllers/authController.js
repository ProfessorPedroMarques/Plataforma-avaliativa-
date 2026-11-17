
import prisma from "../config/database.js";
import { authenticateUser, changePassword as changePasswordService } from "../services/authService.js";

// Realizar login
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Informe e-mail e senha."
      });
    }

    const result = await authenticateUser(email, password);

    if (!result) {
      return res.status(401).json({
        success: false,
        message: "E-mail ou senha inválidos."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login realizado com sucesso.",
      data: result
    });

  } catch (error) {
    console.error("Erro no login:", error);

    return res.status(500).json({
      success: false,
      message: "Não foi possível realizar o login."
    });
  }
}

// Consultar perfil autenticado
export async function getProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
        createdAt: true
      }
    });

    if (!user || !user.active) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado ou inativo."
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error("Erro ao consultar perfil:", error);

    return res.status(500).json({
      success: false,
      message: "Não foi possível consultar o perfil."
    });
  }
}

// Trocar a própria senha (obrigatório no primeiro acesso com senha provisória)
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ success: false, message: "Informe a senha atual e a nova senha." });
    }
    const result = await changePasswordService(req.user.id, currentPassword, newPassword);
    return res.status(200).json({ success: true, message: "Senha alterada com sucesso.", data: result });
  } catch (error) {
    return next(error);
  }
}
