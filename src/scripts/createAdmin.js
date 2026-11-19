
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
  // Por padrão só CRIA o administrador se ele ainda não existir: assim este script pode
  // rodar em toda atualização do site sem desfazer a senha trocada pelo admin.
  // Para redefinir a senha com a do .env/variáveis de ambiente: npm run admin:create -- --reset
  const reset = process.argv.includes("--reset");
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing && !reset) {
    console.log(`Administrador ${normalizedEmail} já existe; nada foi alterado (use --reset para redefinir a senha).`);
    return;
  }

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
  console.log(existing ? "Senha: redefinida." : "Senha: definida.");
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
