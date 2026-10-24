import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { authRouter } from './modules/auth/auth.routes.js';
import { incidentRouter, adminIncidentRouter } from './modules/incidents/incident.routes.js';
import { assignmentRouter, adminAssignmentRouter } from './modules/assignments/assignment.routes.js';
import { serviceRequestRouter, adminServiceRequestRouter } from './modules/serviceRequests/serviceRequest.routes.js';
import { roomRouter } from './modules/rooms/room.routes.js';
import { publicReportRouter, adminPublicReportRouter } from './modules/publicReports/publicReport.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocketIO } from './realtime/socket.js';
import { startEscalationChecker } from './realtime/escalationChecker.js';

const PgStore = connectPgSimple(session);

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // Trust Render reverse proxy for secure cookies and IP forwarding
  app.set('trust proxy', 1);

  // ── Security headers
  app.use(helmet());

  // ── CORS
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      credentials: true,
    })
  );

  // ── Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Session
  const sessionMiddleware = session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: 'sessions',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  });
  app.use(sessionMiddleware);

  // ── Global rate limiting
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // ── Routes
  app.use('/api/auth', authRouter);
  app.use('/api/incidents', incidentRouter);
  app.use('/api/admin/incidents', adminIncidentRouter);
  app.use('/api/service-requests', serviceRequestRouter);
  app.use('/api/admin/service-requests', adminServiceRequestRouter);
  app.use('/api/admin/rooms', roomRouter);
  app.use('/api/staff', assignmentRouter);
  app.use('/api/assignments', assignmentRouter);
  app.use('/api/admin', adminAssignmentRouter);
  app.use('/api/public/reports', publicReportRouter);
  app.use('/api/admin/public-reports', adminPublicReportRouter);
  app.use('/api/admin', auditRouter);

  // ── Start background escalation engine
  startEscalationChecker();

  // ── Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ── Error handler (must be last)
  app.use(errorHandler);

  // ── Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });
  initSocketIO(io, sessionMiddleware);

  return { app, httpServer, io };
}
