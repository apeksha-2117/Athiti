import { registerSocketIO } from './emitter.js';
import { prisma } from '../config/prisma.js';
import { verifyToken } from '../utils/token.js';

/**
 * Socket.IO initialisation.
 * All socket auth and room-scoping logic lives here.
 */
export function initSocketIO(io, sessionMiddleware) {
  registerSocketIO(io);

  if (sessionMiddleware) {
    io.engine.use(sessionMiddleware);
  }

  // Authenticate socket connections via token or session
  io.use((socket, next) => {
    // 1. Try bearer token from auth object or handshake query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        socket.user = payload;
        return next();
      }
    }

    // 2. Fall back to express-session
    const session = socket.request.session;
    if (session?.user) {
      socket.user = session.user;
      return next();
    }

    return next(new Error('Unauthenticated'));
  });

  io.on('connection', async (socket) => {
    const { id, role } = socket.user;
    let hotelId = socket.user.hotelId;

    if (!hotelId && role === 'GUEST') {
      const activeStay = await prisma.stay.findFirst({
        where: { guestId: id, status: 'ACTIVE' },
        include: { room: true },
      });
      if (activeStay?.room?.hotelId) {
        hotelId = activeStay.room.hotelId;
      }
    }

    if (hotelId) {
      socket.join(`hotel:${hotelId}`);
    }
    socket.join(`role:${role}`);
    socket.join(`user:${id}`);

    socket.on('disconnect', () => {
      // cleanup handled automatically by Socket.IO
    });
  });
}
