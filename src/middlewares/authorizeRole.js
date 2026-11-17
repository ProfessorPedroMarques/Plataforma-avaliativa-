
import prisma from "../config/database.js";

// Middleware de autorização por papel (RBAC).
// Deve ser usado SEMPRE após authenticateToken, que popula req.user.
// Também bloqueia o acesso enquanto o usuário não trocar a senha provisória.
export function authorizeRole(...allowedRoles) {
  return async function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: "Não autenticado." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Acesso negado para o seu perfil." });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { active: true, mustChangePassword: true }
      });
      if (!user || !user.active) {
        return res.status(401).json({ success: false, message: "Usuário inativo ou inexistente." });
      }
      if (user.mustChangePassword) {
        return res.status(403).json({
          success: false,
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Troque sua senha provisória antes de continuar."
        });
      }
    } catch (error) {
      return next(error);
    }

    return next();
  };
}
