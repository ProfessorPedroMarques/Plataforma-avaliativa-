
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

import prisma from "./config/database.js";
import { syncCourse } from "./services/courseService.js";
import authRoutes from "./routes/authRoutes.js";
import rubricRoutes from "./routes/rubricRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET deve possuir pelo menos 32 caracteres.");
}

const allowedOrigins = (
  process.env.FRONTEND_URL || "http://127.0.0.1:5500"
).split(",").map(origin => origin.trim()).filter(Boolean);
// No Render, o endereço público do serviço vem nesta variável (site e API no mesmo endereço).
if (process.env.RENDER_EXTERNAL_URL) allowedOrigins.push(process.env.RENDER_EXTERNAL_URL.replace(/\/$/, ""));

// Atrás de um proxy (Render e afins), usa o IP real de cada usuário. Sem isso, todos
// os acessos pareceriam vir do mesmo IP e o limite de tentativas de login bloquearia a escola inteira.
if (process.env.TRUST_PROXY || process.env.RENDER) app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'"],
      // As telas usam onclick="..." nos botões.
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'", ...allowedOrigins.filter(o => /^https?:\/\//.test(o))],
      // Navegador e servidor no mesmo endereço; não força https quando roda localmente.
      "upgrade-insecure-requests": process.env.RENDER ? [] : null
    }
  }
}));

// CORS: libera o próprio endereço do site (mesma origem) e os endereços de FRONTEND_URL.
app.use(cors((req, callback) => {
  const origin = req.header("Origin");
  const self = `${req.protocol}://${req.get("host")}`;
  if (!origin || origin === self || allowedOrigins.includes(origin)) return callback(null, { origin: true });
  return callback(new Error("Origem não autorizada pelo CORS."));
}));

// Telas da plataforma (HTML/CSS/JS/imagens). Só estas pastas são públicas;
// código do servidor, .env e uploads nunca são servidos.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticOpts = { maxAge: "1h", index: false };
app.use("/css", express.static(path.join(ROOT, "css"), staticOpts));
app.use("/js", express.static(path.join(ROOT, "js"), staticOpts));
app.use("/img", express.static(path.join(ROOT, "img"), { ...staticOpts, maxAge: "7d" }));
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(ROOT, "index.html")));

app.use(express.json({ limit: "10kb" }));

// Informações da API
app.get("/api", (req, res) => {
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

// Rotas administrativas/pedagógicas
app.use("/api/rubrics", rubricRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/admin", adminRoutes);

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Rota não encontrada."
  });
});

// Tratamento de erros gerais
app.use((error, req, res, next) => {
  if (error.message === "Origem não autorizada pelo CORS.") {
    return res.status(403).json({
      success: false,
      message: "Origem não autorizada."
    });
  }

  // Erros de domínio (HttpError) carregam status e mensagem seguros para o cliente.
  if (error && typeof error.status === "number") {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    });
  }

  // Erros conhecidos do Prisma (ex.: violação de unicidade/relacionamento).
  if (error && typeof error.code === "string" && error.code.startsWith("P")) {
    console.error("Erro Prisma:", error.code, error.message);
    const map = { P2002: [409, "Registro duplicado."], P2025: [404, "Registro relacionado não encontrado."], P2003: [400, "Referência inválida."] };
    const [status, message] = map[error.code] || [400, "Erro de banco de dados."];
    return res.status(status).json({ success: false, message });
  }

  console.error("Erro na API:", error.message);
  return res.status(500).json({
    success: false,
    message: "Erro interno do servidor."
  });
});

// Inicialização
async function startServer() {
  try {
    await prisma.$connect();

    // Turma/matéria únicas (Desenvolvimento de Sistemas) e matrícula automática dos alunos.
    const course = await syncCourse();

    const server = app.listen(PORT, () => {
      console.log("--------------------------------");
      console.log("PLATAFORMA DE AVALIAÇÃO");
      console.log("--------------------------------");
      console.log(`Servidor: http://localhost:${PORT}`);
      console.log("Banco de dados: conectado");
      console.log(`Curso: ${course.className} (${course.enrolled} aluno(s) matriculado(s) agora)`);
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
