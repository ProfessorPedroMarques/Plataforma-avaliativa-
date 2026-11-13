
// Utilitários HTTP compartilhados pelos controllers.

// Envolve um handler async e encaminha erros para o error handler do Express.
export function asyncHandler(handler) {
  return function (req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Erro de domínio com status HTTP associado.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function ok(res, data, message = "Operação realizada com sucesso.") {
  return res.status(200).json({ success: true, message, data });
}

export function created(res, data, message = "Registro criado com sucesso.") {
  return res.status(201).json({ success: true, message, data });
}

// Validações simples e reutilizáveis.
export function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Campo obrigatório inválido: ${field}.`);
  }
  return value.trim();
}

export function optionalString(value, field) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpError(400, `Campo inválido: ${field}.`);
  }
  return value.trim();
}

export function requireNumber(value, field, { min, max } = {}) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new HttpError(400, `Campo numérico inválido: ${field}.`);
  }
  if (min !== undefined && n < min) {
    throw new HttpError(400, `${field} deve ser no mínimo ${min}.`);
  }
  if (max !== undefined && n > max) {
    throw new HttpError(400, `${field} deve ser no máximo ${max}.`);
  }
  return n;
}

export function optionalDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(400, `Data inválida: ${field}.`);
  }
  return d;
}
