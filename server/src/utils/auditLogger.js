import { prisma } from '../config/prisma.js';

export const TX_OPTIONS = {
  maxWait: 15000, // 15 seconds to acquire connection from pool
  timeout: 30000, // 30 seconds transaction execution
};

/**
 * Robust non-blocking Audit Logger.
 * Executes outside interactive transactions to prevent transaction timeouts
 * and engine transaction-not-found errors during cloud deployment.
 */
export async function logAudit({ actorId, action, entityType, entityId, changeSummary }) {
  try {
    let sanitizedSummary = null;
    if (changeSummary !== undefined && changeSummary !== null) {
      sanitizedSummary = JSON.parse(JSON.stringify(changeSummary));
    }

    return await prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entityType,
        entityId,
        changeSummary: sanitizedSummary,
      },
    });
  } catch (err) {
    console.warn(`[AUDIT_LOG_WARNING] Could not persist audit record for ${action} (${entityType}:${entityId}):`, err.message);
    return null;
  }
}
