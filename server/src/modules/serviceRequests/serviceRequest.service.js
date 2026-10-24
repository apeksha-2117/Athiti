import { prisma } from '../../config/prisma.js';
import { emitToHotel, emitToRole, emitToUser } from '../../realtime/emitter.js';
import { logAudit, TX_OPTIONS } from '../../utils/auditLogger.js';

export async function createServiceRequest(user, data) {
  // Find guest's active stay
  const activeStay = await prisma.stay.findFirst({
    where: { guestId: user.id, status: 'ACTIVE' },
    include: { room: true },
  });

  if (!activeStay) {
    const error = new Error('No active stay found for this guest');
    error.status = 400;
    throw error;
  }

  const req = await prisma.$transaction(async (tx) => {
    const newReq = await tx.serviceRequest.create({
      data: {
        hotelId: activeStay.room.hotelId,
        guestId: user.id,
        stayId: activeStay.id,
        roomId: activeStay.roomId,
        category: data.category,
        description: data.description,
        priority: data.priority || 'LOW',
        status: 'SUBMITTED',
      },
      include: {
        room: true,
      },
    });

    if (data.photoUrl) {
      await tx.attachment.create({
        data: {
          serviceRequestId: newReq.id,
          uploadedById: user.id,
          storageKey: data.photoUrl,
          contentType: data.contentType || 'image/jpeg',
          fileSize: data.fileSize || 0,
        },
      });
    }

    await tx.serviceRequestEvent.create({
      data: {
        serviceRequestId: newReq.id,
        actorId: user.id,
        eventType: 'REQUEST_SUBMITTED',
        description: `Routine service request submitted: ${data.category}${data.photoUrl ? ' [Photo Attached]' : ''}`,
      },
    });

    return tx.serviceRequest.findUnique({
      where: { id: newReq.id },
      include: {
        room: true,
        attachments: {
          include: { uploadedBy: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }, TX_OPTIONS);

  logAudit({
    actorId: user.id,
    action: 'SERVICE_REQUEST_CREATED',
    entityType: 'SERVICE_REQUEST',
    entityId: req.id,
    changeSummary: { category: data.category, room: req.room?.roomNumber, photoUrl: data.photoUrl || undefined },
  });

  emitToHotel(req.hotelId, 'service_request:created', req);
  emitToRole('ADMIN', 'service_request:created', req);
  emitToUser(user.id, 'service_request:created', req);

  return req;
}

export async function getGuestServiceRequests(guestId) {
  return prisma.serviceRequest.findMany({
    where: { guestId },
    include: {
      room: true,
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
      assignments: {
        include: {
          assignee: { select: { id: true, name: true } },
        },
      },
      events: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAdminServiceRequests(hotelId) {
  const where = hotelId ? { hotelId } : {};
  return prisma.serviceRequest.findMany({
    where,
    include: {
      room: true,
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
      assignments: {
        include: {
          assignee: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function assignServiceRequest(serviceRequestId, adminId, { assigneeId, instructions }) {
  const req = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
  });

  if (!req) {
    const error = new Error('Service request not found');
    error.status = 404;
    throw error;
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const asgn = await tx.assignment.create({
      data: {
        serviceRequestId,
        assigneeId,
        assignedById: adminId,
        instructions,
        status: 'PENDING',
      },
      include: {
        assignee: { select: { id: true, name: true } },
        serviceRequest: { include: { room: true } },
      },
    });

    await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { status: 'ASSIGNED' },
    });

    await tx.serviceRequestEvent.create({
      data: {
        serviceRequestId,
        actorId: adminId,
        eventType: 'ASSIGNED',
        description: `Assigned to ${asgn.assignee.name}`,
      },
    });

    return asgn;
  }, TX_OPTIONS);

  emitToUser(assigneeId, 'assignment:created', assignment);
  emitToRole('ADMIN', 'service_request:updated', assignment.serviceRequest);
  emitToUser(req.guestId, 'service_request:updated', assignment.serviceRequest);

  return assignment;
}
