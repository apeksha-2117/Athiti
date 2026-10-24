import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

export const auditRouter = Router();
auditRouter.use(authenticate, authorize('ADMIN'));

// GET /api/admin/audit-logs
auditRouter.get('/audit-logs', async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        actor: { select: { id: true, name: true, role: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/incidents/:id/summary (AI / Rule-based Situation Summary, PRD FR-040)
auditRouter.get('/incidents/:id/summary', async (req, res, next) => {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: {
        room: true,
        reporter: { select: { id: true, name: true } },
        assignments: {
          include: {
            assignee: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        events: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Synthesize structured situation briefing adhering strictly to PRD FR-040:
    // Distinguishes verified facts, claims, and unresolved questions.
    const verifiedFacts = [];
    const unresolvedQuestions = [];
    const recommendedActions = [];

    // Facts
    verifiedFacts.push(`Incident category: ${incident.category.replace(/_/g, ' ')} with priority ${incident.priority}.`);
    if (incident.room) {
      verifiedFacts.push(`Associated location: Room ${incident.room.roomNumber} on Floor ${incident.room.floor}.`);
    }
    if (incident.publicReporterRef) {
      verifiedFacts.push(`Initiated via public hazard report ref: ${incident.publicReporterRef}.`);
    }
    if (incident.assignments && incident.assignments[0]) {
      const a = incident.assignments[0];
      verifiedFacts.push(`Assigned responder: ${a.assignee?.name} (Status: ${a.status}).`);
    }
    if (incident.externalServiceContacted) {
      verifiedFacts.push(`External emergency services were contacted.`);
    }

    // Unresolved
    if (incident.status === 'REPORTED') {
      unresolvedQuestions.push(`No responder assigned yet. Initial verification pending.`);
      recommendedActions.push(`Dispatch nearest on-duty security or maintenance personnel.`);
    } else if (incident.status === 'ASSIGNED') {
      unresolvedQuestions.push(`Responder has not yet acknowledged the dispatch.`);
      recommendedActions.push(`Monitor acknowledgement deadline; escalate if no response within 5 minutes.`);
    } else if (incident.status === 'RESPONDING' || incident.status === 'IN_PROGRESS') {
      unresolvedQuestions.push(`On-scene resolution pending. Full cause of hazard not yet recorded.`);
      recommendedActions.push(`Await responder inspection update.`);
    }

    if (!incident.externalServiceContacted && ['FIRE_OR_SMOKE', 'STRUCTURAL_HAZARD'].includes(incident.category)) {
      recommendedActions.push(`Evaluate whether municipal emergency services (Fire / Police) require backup notification.`);
    }

    if (incident.status === 'RESOLVED') {
      recommendedActions.push(`Perform final control-room closure verification note.`);
    }

    const summary = {
      incidentId: incident.id,
      generatedAt: new Date().toISOString(),
      status: incident.status,
      priority: incident.priority,
      verifiedFacts,
      unresolvedQuestions,
      recommendedActions,
      disclaimer: "AI situation briefing generated from authoritative audit records. Human operator verification required before closure.",
    };

    res.json({ summary });
  } catch (err) {
    next(err);
  }
});
