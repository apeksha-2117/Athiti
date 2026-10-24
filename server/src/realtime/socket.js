import { registerSocketIO } from './emitter.js';
import { prisma } from '../config/prisma.js';

/**
 * Socket.IO initialisation.
 * All socket auth and room-scoping logic lives here.
 */
export function initSocketIO(io, sessionMiddleware) {
  registerSocketIO(io);

  if (sessionMiddleware) {
    io.engine.use(sessionMiddleware);
  }

  // Authenticate socket connections via session
  io.use((socket, next) => {
    const session = socket.request.session;
    if (!session?.user) {
      return next(new Error('Unauthenticated'));
    }
    socket.user = session.user;
    next();
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
