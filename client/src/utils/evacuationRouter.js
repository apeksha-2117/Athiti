/**
 * Dynamic Evacuation Wayfinding & Dijkstra Spatial Routing Engine
 * Coordinates mapped to Hotel CAD Blueprint Canvas (1000 x 620)
 */

export const WAYPOINTS = {
  // Room entrance doors
  R1: { id: 'R1', x: 280, y: 190, label: 'Room North-West Door', type: 'ROOM' },
  R2: { id: 'R2', x: 720, y: 190, label: 'Room North-East Door', type: 'ROOM' },
  R3: { id: 'R3', x: 280, y: 430, label: 'Room South-West Door', type: 'ROOM' },
  R4: { id: 'R4', x: 720, y: 430, label: 'Room South-East Door', type: 'ROOM' },

  // Corridor Spine Nodes
  C_WEST: { id: 'C_WEST', x: 280, y: 310, label: 'West Corridor Junction', type: 'CORRIDOR' },
  C_CENTER: { id: 'C_CENTER', x: 500, y: 310, label: 'Central Corridor Core', type: 'CORRIDOR' },
  C_EAST: { id: 'C_EAST', x: 720, y: 310, label: 'East Corridor Junction', type: 'CORRIDOR' },
  C_FAR_WEST: { id: 'C_FAR_WEST', x: 120, y: 310, label: 'West Wing Corridor', type: 'CORRIDOR' },
  C_FAR_EAST: { id: 'C_FAR_EAST', x: 880, y: 310, label: 'East Wing Corridor', type: 'CORRIDOR' },

  // Emergency Exits & Stairwells
  EXIT_A: {
    id: 'EXIT_A',
    x: 345,
    y: 240,
    label: 'Stairwell A (West Stairs)',
    type: 'EXIT',
    description: 'Pressurized concrete stairwell to Ground Floor exterior',
  },
  EXIT_B: {
    id: 'EXIT_B',
    x: 345,
    y: 380,
    label: 'Fire Stairwell B (Emergency Fire Exit)',
    type: 'EXIT',
    description: 'Heavy fire-rated egress stairwell with direct exterior discharge',
  },
  EXIT_EAST: {
    id: 'EXIT_EAST',
    x: 930,
    y: 310,
    label: 'East Wing Fire Escape',
    type: 'EXIT',
    description: 'Exterior structural fire escape on East facade',
  },
  EXIT_LOBBY: {
    id: 'EXIT_LOBBY',
    x: 555,
    y: 580,
    label: 'Main Ground Street Exit',
    type: 'EXIT',
    description: 'Direct wide exterior glass doors to Marina Drive Assembly Point',
  },
};

// Topological network graph
const EDGES = [
  // Room doors connect to corridor junctions
  { from: 'R1', to: 'C_WEST', distance: 12 },
  { from: 'R3', to: 'C_WEST', distance: 12 },
  { from: 'R2', to: 'C_EAST', distance: 12 },
  { from: 'R4', to: 'C_EAST', distance: 12 },

  // Corridor Spine links
  { from: 'C_FAR_WEST', to: 'C_WEST', distance: 16 },
  { from: 'C_WEST', to: 'C_CENTER', distance: 22 },
  { from: 'C_CENTER', to: 'C_EAST', distance: 22 },
  { from: 'C_EAST', to: 'C_FAR_EAST', distance: 16 },
  { from: 'C_FAR_EAST', to: 'EXIT_EAST', distance: 5 },

  // Exits connect to corridor
  { from: 'C_WEST', to: 'EXIT_A', distance: 9 },
  { from: 'C_CENTER', to: 'EXIT_A', distance: 17 },
  { from: 'C_WEST', to: 'EXIT_B', distance: 9 },
  { from: 'C_CENTER', to: 'EXIT_B', distance: 17 },

  // Floor 1 Main Lobby Direct Exit
  { from: 'C_CENTER', to: 'EXIT_LOBBY', distance: 25 },
];

/**
 * Get the initial waypoint node for a room number or simulated position
 */
