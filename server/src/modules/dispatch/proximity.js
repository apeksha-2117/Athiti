import { prisma } from '../../config/prisma.js';

/**
 * Geometric Blueprint Coordinates (Floor Plan Canvas: 1000 x 620)
 */
export const ROOM_COORDINATES = {
  // Floor 1
  '101': { floor: 1, x: 165, y: 130, roomNumber: '101' },
  '102': { floor: 1, x: 835, y: 130, roomNumber: '102' },
  '103': { floor: 1, x: 165, y: 470, roomNumber: '103' },
  '104': { floor: 1, x: 835, y: 470, roomNumber: '104' },
  // Floor 2
  '201': { floor: 2, x: 165, y: 130, roomNumber: '201' },
  '202': { floor: 2, x: 835, y: 130, roomNumber: '202' },
  '203': { floor: 2, x: 165, y: 470, roomNumber: '203' },
  '204': { floor: 2, x: 835, y: 470, roomNumber: '204' },
  // Floor 3
  '301': { floor: 3, x: 165, y: 130, roomNumber: '301' },
  '302': { floor: 3, x: 835, y: 130, roomNumber: '302' },
  '303': { floor: 3, x: 165, y: 470, roomNumber: '303' },
  '304': { floor: 3, x: 835, y: 470, roomNumber: '304' },
};

export const COMMON_AREAS = {
  POOL: { floor: 1, x: 850, y: 550, name: 'Swimming Pool & Sun Deck' },
  GYM: { floor: 2, x: 300, y: 480, name: 'Fitness Center & Spa' },
  LOBBY: { floor: 1, x: 555, y: 450, name: 'Main Lobby & Reception' },
};

/**
 * Default initial staff patrol sectors
 */
export const DEFAULT_STAFF_SECTORS = {
  'staff.security@athithi.demo': {
    floor: 1,
    x: 280,
    y: 310,
    sector: 'Floor 1 West Corridor',
    roleTag: 'SECURITY',
  },
  'staff.maintenance@athithi.demo': {
    floor: 2,
    x: 500,
    y: 310,
    sector: 'Floor 2 Central Core',
    roleTag: 'MAINTENANCE',
  },
  'staff.housekeeping@athithi.demo': {
    floor: 3,
    x: 720,
    y: 310,
    sector: 'Floor 3 East Wing',
    roleTag: 'HOUSEKEEPING',
  },
};

/**
 * Calculate 3D Euclidean distance between incident location and staff patrol position
 * Floor difference adds a 350-unit vertical transit / stairwell penalty.
 */
export function calculateDistance(locA, locB) {
  const dx = (locA.x || 500) - (locB.x || 500);
  const dy = (locA.y || 310) - (locB.y || 310);
  const floorDiff = Math.abs((locA.floor || 1) - (locB.floor || 1));
  const floorPenalty = floorDiff * 350;

  const rawUnits = Math.sqrt(dx * dx + dy * dy) + floorPenalty;
  // Convert units to approximate meters (approx 20 units = 1 meter on CAD canvas)
  const estimatedMeters = Math.max(3, Math.round(rawUnits / 18));
  return { rawUnits, estimatedMeters };
}

/**
 * Find the nearest on-duty staff member to an emergency
 */
export async function findNearestResponder(hotelId, { roomNumber, coordinates, category, priority, activeStaffPositions = {} }) {
  // Query active staff members for this hotel
  const staffMembers = await prisma.user.findMany({
    where: {
      role: 'STAFF',
      status: 'ACTIVE',
      ...(hotelId ? { hotelId } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!staffMembers || staffMembers.length === 0) {
    return null;
  }

  // Resolve target location
  let targetLoc = null;
  if (roomNumber && ROOM_COORDINATES[roomNumber]) {
    targetLoc = ROOM_COORDINATES[roomNumber];
  } else if (coordinates?.floor) {
    targetLoc = { floor: coordinates.floor, x: 500, y: 310 };
  } else {
    // Default to Floor 1 center
    targetLoc = { floor: 1, x: 500, y: 310 };
  }

  // Evaluate each staff member's live position
  const evaluatedStaff = staffMembers.map((st) => {
    // Live position from active map, or default sector, or fallback
    const live = activeStaffPositions[st.id] ||
      DEFAULT_STAFF_SECTORS[st.email] ||
      { floor: 1, x: 500, y: 310, sector: 'Floor 1 Lobby' };

    const { rawUnits, estimatedMeters } = calculateDistance(targetLoc, live);

    // Apply role relevance weighting
    let roleBonus = 0;
    if (priority === 'CRITICAL' || priority === 'HIGH') {
      if (st.email.includes('security')) roleBonus = -120; // Security prioritized for high threat
    } else if (category === 'WATER_LEAKAGE' || category === 'ELECTRICAL_HAZARD') {
      if (st.email.includes('maintenance')) roleBonus = -150; // Facilities prioritized for leaks
    }

    return {
      staff: st,
      position: live,
      effectiveScore: rawUnits + roleBonus,
      estimatedMeters,
    };
  });

  // Sort by lowest effective score
  evaluatedStaff.sort((a, b) => a.effectiveScore - b.effectiveScore);

  const bestMatch = evaluatedStaff[0];
  return {
    staff: bestMatch.staff,
    position: bestMatch.position,
    estimatedMeters: bestMatch.estimatedMeters,
    targetLocation: targetLoc,
  };
}
