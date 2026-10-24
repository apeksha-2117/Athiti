import { z } from 'zod';

export const sosSchema = z.object({
  category: z.enum([
    'FIRE_OR_SMOKE',
    'MEDICAL_EMERGENCY',
    'ELECTRICAL_HAZARD',
    'WATER_LEAKAGE',
    'SECURITY_THREAT',
    'STRUCTURAL_HAZARD',
    'OTHER',
  ]).optional().default('OTHER'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional().default('CRITICAL'),
  description: z.string().optional().default('EMERGENCY SOS ACTIVATED'),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
  }).nullable().optional(),
  photoUrl: z.string().optional(),
  contentType: z.string().optional(),
  fileSize: z.number().optional(),
});

export const createIncidentSchema = z.object({
  category: z.enum([
    'FIRE_OR_SMOKE',
    'MEDICAL_EMERGENCY',
    'ELECTRICAL_HAZARD',
    'WATER_LEAKAGE',
    'SECURITY_THREAT',
    'STRUCTURAL_HAZARD',
    'OTHER',
  ]),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional().default('HIGH'),
  photoUrl: z.string().optional(),
  contentType: z.string().optional(),
  fileSize: z.number().optional(),
});

export const updateIncidentSchema = z.object({
  category: z.enum([
    'FIRE_OR_SMOKE',
    'MEDICAL_EMERGENCY',
    'ELECTRICAL_HAZARD',
    'WATER_LEAKAGE',
    'SECURITY_THREAT',
    'STRUCTURAL_HAZARD',
    'OTHER',
  ]).optional(),
  description: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum([
    'REPORTED',
    'ACKNOWLEDGED',
    'ASSIGNED',
    'RESPONDING',
    'IN_PROGRESS',
    'ESCALATED',
    'RESOLVED',
    'CLOSED',
    'CANCELLED',
  ]).optional(),
});

export const escalateIncidentSchema = z.object({
  reason: z.string().min(1, 'Escalation reason is required'),
});

export const closeIncidentSchema = z.object({
  resolutionNote: z.string().min(1, 'Resolution note is required'),
  externalServiceContacted: z.boolean().optional(),
  externalServiceDetails: z.union([z.record(z.any()), z.string(), z.null()]).optional(),
});

export const addEventSchema = z.object({
  eventType: z.string().min(1),
  description: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});
