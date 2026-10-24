import { prisma } from '../../config/prisma.js';
import { emitToHotel, emitToRole, emitToUser } from '../../realtime/emitter.js';

export async function createSOS(guestId, { category = 'OTHER', description = 'EMERGENCY SOS ACTIVATED' }) {
  // Find guest's active stay
  const activeStay = await prisma.stay.findFirst({
    where: { guestId, status: 'ACTIVE' },
    include: { room: true },
  });

  if (!activeStay) {
    const error = new Error('No active hotel stay found for this guest');
    error.status = 400;
    throw error;
  }

  const incident = await prisma.$transaction(async (tx) => {
    const inc = await tx.incident.create({
      data: {
        hotelId: activeStay.room.hotelId,
        reporterId: guestId,
        stayId: activeStay.id,
        roomId: activeStay.roomId,
        category,
        description,
        priority: 'CRITICAL',
        status: 'REPORTED',
      },
      include: {
        room: true,
        reporter: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: inc.id,
        actorId: guestId,
        eventType: 'SOS_TRIGGERED',
        description: `SOS activated from Room ${inc.room?.roomNumber || 'Unknown'}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: guestId,
        action: 'SOS_TRIGGERED',
        entityType: 'INCIDENT',
        entityId: inc.id,
        changeSummary: { priority: 'CRITICAL', room: inc.room?.roomNumber },
      },
    });

    return inc;
  });

  // Real-time broadcast
  emitToHotel(incident.hotelId, 'incident:created', incident);
  emitToRole('ADMIN', 'incident:created', incident);
  emitToUser(guestId, 'incident:created', incident);

  return incident;
}

export async function createIncident(user, data) {
  let hotelId = user.hotelId;
  let roomId = null;
  let stayId = null;

  if (user.role === 'GUEST') {
    const activeStay = await prisma.stay.findFirst({
      where: { guestId: user.id, status: 'ACTIVE' },
      include: { room: true },
    });
    if (!activeStay) {
      const error = new Error('No active hotel stay found for this guest');
      error.status = 400;
      throw error;
    }
    hotelId = activeStay.room.hotelId;
    roomId = activeStay.roomId;
    stayId = activeStay.id;
  }

  if (!hotelId) {
    const error = new Error('Hotel identification missing');
    error.status = 400;
    throw error;
  }

  const incident = await prisma.$transaction(async (tx) => {
    const inc = await tx.incident.create({
      data: {
        hotelId,
        reporterId: user.id,
        stayId,
        roomId,
        category: data.category,
        description: data.description,
        priority: data.priority || 'HIGH',
        status: 'REPORTED',
      },
      include: {
        room: true,
        reporter: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: inc.id,
        actorId: user.id,
        eventType: 'INCIDENT_REPORTED',
        description: `Incident reported: ${data.category}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'INCIDENT_REPORTED',
        entityType: 'INCIDENT',
        entityId: inc.id,
        changeSummary: { category: data.category, priority: data.priority },
      },
    });

    return inc;
  });

  emitToHotel(incident.hotelId, 'incident:created', incident);
  emitToRole('ADMIN', 'incident:created', incident);
  emitToUser(user.id, 'incident:created', incident);

  return incident;
}

export async function getIncidentsForGuest(guestId) {
  return prisma.incident.findMany({
    where: { reporterId: guestId },
    include: {
      room: true,
      assignments: {
        include: {
          assignee: { select: { id: true, name: true, role: true } },
        },
      },
      events: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getIncidentById(id, user) {
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      room: true,
      reporter: { select: { id: true, name: true, email: true } },
      stay: true,
      assignments: {
        include: {
          assignee: { select: { id: true, name: true, role: true } },
          assignedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      events: {
        include: { actor: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
      attachments: true,
    },
  });

  if (!incident) {
    const error = new Error('Incident not found');
    error.status = 404;
    throw error;
  }

  // Access check
  if (user.role === 'GUEST' && incident.reporterId !== user.id) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  return incident;
}

export async function getAdminIncidents(hotelId, { status, priority, category } = {}) {
  const where = {};
  if (hotelId) where.hotelId = hotelId;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;

  return prisma.incident.findMany({
    where,
    include: {
      room: true,
      reporter: { select: { id: true, name: true, email: true } },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      assignments: {
        where: { status: { not: 'DECLINED' } },
        include: {
          assignee: { select: { id: true, name: true, role: true } },
        },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [
      { priority: 'asc' }, // CRITICAL first
      { createdAt: 'desc' },
    ],
  });
}

export async function escalateIncident(incidentId, adminId, reason) {
  const updated = await prisma.$transaction(async (tx) => {
    const inc = await tx.incident.update({
      where: { id: incidentId },
      data: {
        status: 'ESCALATED',
        priority: 'CRITICAL',
      },
      include: { room: true },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId,
        actorId: adminId,
        eventType: 'ESCALATED',
        description: `Escalated: ${reason}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'INCIDENT_ESCALATED',
        entityType: 'INCIDENT',
        entityId: incidentId,
        changeSummary: { reason },
      },
    });

    return inc;
  });

  emitToHotel(updated.hotelId, 'incident:updated', updated);
  emitToRole('ADMIN', 'incident:updated', updated);
  if (updated.reporterId) {
    emitToUser(updated.reporterId, 'incident:updated', updated);
  }

  return updated;
}

export async function closeIncident(incidentId, adminId, { resolutionNote, externalServiceContacted, externalServiceDetails }) {
  let detailsJson = null;
  if (externalServiceDetails) {
    detailsJson = typeof externalServiceDetails === 'string'
      ? { notes: externalServiceDetails }
      : externalServiceDetails;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const inc = await tx.incident.update({
      where: { id: incidentId },
      data: {
        status: 'CLOSED',
        resolutionNote,
        externalServiceContacted: !!externalServiceContacted,
        externalServiceDetails: detailsJson,
        closedAt: new Date(),
        resolvedAt: new Date(),
      },
      include: { room: true },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId,
        actorId: adminId,
        eventType: 'CLOSED',
        description: `Closed with resolution: ${resolutionNote}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'INCIDENT_CLOSED',
        entityType: 'INCIDENT',
        entityId: incidentId,
        changeSummary: { resolutionNote, externalServiceContacted },
      },
    });

    return inc;
  });

  emitToHotel(updated.hotelId, 'incident:updated', updated);
  emitToRole('ADMIN', 'incident:updated', updated);
  if (updated.reporterId) {
    emitToUser(updated.reporterId, 'incident:updated', updated);
  }

  return updated;
}

export async function addIncidentEvent(incidentId, actorId, { eventType, description, metadata }) {
  const event = await prisma.incidentEvent.create({
    data: {
      incidentId,
      actorId,
      eventType,
      description,
      metadata: metadata || null,
    },
    include: {
      actor: { select: { id: true, name: true, role: true } },
    },
  });

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (incident) {
    emitToHotel(incident.hotelId, 'incident:event_added', { incidentId, event });
  }

  return event;
}
