
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

import prisma from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET deve possuir pelo menos 32 caracteres.");
}

const allowedOrigins = (
  process.env.FRONTEND_URL || "http://127.0.0.1:5500"
).split(",").map(origin => origin.trim());

app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origem não autorizada pelo CORS."));
  }
}));

app.use(express.json({ limit: "10kb" }));

// Rota inicial
app.get("/", (req, res) => {
  res.json({
    message: "API da Plataforma de Avaliação",
    version: "1.0.0",
    status: "online"
  });
});

// Verificação do servidor e banco
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      server: "online",
      database: "connected",
      message: "Sistema funcionando corretamente."
    });

  } catch (error) {
    console.error("Erro na verificação:", error);

    return res.status(503).json({
      success: false,
      server: "online",
      database: "disconnected",
      message: "Não foi possível conectar ao banco."
    });
  }
});

// Rotas de autenticação
app.use("/api/auth", authRoutes);

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Rota não encontrada."
  });
});

// Tratamento de erros gerais
app.use((error, req, res, next) => {
  console.error("Erro na API:", error.message);

  if (error.message === "Origem não autorizada pelo CORS.") {
    return res.status(403).json({
      success: false,
      message: "Origem não autorizada."
    });
  }

  return res.status(500).json({
    success: false,
    message: "Erro interno do servidor."
  });
});

// Inicialização
async function startServer() {
  try {
    await prisma.$connect();

    const server = app.listen(PORT, () => {
      console.log("--------------------------------");
      console.log("PLATAFORMA DE AVALIAÇÃO");
      console.log("--------------------------------");
      console.log(`Servidor: http://localhost:${PORT}`);
      console.log("Banco de dados: conectado");
      console.log("Autenticação: habilitada");
      console.log("--------------------------------");
    });

    async function shutdown() {
      console.log("Encerrando servidor...");

      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (error) {
    console.error("Erro ao iniciar servidor:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
