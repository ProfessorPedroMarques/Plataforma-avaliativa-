// Copia para o banco os arquivos enviados que ainda estão só na pasta de uploads
// (envios feitos antes do armazenamento no banco). Pode rodar mais de uma vez:
// arquivos que já estão no banco são ignorados. Uso: npm run files:to-db
import dotenv from "dotenv";
import fs from "fs";
import prisma from "../config/database.js";
import { storedPath } from "../utils/fileStorage.js";

dotenv.config();

async function main() {
  const files = await prisma.submissionFile.findMany({
    where: { content: null }, select: { id: true, storedName: true, originalName: true }
  });
  let copied = 0, missing = 0;
  for (const f of files) {
    const p = storedPath(f.storedName);
    if (!fs.existsSync(p)) { missing++; console.log(`  não encontrado em disco: ${f.originalName}`); continue; }
    await prisma.submissionFileContent.create({ data: { fileId: f.id, data: fs.readFileSync(p) } });
    copied++;
  }
  console.log(`Arquivos copiados para o banco: ${copied}. Sem arquivo em disco: ${missing}. Já estavam no banco: ignorados.`);
}

main()
  .catch(e => { console.error("Erro:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
