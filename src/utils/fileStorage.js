
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Diretório de uploads FORA de qualquer pasta pública/estática.
// Configurável por variável de ambiente; nunca servido diretamente.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

// Limite global de segurança (além do limite por atividade definido pelo ADMIN).
export const GLOBAL_MAX_MB = Number(process.env.MAX_UPLOAD_MB || 100);

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
