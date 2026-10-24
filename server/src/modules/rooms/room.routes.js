import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

export const roomRouter = Router();
roomRouter.use(authenticate, authorize('ADMIN'));

// GET /api/admin/rooms (Grouped by floor)
roomRouter.get('/', async (req, res, next) => {
  try {
    const where = req.user.hotelId ? { hotelId: req.user.hotelId } : {};
    const rooms = await prisma.room.findMany({
      where,
      include: {
        stays: {
          where: { status: 'ACTIVE' },
          include: {
            guest: { select: { id: true, name: true, email: true } },
          },
        },
        incidents: {
          where: { status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
          select: { id: true, priority: true, category: true, status: true },
        },
        serviceRequests: {
          where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
          select: { id: true, priority: true, category: true, status: true },
        },
      },
      orderBy: [
        { floor: 'asc' },
        { roomNumber: 'asc' },
      ],
    });

    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/rooms/:id
roomRouter.get('/:id', async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        stays: {
          include: {
            guest: { select: { id: true, name: true, email: true } },
          },
          orderBy: { checkInAt: 'desc' },
        },
        incidents: {
          include: {
            reporter: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        serviceRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room });
  } catch (err) {
    next(err);
  }
});
