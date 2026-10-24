import { z } from 'zod';

export const createServiceRequestSchema = z.object({
  category: z.enum([
    'MAINTENANCE_PLUMBING',
    'ELECTRICAL_APPLIANCE',
    'HOUSEKEEPING',
    'EXTRA_AMENITIES',
    'GENERAL_ASSISTANCE',
  ]),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional().default('LOW'),
  photoUrl: z.string().optional(),
  contentType: z.string().optional(),
  fileSize: z.number().optional(),
});

export const assignServiceRequestSchema = z.object({
  assigneeId: z.string().min(1, 'Assignee is required'),
  instructions: z.string().optional(),
});
