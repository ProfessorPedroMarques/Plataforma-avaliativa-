
// Middleware de autorização por papel (RBAC).
// Deve ser usado SEMPRE após authenticateToken, que popula req.user.
export function authorizeRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "Não autenticado."
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Acesso negado para o seu perfil."
      });
    }

    return next();
  };
}
