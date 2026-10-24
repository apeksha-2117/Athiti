import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createServiceRequestSchema,
  assignServiceRequestSchema,
} from './serviceRequest.schema.js';
import * as srService from './serviceRequest.service.js';

export const serviceRequestRouter = Router();
serviceRequestRouter.use(authenticate);

// POST /api/service-requests (Guest create routine request)
serviceRequestRouter.post('/', authorize('GUEST'), validate(createServiceRequestSchema), async (req, res, next) => {
  try {
    const request = await srService.createServiceRequest(req.user, req.body);
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
});

// GET /api/service-requests/mine (Guest list)
serviceRequestRouter.get('/mine', authorize('GUEST'), async (req, res, next) => {
  try {
    const requests = await srService.getGuestServiceRequests(req.user.id);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// Admin routes
export const adminServiceRequestRouter = Router();
adminServiceRequestRouter.use(authenticate, authorize('ADMIN'));

// GET /api/admin/service-requests
adminServiceRequestRouter.get('/', async (req, res, next) => {
  try {
    const requests = await srService.getAdminServiceRequests(req.user.hotelId);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/service-requests/:id/assign
adminServiceRequestRouter.post('/:id/assign', validate(assignServiceRequestSchema), async (req, res, next) => {
  try {
    const assignment = await srService.assignServiceRequest(req.params.id, req.user.id, req.body);
    res.status(201).json({ assignment });
  } catch (err) {
    next(err);
  }
});
