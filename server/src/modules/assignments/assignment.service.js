import { prisma } from '../../config/prisma.js';
import { emitToHotel, emitToRole, emitToUser } from '../../realtime/emitter.js';

export async function getEligibleStaff(hotelId) {
  const where = {
    role: 'STAFF',
    status: 'ACTIVE',
  };
  if (hotelId) where.hotelId = hotelId;

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      assignments: {
        where: {
          status: { in: ['PENDING', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS'] },
        },
        select: { id: true },
      },
    },
  });
}

export async function assignIncident(incidentId, adminId, { assigneeId, instructions, deadlineMinutes = 10 }) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: { room: true },
  });

  if (!incident) {
    const error = new Error('Incident not found');
    error.status = 404;
    throw error;
  }

  const staff = await prisma.user.findUnique({
    where: { id: assigneeId },
  });

  if (!staff || staff.role !== 'STAFF') {
    const error = new Error('Invalid staff member');
    error.status = 400;
    throw error;
  }

  const deadlineAt = new Date(Date.now() + deadlineMinutes * 60 * 1000);

  const assignment = await prisma.$transaction(async (tx) => {
    // If there is an existing pending assignment, mark it REASSIGNED
    await tx.assignment.updateMany({
      where: { incidentId, status: 'PENDING' },
      data: { status: 'REASSIGNED' },
    });

    const newAssignment = await tx.assignment.create({
      data: {
        incidentId,
        assigneeId,
        assignedById: adminId,
        instructions,
        deadlineAt,
        status: 'PENDING',
      },
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true } },
        incident: { include: { room: true } },
      },
    });

    await tx.incident.update({
      where: { id: incidentId },
      data: { status: 'ASSIGNED' },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId,
        actorId: adminId,
        eventType: 'ASSIGNED',
        description: `Assigned to ${staff.name}${instructions ? `: "${instructions}"` : ''}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ASSIGNMENT_CREATED',
        entityType: 'ASSIGNMENT',
        entityId: newAssignment.id,
        changeSummary: { assignee: staff.name, incidentId },
      },
    });

    return newAssignment;
  });

  // Real-time broadcasts
  emitToUser(assigneeId, 'assignment:created', assignment);
  emitToHotel(incident.hotelId, 'incident:assigned', { incidentId, assignment });
  emitToRole('ADMIN', 'incident:assigned', { incidentId, assignment });
  if (incident.reporterId) {
    emitToUser(incident.reporterId, 'incident:updated', { ...incident, status: 'ASSIGNED' });
  }

  return assignment;
}

export async function getStaffTasks(staffId) {
  return prisma.assignment.findMany({
    where: { assigneeId: staffId },
    include: {
      incident: {
        include: {
          room: true,
          reporter: { select: { id: true, name: true, email: true } },
        },
      },
      serviceRequest: {
        include: {
          room: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function acknowledgeAssignment(assignmentId, staffId) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { incident: true, serviceRequest: true },
  });

  if (!assignment) {
    const error = new Error('Assignment not found');
    error.status = 404;
    throw error;
  }

  if (assignment.assigneeId !== staffId) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const asgn = await tx.assignment.update({
      where: { id: assignmentId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
      include: {
        assignee: { select: { id: true, name: true } },
        incident: { include: { room: true } },
      },
    });

    if (asgn.incidentId) {
      await tx.incident.update({
        where: { id: asgn.incidentId },
        data: { status: 'RESPONDING' },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: asgn.incidentId,
          actorId: staffId,
          eventType: 'ACKNOWLEDGED',
          description: `Acknowledged by ${asgn.assignee.name}`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: staffId,
        action: 'ASSIGNMENT_ACKNOWLEDGED',
        entityType: 'ASSIGNMENT',
        entityId: assignmentId,
      },
    });

    return asgn;
  });

  if (updated.incident) {
    emitToHotel(updated.incident.hotelId, 'assignment:acknowledged', updated);
    emitToRole('ADMIN', 'assignment:acknowledged', updated);
    if (updated.incident.reporterId) {
      emitToUser(updated.incident.reporterId, 'incident:updated', {
        id: updated.incidentId,
        status: 'RESPONDING',
      });
    }
  }

  return updated;
}

export async function declineAssignment(assignmentId, staffId, reason) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { incident: true },
  });

  if (!assignment) {
    const error = new Error('Assignment not found');
    error.status = 404;
    throw error;
  }

  if (assignment.assigneeId !== staffId) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const asgn = await tx.assignment.update({
      where: { id: assignmentId },
      data: {
        status: 'DECLINED',
        declineReason: reason,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        incident: { include: { room: true } },
      },
    });

    if (asgn.incidentId) {
      await tx.incidentEvent.create({
        data: {
          incidentId: asgn.incidentId,
          actorId: staffId,
          eventType: 'DECLINED',
          description: `Declined by ${asgn.assignee.name}: "${reason}"`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: staffId,
        action: 'ASSIGNMENT_DECLINED',
        entityType: 'ASSIGNMENT',
        entityId: assignmentId,
        changeSummary: { reason },
      },
    });

    return asgn;
  });

  if (updated.incident) {
    emitToRole('ADMIN', 'assignment:declined', updated);
    emitToHotel(updated.incident.hotelId, 'assignment:declined', updated);
  }

  return updated;
}

export async function updateAssignmentStatus(assignmentId, staffId, { status, notes }) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { incident: true, serviceRequest: true },
  });

  if (!assignment) {
    const error = new Error('Assignment not found');
    error.status = 404;
    throw error;
  }

  if (assignment.assigneeId !== staffId) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const asgn = await tx.assignment.update({
      where: { id: assignmentId },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        incident: { include: { room: true } },
      },
    });

    // Map assignment status to incident status
    if (asgn.incidentId) {
      let targetIncidentStatus = 'IN_PROGRESS';
      if (status === 'COMPLETED') targetIncidentStatus = 'RESOLVED';
      else if (status === 'EN_ROUTE' || status === 'ON_SCENE') targetIncidentStatus = 'RESPONDING';

      await tx.incident.update({
        where: { id: asgn.incidentId },
        data: {
          status: targetIncidentStatus,
          resolvedAt: status === 'COMPLETED' ? new Date() : undefined,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: asgn.incidentId,
          actorId: staffId,
          eventType: status,
          description: `Status updated to ${status}${notes ? `: "${notes}"` : ''}`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: staffId,
        action: `ASSIGNMENT_${status}`,
        entityType: 'ASSIGNMENT',
        entityId: assignmentId,
        changeSummary: { status, notes },
      },
    });

    return asgn;
  });

  if (updated.incident) {
    emitToHotel(updated.incident.hotelId, 'assignment:updated', updated);
    emitToRole('ADMIN', 'assignment:updated', updated);
    if (updated.incident.reporterId) {
      emitToUser(updated.incident.reporterId, 'incident:updated', updated.incident);
    }
  }

  return updated;
}
