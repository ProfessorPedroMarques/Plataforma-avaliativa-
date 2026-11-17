
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";
import { HttpError } from "../utils/http.js";

function issueToken(user) {
  return jwt.sign(
    { role: user.role },
    process.env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      issuer: "plataforma-avaliacao"
    }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword
  };
}

export async function authenticateUser(email, password) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  // Mensagem genérica para não revelar se o e-mail existe.
  if (!user || !user.active) return null;

  const passwordIsValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordIsValid) return null;

  return { token: issueToken(user), user: publicUser(user) };
}

// Troca de senha pelo próprio usuário (obrigatória no 1º acesso com senha provisória).
export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) throw new HttpError(404, "Usuário não encontrado.");

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new HttpError(400, "Senha atual incorreta.");

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new HttpError(400, "A nova senha deve ter ao menos 8 caracteres.");
  }
  if (newPassword === currentPassword) {
    throw new HttpError(400, "A nova senha deve ser diferente da senha provisória/atual.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false }
  });
  return { token: issueToken(updated), user: publicUser(updated) };
}
