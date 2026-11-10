
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";

export async function authenticateUser(email, password) {
  const user = await prisma.user.findUnique({
    where: {
      email: email.toLowerCase().trim()
    }
  });

  // Mensagem genérica para não revelar se o e-mail existe.
  if (!user || !user.active) {
    return null;
  }

  const passwordIsValid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordIsValid) {
    return null;
  }

  const token = jwt.sign(
    {
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      issuer: "plataforma-avaliacao"
    }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}
