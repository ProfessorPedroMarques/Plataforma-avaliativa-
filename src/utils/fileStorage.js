
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Diretório de uploads FORA de qualquer pasta pública/estática.
// Configurável por variável de ambiente; nunca servido diretamente.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

// Limite global de segurança (além do limite por atividade definido pelo ADMIN).
export const GLOBAL_MAX_MB = Number(process.env.MAX_UPLOAD_MB || 100);

// Onde guardar o conteúdo dos arquivos enviados:
//  "database" (padrão): no próprio PostgreSQL — necessário em hospedagens cujo disco
//                       é apagado a cada reinício (ex.: plano gratuito do Render);
//  "disk":              na pasta UPLOAD_DIR (servidor próprio com disco permanente).
export const FILE_STORAGE = (process.env.FILE_STORAGE || "database").toLowerCase() === "disk" ? "disk" : "database";

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

// Extrai a extensão (sem ponto, minúscula) de um nome de arquivo.
export function getExtension(filename) {
  const ext = path.extname(filename || "").replace(/^\./, "").toLowerCase();
  return ext;
}

// Gera um nome interno seguro, impossível de adivinhar, preservando a extensão.
export function buildStoredName(originalName) {
  const ext = getExtension(originalName);
  const random = crypto.randomBytes(16).toString("hex");
  return ext ? `${random}.${ext}` : random;
}

export function storedPath(storedName) {
  // Impede path traversal: usa apenas o basename.
  return path.join(UPLOAD_DIR, path.basename(storedName));
}

// Remove um arquivo do disco de forma segura (ignora se não existir).
export function removeFile(storedName) {
  try {
    const p = storedPath(storedName);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (e) {
    console.error("Falha ao remover arquivo:", e.message);
  }
}

// Envia ao navegador um arquivo autorizado: primeiro procura o conteúdo no banco;
// se não houver (arquivos antigos, gravados em disco), lê da pasta de uploads.
export async function sendStoredFile(prisma, res, file) {
  const content = await prisma.submissionFileContent.findUnique({ where: { fileId: file.id } });
  const headers = () => {
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader("Cache-Control", "private, no-store");
  };
  if (content) {
    headers();
    res.setHeader("Content-Length", content.data.length);
    return res.end(Buffer.from(content.data));
  }
  const p = storedPath(file.storedName);
  if (!fs.existsSync(p)) return false;
  headers();
  fs.createReadStream(p).pipe(res);
  return true;
}
