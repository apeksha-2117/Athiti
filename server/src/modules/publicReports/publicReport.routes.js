import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { emitToRole, emitToHotel } from '../../realtime/emitter.js';

export const publicReportRouter = Router();

const publicReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many reports submitted. Please contact hotel front desk.' },
});

const publicReportSchema = z.object({
  category: z.enum([
    'FIRE_OR_SMOKE',
    'MEDICAL_EMERGENCY',
    'ELECTRICAL_HAZARD',
    'WATER_LEAKAGE',
    'SECURITY_THREAT',
    'STRUCTURAL_HAZARD',
    'OTHER',
  ]),
  description: z.string().min(3, 'Description required').max(1000),
  location: z.string().min(2, 'Location required').max(200),
});

publicReportRouter.post('/', publicReportLimiter, validate(publicReportSchema), async (req, res, next) => {
  try {
    const hotel = await prisma.hotel.findFirst();
    if (!hotel) {
      return res.status(500).json({ error: 'Hotel not configured' });
    }

    const report = await prisma.publicReport.create({
      data: {
        hotelId: hotel.id,
        category: req.body.category,
        description: req.body.description,
        location: req.body.location,
        status: 'UNVERIFIED',
      },
    });

    emitToRole('ADMIN', 'public_report:created', report);
    emitToHotel(hotel.id, 'public_report:created', report);

    res.status(201).json({
      message: 'Report received by hotel control room',
      reference: report.reference,
      report,
    });
  } catch (err) {
    next(err);
  }
});

// Admin Review Endpoints
export const adminPublicReportRouter = Router();
adminPublicReportRouter.use(authenticate, authorize('ADMIN'));

adminPublicReportRouter.get('/', async (req, res, next) => {
  try {
    const reports = await prisma.publicReport.findMany({
      where: { hotelId: req.user.hotelId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  action: z.enum(['ESCALATE', 'DISMISS']),
  reviewNote: z.string().min(1, 'Review note required'),
});

adminPublicReportRouter.post('/:id/review', validate(reviewSchema), async (req, res, next) => {
  try {
    const { action, reviewNote } = req.body;
    const report = await prisma.publicReport.findUnique({
      where: { id: req.params.id },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    let createdIncident = null;

    const updated = await prisma.$transaction(async (tx) => {
      const targetStatus = action === 'ESCALATE' ? 'ESCALATED' : 'DISMISSED';

      const rep = await tx.publicReport.update({
        where: { id: req.params.id },
        data: {
          status: targetStatus,
          reviewNote,
          reviewedAt: new Date(),
        },
      });

      if (action === 'ESCALATE') {
        createdIncident = await tx.incident.create({
          data: {
            hotelId: report.hotelId,
            publicReporterRef: report.reference,
            category: report.category,
            description: `[PUBLIC REPORT ${report.reference}] Location: ${report.location}. Details: ${report.description}`,
            priority: 'HIGH',
            verificationStatus: 'VERIFIED',
            status: 'REPORTED',
          },
          include: {
            room: true,
            reporter: { select: { id: true, name: true, email: true } },
          },
        });

        await tx.incidentEvent.create({
          data: {
            incidentId: createdIncident.id,
            actorId: req.user.id,
            eventType: 'PUBLIC_REPORT_VERIFIED',
            description: `Public report ${report.reference} verified and escalated into active incident: ${reviewNote}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: `PUBLIC_REPORT_${action}`,
          entityType: 'PUBLIC_REPORT',
          entityId: report.id,
          changeSummary: { action, reviewNote },
        },
      });

      return rep;
    });

    if (createdIncident) {
      emitToHotel(report.hotelId, 'incident:created', createdIncident);
      emitToRole('ADMIN', 'incident:created', createdIncident);
    }

    emitToRole('ADMIN', 'public_report:updated', updated);

    res.json({ report: updated, incident: createdIncident });
  } catch (err) {
    next(err);
  }
});
