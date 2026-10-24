import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
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
    // Default to Grand Athithi Hotel for hackathon MVP
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

    // Notify control room
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
