import { prisma } from '../../config/prisma.js';
import { emitToHotel, emitToRole, emitToUser } from '../../realtime/emitter.js';
import { findNearestResponder } from '../dispatch/proximity.js';
import { getActiveStaffPositions } from '../../realtime/socket.js';
import { logAudit, TX_OPTIONS } from '../../utils/auditLogger.js';

export async function createSOS(guestId, { category = 'OTHER', priority = 'CRITICAL', description = 'EMERGENCY SOS ACTIVATED', coordinates, photoUrl }) {
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

  const hotelId = activeStay.room.hotelId;

  // Resolve nearest on-duty staff member based on proximity
  const nearestResponder = await findNearestResponder(hotelId, {
    roomNumber: activeStay.room.roomNumber,
    coordinates,
    category,
    priority,
    activeStaffPositions: getActiveStaffPositions(),
  });

  // Find hotel admin to record as assigner
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN', hotelId },
  });

  let createdAssignment = null;
  let createdAttachment = null;

  const incident = await prisma.$transaction(async (tx) => {
    let finalDescription = description;
    if (coordinates?.latitude && coordinates?.longitude) {
      finalDescription = `${description} [GPS: ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)} ±${Math.round(coordinates.accuracy || 0)}m]`;
    }

    const initialStatus = nearestResponder ? 'ASSIGNED' : 'REPORTED';

    const inc = await tx.incident.create({
      data: {
        hotelId,
        reporterId: guestId,
        stayId: activeStay.id,
        roomId: activeStay.roomId,
        category,
        description: finalDescription,
        priority,
        status: initialStatus,
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
        description: `SOS (${priority}) activated from Room ${inc.room?.roomNumber || 'Unknown'}`,
      },
    });

    if (coordinates?.photoUrl || photoUrl) {
      const pUrl = coordinates?.photoUrl || photoUrl;
      createdAttachment = await tx.attachment.create({
        data: {
          incidentId: inc.id,
          uploadedById: guestId,
          storageKey: pUrl,
          contentType: 'image/jpeg',
          fileSize: 0,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, role: true } },
        },
      });
    }

    if (coordinates?.latitude && coordinates?.longitude) {
      const mapsUrl = `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`;
      await tx.incidentEvent.create({
        data: {
          incidentId: inc.id,
          actorId: guestId,
          eventType: 'GPS_COORDINATES_CAPTURED',
          description: `Device coordinates: ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)} (±${Math.round(coordinates.accuracy || 0)}m)`,
          metadata: { ...coordinates, mapsUrl },
        },
      });
    }

    // ── DYNAMIC AUTOMATIC PROXIMITY DISPATCH ──
    if (nearestResponder?.staff) {
      const instructions = `DYNAMIC PROXIMITY DISPATCH: Nearest responder (~${nearestResponder.estimatedMeters}m from Room ${inc.room?.roomNumber}). Proceed immediately!`;

      createdAssignment = await tx.assignment.create({
        data: {
          incidentId: inc.id,
          assigneeId: nearestResponder.staff.id,
          assignedById: adminUser?.id || guestId,
          instructions,
          deadlineAt: new Date(Date.now() + 10 * 60 * 1000),
          status: 'PENDING',
        },
        include: {
          assignee: { select: { id: true, name: true, role: true, email: true } },
          assignedBy: { select: { id: true, name: true } },
          incident: { include: { room: true } },
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: inc.id,
          actorId: nearestResponder.staff.id,
          eventType: 'AUTO_DISPATCHED',
          description: `Dispatched nearest responder ${nearestResponder.staff.name} (${nearestResponder.position.sector || 'Patrol Sector'} • ~${nearestResponder.estimatedMeters}m away)`,
          metadata: {
            nearestStaff: nearestResponder.staff,
            distanceMeters: nearestResponder.estimatedMeters,
            staffPosition: nearestResponder.position,
          },
        },
      });
    }

    return inc;
  }, TX_OPTIONS);

  // Non-blocking safe audit log (executed outside transaction to eliminate timeouts)
  logAudit({
    actorId: guestId,
    action: 'SOS_TRIGGERED',
    entityType: 'INCIDENT',
    entityId: incident.id,
    changeSummary: {
      priority,
      room: incident.room?.roomNumber || null,
      coordinates: coordinates || null,
      autoDispatchedTo: nearestResponder?.staff?.name || null,
      proximityMeters: nearestResponder?.estimatedMeters || null,
    },
  });

  // Attach assignments and responder metadata for immediate frontend consumption
  incident.assignments = createdAssignment ? [createdAssignment] : [];
  incident.attachments = createdAttachment ? [createdAttachment] : [];
  incident.autoDispatchedTo = nearestResponder ? {
    staff: nearestResponder.staff,
    position: nearestResponder.position,
    estimatedMeters: nearestResponder.estimatedMeters,
  } : null;

  // Real-time broadcast
  emitToHotel(incident.hotelId, 'incident:created', incident);
  emitToRole('ADMIN', 'incident:created', incident);
  emitToUser(guestId, 'incident:created', incident);

  // If a staff member was auto-dispatched, send them an urgent dispatch alert
  if (createdAssignment && nearestResponder?.staff) {
    emitToUser(nearestResponder.staff.id, 'assignment:new', createdAssignment);
    emitToUser(nearestResponder.staff.id, 'assignment:urgent_dispatch', {
      assignment: createdAssignment,
      incident,
      distanceMeters: nearestResponder.estimatedMeters,
      sector: nearestResponder.position.sector,
    });
  }

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

  let createdAttachment = null;
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

    if (data.photoUrl) {
      createdAttachment = await tx.attachment.create({
        data: {
          incidentId: inc.id,
          uploadedById: user.id,
          storageKey: data.photoUrl,
          contentType: data.contentType || 'image/jpeg',
          fileSize: data.fileSize || 0,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, role: true } },
        },
      });
    }

    await tx.incidentEvent.create({
      data: {
        incidentId: inc.id,
        actorId: user.id,
        eventType: 'INCIDENT_REPORTED',
        description: `Incident reported: ${data.category}${data.photoUrl ? ' [Photo Attached]' : ''}`,
      },
    });

    return inc;
  }, TX_OPTIONS);

  incident.attachments = createdAttachment ? [createdAttachment] : [];

  // Non-blocking safe audit log
  logAudit({
    actorId: user.id,
    action: 'INCIDENT_REPORTED',
    entityType: 'INCIDENT',
    entityId: incident.id,
    changeSummary: { category: data.category, priority: data.priority },
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
      attachments: {
        include: {
          uploadedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
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
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
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
      attachments: {
        include: {
          uploadedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
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

    return inc;
  }, TX_OPTIONS);

  logAudit({
    actorId: adminId,
    action: 'INCIDENT_ESCALATED',
    entityType: 'INCIDENT',
    entityId: incidentId,
    changeSummary: { reason },
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

    return inc;
  }, TX_OPTIONS);

  logAudit({
    actorId: adminId,
    action: 'INCIDENT_CLOSED',
    entityType: 'INCIDENT',
    entityId: incidentId,
    changeSummary: { resolutionNote, externalServiceContacted },
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
