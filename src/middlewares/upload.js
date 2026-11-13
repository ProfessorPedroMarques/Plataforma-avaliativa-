
import multer from "multer";
import { UPLOAD_DIR, GLOBAL_MAX_MB, buildStoredName, ensureUploadDir } from "../utils/fileStorage.js";

ensureUploadDir();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    // Nome interno seguro, impossível de adivinhar (não usa o nome do usuário).
    cb(null, buildStoredName(file.originalname));
  }
});

// Limite global de segurança; o limite real por atividade é validado no controller.
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: GLOBAL_MAX_MB * 1024 * 1024,
    files: 50
  }
}).array("files", 50);

// Converte erros do multer em HttpError-friendly JSON.
export function handleUpload(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: `Arquivo excede o limite global de ${GLOBAL_MAX_MB} MB.` });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ success: false, message: "Quantidade de arquivos acima do permitido." });
      }
      return res.status(400).json({ success: false, message: "Falha no upload do arquivo." });
    }
    return next();
  });
}
