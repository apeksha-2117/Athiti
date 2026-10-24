import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  assignStaffSchema,
  declineAssignmentSchema,
  updateAssignmentStatusSchema,
} from './assignment.schema.js';
import * as assignmentService from './assignment.service.js';
import { getActiveStaffPositions, setStaffPosition } from '../../realtime/socket.js';
import { getIO } from '../../realtime/emitter.js';

export const assignmentRouter = Router();

assignmentRouter.use(authenticate);

// GET /api/staff/locations (Active staff positions)
assignmentRouter.get('/locations', async (_req, res) => {
  res.json({ positions: getActiveStaffPositions() });
});

// POST /api/staff/location (Staff update patrol location)
assignmentRouter.post('/location', authorize('STAFF'), async (req, res) => {
  const { floor = 1, x = 500, y = 310, sector = 'Patrol Sector' } = req.body;
  const updated = setStaffPosition(req.user.id, {
    staffId: req.user.id,
    email: req.user.email,
    name: req.user.name,
    floor,
    x,
    y,
    sector,
  });

  const io = getIO();
  if (io) {
    io.emit('staff:positions', getActiveStaffPositions());
  }

  res.json({ position: updated });
});

// GET /api/staff/tasks (Staff tasks)
assignmentRouter.get('/tasks', authorize('STAFF'), async (req, res, next) => {
  try {
    const tasks = await assignmentService.getStaffTasks(req.user.id);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

// POST /api/assignments/:id/acknowledge (Staff acknowledge)
assignmentRouter.post('/:id/acknowledge', authorize('STAFF'), async (req, res, next) => {
  try {
    const assignment = await assignmentService.acknowledgeAssignment(req.params.id, req.user.id);
    res.json({ assignment });
  } catch (err) {
    next(err);
  }
});

// POST /api/assignments/:id/decline (Staff decline)
assignmentRouter.post('/:id/decline', authorize('STAFF'), validate(declineAssignmentSchema), async (req, res, next) => {
  try {
    const assignment = await assignmentService.declineAssignment(req.params.id, req.user.id, req.body.reason);
    res.json({ assignment });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/assignments/:id/status (Staff update status)
assignmentRouter.patch('/:id/status', authorize('STAFF'), validate(updateAssignmentStatusSchema), async (req, res, next) => {
  try {
    const assignment = await assignmentService.updateAssignmentStatus(req.params.id, req.user.id, req.body);
    res.json({ assignment });
  } catch (err) {
    next(err);
  }
});

// Admin-only endpoints for assignments
export const adminAssignmentRouter = Router();
adminAssignmentRouter.use(authenticate, authorize('ADMIN'));

// GET /api/admin/staff (Eligible staff list)
adminAssignmentRouter.get('/staff', async (req, res, next) => {
  try {
    const staff = await assignmentService.getEligibleStaff(req.user.hotelId);
    res.json({ staff });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/staff/locations (Active staff positions)
adminAssignmentRouter.get('/staff/locations', async (_req, res) => {
  res.json({ positions: getActiveStaffPositions() });
});

// POST /api/admin/incidents/:id/assign
adminAssignmentRouter.post('/incidents/:id/assign', validate(assignStaffSchema), async (req, res, next) => {
  try {
    const assignment = await assignmentService.assignIncident(req.params.id, req.user.id, req.body);
    res.status(201).json({ assignment });
  } catch (err) {
    next(err);
  }
});
