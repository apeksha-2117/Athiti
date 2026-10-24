import { prisma } from '../config/prisma.js';
import { emitToRole, emitToHotel } from './emitter.js';

let intervalId = null;

export function startEscalationChecker(intervalMs = 15000) {
  if (intervalId) return;

  intervalId = setInterval(async () => {
    try {
      const now = new Date();

      // Find pending assignments where deadline has expired
      const overdueAssignments = await prisma.assignment.findMany({
        where: {
          status: 'PENDING',
          deadlineAt: { lt: now },
          incidentId: { not: null },
        },
        include: {
          incident: { include: { room: true } },
          assignee: { select: { id: true, name: true } },
        },
      });

      for (const asgn of overdueAssignments) {
        if (!asgn.incidentId) continue;

        // Skip if already escalated
        if (asgn.incident.status === 'ESCALATED') continue;

        await prisma.$transaction(async (tx) => {
          await tx.incident.update({
            where: { id: asgn.incidentId },
            data: {
              status: 'ESCALATED',
              priority: 'CRITICAL',
            },
          });

          await tx.incidentEvent.create({
            data: {
              incidentId: asgn.incidentId,
              eventType: 'AUTOMATED_ESCALATION',
              description: `Automated Escalation: Assignment to ${asgn.assignee.name} was not acknowledged within deadline.`,
            },
          });

          await tx.auditLog.create({
            data: {
              action: 'AUTOMATED_ASSIGNMENT_ESCALATED',
              entityType: 'ASSIGNMENT',
              entityId: asgn.id,
              changeSummary: {
                reason: 'Acknowledgement deadline exceeded',
                assignee: asgn.assignee.name,
              },
            },
          });
        });

        // Broadcast escalation alert
        emitToRole('ADMIN', 'assignment:escalated', {
          assignmentId: asgn.id,
          incidentId: asgn.incidentId,
          assignee: asgn.assignee.name,
          room: asgn.incident.room?.roomNumber,
        });

        emitToHotel(asgn.incident.hotelId, 'incident:updated', {
          id: asgn.incidentId,
          status: 'ESCALATED',
          priority: 'CRITICAL',
        });
      }
    } catch (err) {
      console.error('Error in escalation checker:', err);
    }
  }, intervalMs);
}

export function stopEscalationChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
