import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  sosSchema,
  createIncidentSchema,
  escalateIncidentSchema,
  closeIncidentSchema,
  addEventSchema,
} from './incident.schema.js';
import * as incidentService from './incident.service.js';

export const incidentRouter = Router();

// All incident routes require authentication
incidentRouter.use(authenticate);

// POST /api/incidents/sos (Guests only)
incidentRouter.post('/sos', authorize('GUEST'), validate(sosSchema), async (req, res, next) => {
  try {
    const incident = await incidentService.createSOS(req.user.id, req.body);
    res.status(201).json({ incident });
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents (Guests, Staff, Admin)
incidentRouter.post('/', validate(createIncidentSchema), async (req, res, next) => {
  try {
    const incident = await incidentService.createIncident(req.user, req.body);
    res.status(201).json({ incident });
  } catch (err) {
    next(err);
  }
});

// GET /api/incidents/mine (Guest's own incidents)
incidentRouter.get('/mine', authorize('GUEST'), async (req, res, next) => {
  try {
    const incidents = await incidentService.getIncidentsForGuest(req.user.id);
    res.json({ incidents });
  } catch (err) {
    next(err);
  }
});

// GET /api/incidents/:id (Role-scoped access)
incidentRouter.get('/:id', async (req, res, next) => {
  try {
    const incident = await incidentService.getIncidentById(req.params.id, req.user);
    res.json({ incident });
  } catch (err) {
    next(err);
  }
});

// POST /api/incidents/:id/events (Add notes/updates to incident)
incidentRouter.post('/:id/events', validate(addEventSchema), async (req, res, next) => {
  try {
    const event = await incidentService.addIncidentEvent(req.params.id, req.user.id, req.body);
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

// Admin-only endpoints
// GET /api/admin/incidents
export const adminIncidentRouter = Router();
adminIncidentRouter.use(authenticate, authorize('ADMIN'));

adminIncidentRouter.get('/', async (req, res, next) => {
  try {
    const incidents = await incidentService.getAdminIncidents(req.user.hotelId, req.query);
    res.json({ incidents });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/incidents/:id/escalate
adminIncidentRouter.post('/:id/escalate', validate(escalateIncidentSchema), async (req, res, next) => {
  try {
    const incident = await incidentService.escalateIncident(req.params.id, req.user.id, req.body.reason);
    res.json({ incident });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/incidents/:id/close
adminIncidentRouter.post('/:id/close', validate(closeIncidentSchema), async (req, res, next) => {
  try {
    const incident = await incidentService.closeIncident(req.params.id, req.user.id, req.body);
    res.json({ incident });
  } catch (err) {
    next(err);
  }
});
