import { z } from 'zod';

export const assignStaffSchema = z.object({
  assigneeId: z.string().min(1, 'Assignee is required'),
  instructions: z.string().optional(),
  deadlineMinutes: z.number().int().positive().optional().default(10),
});

export const declineAssignmentSchema = z.object({
  reason: z.string().min(1, 'Decline reason is required'),
});

export const updateAssignmentStatusSchema = z.object({
  status: z.enum(['EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS', 'COMPLETED']),
  notes: z.string().optional(),
  photoProofUrl: z.string().optional(),
  contentType: z.string().optional(),
  fileSize: z.number().optional(),
});