export function getStartWaypoint(locationKey, roomNumber) {
  if (locationKey === 'POOL') {
    return { id: 'POOL', x: 880, y: 480, label: 'Pool Deck Corridor', type: 'CORRIDOR' };
  }
  if (locationKey === 'GYM') {
    return { id: 'GYM', x: 345, y: 450, label: 'Fitness Center Entry', type: 'CORRIDOR' };
  }
  if (locationKey === 'LOBBY') {
    return { id: 'C_CENTER', x: 500, y: 350, label: 'Main Lobby Center', type: 'CORRIDOR' };
  }

  // Derive by room number (101 -> R1, 102 -> R2, 103 -> R3, 104 -> R4)
  const lastChar = String(roomNumber || '101').slice(-1);
  if (lastChar === '2') return WAYPOINTS.R2;
  if (lastChar === '3') return WAYPOINTS.R3;
  if (lastChar === '4') return WAYPOINTS.R4;
  return WAYPOINTS.R1;
}

/**
 * Compute the 2D Euclidean distance between two points
 */
function distance2D(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is within the hazard radius
 */
function isPointNearHazard(point, hazard, radius = 180) {
  if (!hazard || !point) return false;
  return distance2D(point, hazard) <= radius;
}

/**
 * Main Dijkstra Safest Evacuation Path Solver
 */
export function calculateSafestEvacuationPath({
  startLocationKey = 'ROOM',
  roomNumber = '101',
  floor = 1,
  activeIncidents = [],
  simulatedHazard = null, // { x, y, floor, label, blockedExitId }
}) {
  const startWaypoint = getStartWaypoint(startLocationKey, roomNumber);

  // Determine active hazard(s) on this floor
  let hazard = simulatedHazard;

  if (!hazard) {
    const majorInc = activeIncidents.find(
      (i) =>
        i.status !== 'CLOSED' &&
        (['CRITICAL', 'HIGH'].includes(i.priority) ||
          ['FIRE_OR_SMOKE', 'SECURITY_THREAT', 'ELECTRICAL_HAZARD'].includes(i.category))
    );

    if (majorInc) {
      const incRoomNum = majorInc.room?.roomNumber;
      const incFloor = majorInc.room?.floor || (incRoomNum ? parseInt(incRoomNum[0], 10) : floor);

      if (incFloor === floor) {
        const lastDigit = String(incRoomNum || '101').slice(-1);
        const hazardCoords =
          lastDigit === '2'
            ? { x: 720, y: 190, label: `Room ${incRoomNum} (East Wing)` }
            : lastDigit === '3'
            ? { x: 280, y: 430, label: `Room ${incRoomNum} (South-West)` }
            : lastDigit === '4'
            ? { x: 720, y: 430, label: `Room ${incRoomNum} (South-East)` }
            : { x: 280, y: 190, label: `Room ${incRoomNum || '101'} (West Wing)` };

        hazard = {
          ...hazardCoords,
          floor: incFloor,
          category: majorInc.category,
          priority: majorInc.priority,
          description: majorInc.description,
        };
      }
    }
  }

  // Define active exit options for this floor
  const exitCandidates = [
    { ...WAYPOINTS.EXIT_A },
    { ...WAYPOINTS.EXIT_B },
    { ...WAYPOINTS.EXIT_EAST },
  ];
  if (floor === 1) {
    exitCandidates.push({ ...WAYPOINTS.EXIT_LOBBY });
  }

  // Detect which exits and edges are compromised by the hazard
  const blockedExits = [];
  const safeExits = [];

  exitCandidates.forEach((exit) => {
    let isBlocked = false;
    let blockReason = '';

    if (hazard && isPointNearHazard(exit, hazard, 150)) {
      isBlocked = true;
      blockReason = `Smoke/Hazard proximity to ${exit.label}`;
    }

    if (hazard?.blockedExitId === exit.id) {
      isBlocked = true;
      blockReason = `Reported impassable: ${hazard.label || 'Obstacle'}`;
    }

    if (isBlocked) {
      blockedExits.push({ ...exit, reason: blockReason });
    } else {
      safeExits.push(exit);
    }
  });

  // Build Adjacency List for Dijkstra
  const adj = {};
  const allNodes = { ...WAYPOINTS };
  if (startWaypoint.id && !allNodes[startWaypoint.id]) {
    allNodes[startWaypoint.id] = startWaypoint;
  }

  Object.keys(allNodes).forEach((nid) => {
    adj[nid] = [];
  });

  EDGES.forEach(({ from, to, distance }) => {
    if (!adj[from]) adj[from] = [];
    if (!adj[to]) adj[to] = [];

    // Check if edge passes through hazard zone
    const p1 = allNodes[from];
    const p2 = allNodes[to];
    let edgeWeight = distance;

    if (hazard && p1 && p2) {
      const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      if (isPointNearHazard(midPoint, hazard, 160) || isPointNearHazard(p1, hazard, 140) || isPointNearHazard(p2, hazard, 140)) {
        // Impart massive prohibitive penalty so router avoids it unless no other physical way exists
        edgeWeight = 9999;
      }
    }

    adj[from].push({ node: to, weight: edgeWeight });
    adj[to].push({ node: from, weight: edgeWeight });
  });

  // Dijkstra's Algorithm
  const startId = startWaypoint.id;
  const dist = {};
  const prev = {};
  const unvisited = new Set(Object.keys(adj));

  Object.keys(adj).forEach((n) => {
    dist[n] = Infinity;
  });
  dist[startId] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let shortestDist = Infinity;
    unvisited.forEach((n) => {
      if (dist[n] < shortestDist) {
        shortestDist = dist[n];
        current = n;
      }
    });

    if (current === null || shortestDist === Infinity) break;
    unvisited.delete(current);

    adj[current].forEach(({ node: neighbor, weight }) => {
      if (unvisited.has(neighbor)) {
        const alt = dist[current] + weight;
        if (alt < dist[neighbor]) {
          dist[neighbor] = alt;
          prev[neighbor] = current;
        }
      }
    });
  }

  // Find best unblocked exit
  let targetExit = null;
  let minExitCost = Infinity;

  safeExits.forEach((exit) => {
    if (dist[exit.id] < minExitCost) {
      minExitCost = dist[exit.id];
      targetExit = exit;
    }
  });

  // Fallback: If all exits are flagged, choose the least-penalized exit
  if (!targetExit && exitCandidates.length > 0) {
    targetExit = exitCandidates.reduce((best, curr) =>
      dist[curr.id] < dist[best.id] ? curr : best
    );
  }

  // Reconstruct path nodes from targetExit back to start
  const pathNodes = [];
  let curr = targetExit?.id;
  while (curr) {
    const nodeObj = allNodes[curr];
    if (nodeObj) {
      pathNodes.unshift(nodeObj);
    }
    curr = prev[curr];
  }

  // If path reconstruction failed, fallback to straight line
  if (pathNodes.length < 2 && targetExit) {
    pathNodes.length = 0;
    pathNodes.push(startWaypoint, targetExit);
  }

  // Build SVG polyline points string: "x1,y1 x2,y2 x3,y3"
  const svgPolyline = pathNodes.map((p) => `${p.x},${p.y}`).join(' ');

  // Generate Step-by-Step Egress Guidance Instructions
  const steps = [];
  steps.push(`1. Exit ${startWaypoint.label} into central passage.`);

  if (hazard) {
    steps.push(`2. Avoid ${hazard.label} — Hazard actively isolated.`);
  }

  if (targetExit?.id === 'EXIT_A') {
    steps.push('3. Head West along Central Corridor to Stairwell A door.');
    steps.push('4. Enter Stairwell A and descend to Ground Level.');
  } else if (targetExit?.id === 'EXIT_B') {
    steps.push('3. Proceed toward South Fire Stairwell B (Fire-rated passage).');
    steps.push('4. Enter Fire Stairwell B and evacuate toward Marina Drive.');
  } else if (targetExit?.id === 'EXIT_EAST') {
    steps.push('3. Head East along Central Corridor to East Wing Fire Escape.');
    steps.push('4. Exit through emergency fire door to exterior fire stairs.');
  } else if (targetExit?.id === 'EXIT_LOBBY') {
    steps.push('3. Proceed directly through Central Lounge toward Main Concierge.');
    steps.push('4. Exit wide glass entrance to Street Assembly Point.');
  } else {
    steps.push(`3. Follow illuminated green floor beacons directly to ${targetExit?.label || 'Emergency Exit'}.`);
  }

  return {
    startWaypoint,
    targetExit,
    safeExits,
    blockedExits,
    hazard,
    pathNodes,
    svgPolyline,
    totalDistanceMeters: Math.round(minExitCost > 9000 ? 35 : minExitCost),
    steps,
    isRerouted: !!hazard,
  };
}
