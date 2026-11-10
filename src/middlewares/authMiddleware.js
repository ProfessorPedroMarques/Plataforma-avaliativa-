
import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticação não informado."
      });
    }

    const token = authorization.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: "plataforma-avaliacao"
      }
    );

    req.user = {
      id: decoded.sub,
      role: decoded.role
    };

    return next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token inválido ou expirado."
    });
  }
}
