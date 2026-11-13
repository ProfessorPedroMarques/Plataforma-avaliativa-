
import prisma from "../config/database.js";

// Registra uma ação no histórico de auditoria (AuditLog).
// Nunca deve quebrar o fluxo principal: em caso de falha, apenas loga.
export async function recordAudit({ actorUserId, action, entity, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details || undefined
      }
    });
  } catch (error) {
    console.error("Falha ao registrar auditoria:", error.message);
  }
}
