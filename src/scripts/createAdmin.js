
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";

dotenv.config();

async function createAdmin() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Configure nome, e-mail e senha do administrador no .env."
    );
  }

  if (password.length < 12) {
    throw new Error(
      "A senha deve ter pelo menos 12 caracteres."
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: {
      email: normalizedEmail
    },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
      active: true
    },
    create: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: "ADMIN",
      active: true
    }
  });

  console.log("--------------------------------");
  console.log("ADMINISTRADOR CONFIGURADO");
  console.log("--------------------------------");
  console.log(`Nome: ${admin.name}`);
  console.log(`E-mail: ${admin.email}`);
  console.log("Senha: atualizada com hash.");
  console.log("--------------------------------");
}

createAdmin()
  .catch((error) => {
    console.error("Erro:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
