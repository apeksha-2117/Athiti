import { registerSocketIO } from './emitter.js';
import { prisma } from '../config/prisma.js';
import { verifyToken } from '../utils/token.js';
import { DEFAULT_STAFF_SECTORS } from '../modules/dispatch/proximity.js';

// In-memory registry for live staff positions
const staffLivePositions = {};

export function getActiveStaffPositions() {
  return staffLivePositions;
}

export function setStaffPosition(staffId, pos) {
  staffLivePositions[staffId] = {
    ...staffLivePositions[staffId],
    ...pos,
    updatedAt: new Date().toISOString(),
  };
  return staffLivePositions[staffId];
}

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
    const { id, role, email } = socket.user;
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

    // If staff user, seed default sector if not yet set
    if (role === 'STAFF' && !staffLivePositions[id] && email && DEFAULT_STAFF_SECTORS[email]) {
      staffLivePositions[id] = {
        staffId: id,
        email,
        name: socket.user.name,
        ...DEFAULT_STAFF_SECTORS[email],
        updatedAt: new Date().toISOString(),
      };
    }

    // Send current staff positions to newly connected admin or staff
    socket.emit('staff:positions', staffLivePositions);

    // Listen for real-time staff location change
    socket.on('staff:update_location', (data) => {
      if (role === 'STAFF') {
        const updated = setStaffPosition(id, {
          staffId: id,
          email,
          name: socket.user.name,
          ...data,
        });
        if (hotelId) {
          io.to(`hotel:${hotelId}`).emit('staff:positions', staffLivePositions);
        } else {
          io.emit('staff:positions', staffLivePositions);
        }
      }
    });

    socket.on('disconnect', () => {
      // cleanup handled automatically by Socket.IO
    });
  });
}
