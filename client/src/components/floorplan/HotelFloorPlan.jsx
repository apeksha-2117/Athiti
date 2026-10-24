import React, { useState, useMemo } from 'react';
import '../../styles/floorplan.css';
import { calculateSafestEvacuationPath } from '../../utils/evacuationRouter';
import {
  ShieldAlertIcon,
  BellIcon,
  MapPinIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  RadioIcon,
  UserIcon,
} from '../common/Icons';

/**
 * Geometric Blueprint Coordinates for deterministic room positions
 * Canvas: 1000 x 620
 */
const ROOM_LAYOUT_CONFIG = {
  // Top Left (x01)
  1: { x: 50, y: 50, width: 230, height: 180, doorX: 280, doorY: 190, doorAngle: 90, labelX: 165, labelY: 130 },
  // Top Right (x02)
  2: { x: 720, y: 50, width: 230, height: 180, doorX: 720, doorY: 190, doorAngle: 90, labelX: 835, labelY: 130 },
  // Bottom Left (x03)
  3: { x: 50, y: 390, width: 230, height: 180, doorX: 280, doorY: 430, doorAngle: 270, labelX: 165, labelY: 470 },
  // Bottom Right (x04)
  4: { x: 720, y: 390, width: 230, height: 180, doorX: 720, doorY: 430, doorAngle: 270, labelX: 835, labelY: 470 },
};

export function HotelFloorPlan({
  rooms = [],
  incidents = [],
  serviceRequests = [],
  publicReports = [],
  staffList = [],
  staffPositions = {},
  onSelectRoom,
  onAssignIncident,
  onEscalateIncident,
  onCloseIncident,
  onAssignService,
}) {
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [selectedEntity, setSelectedEntity] = useState(null); // { type: 'ROOM' | 'INCIDENT' | 'SERVICE', data }
  const [markerFilter, setMarkerFilter] = useState('ALL'); // 'ALL' | 'EMERGENCIES' | 'SERVICES'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showEvacPaths, setShowEvacPaths] = useState(false);

  // Active staff on the selected floor
  const floorStaff = useMemo(() => {
    const staffArray = Array.isArray(staffPositions)
      ? staffPositions
      : Object.values(staffPositions || {});

    return staffArray.filter((sp) => {
      const fl = sp.coordinates?.floor || sp.floor;
      return fl === selectedFloor;
    });
  }, [staffPositions, selectedFloor]);

  // Available floors in the hotel
  const availableFloors = [1, 2, 3];

  // Current floor's rooms
  const floorRooms = useMemo(() => {
    return rooms.filter((r) => r.floor === selectedFloor);
  }, [rooms, selectedFloor]);

  // Map active incidents to rooms on this floor
  const activeIncidents = useMemo(() => {
    return incidents.filter((i) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status));
  }, [incidents]);

  // Active service requests
  const activeServices = useMemo(() => {
    return serviceRequests.filter(
      (s) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(s.status)
    );
  }, [serviceRequests]);

  // Unlocated reports (incidents without a room mapping + unverified public reports)
  const unlocatedReports = useMemo(() => {
    const unlocatedIncidents = activeIncidents.filter((i) => !i.roomId && !i.room);
    const unlocatedPublic = publicReports.filter((p) => p.status === 'UNVERIFIED');
    return [
      ...unlocatedIncidents.map((i) => ({ ...i, isPublic: false })),
      ...unlocatedPublic.map((p) => ({ ...p, isPublic: true })),
    ];
  }, [activeIncidents, publicReports]);

  // Compute emergency count per floor for toolbar badges
  const emergencyCountByFloor = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    activeIncidents.forEach((inc) => {
      const fl = inc.room?.floor || rooms.find((r) => r.id === inc.roomId)?.floor;
      if (fl && counts[fl] !== undefined) {
        counts[fl]++;
      }
    });
    return counts;
  }, [activeIncidents, rooms]);

  // Compute active incidents with proximity dispatch vectors on the selected floor
  const activeFloorIncidentsWithDispatch = useMemo(() => {
    const staffArray = Array.isArray(staffPositions)
      ? staffPositions
      : Object.values(staffPositions || {});

    const floorRoomList = rooms.filter((r) => r.floor === selectedFloor);

    return activeIncidents
      .map((inc) => {
        const rm = rooms.find(
          (r) => r.id === inc.roomId || r.roomNumber === inc.room?.roomNumber
        );
        if (!rm || rm.floor !== selectedFloor) return null;

        const roomIdx = (floorRoomList.findIndex((r) => r.id === rm.id) % 4) + 1;
        const cfg = ROOM_LAYOUT_CONFIG[roomIdx] || ROOM_LAYOUT_CONFIG[1];

        const assigneeId =
          inc.assignments?.[0]?.assigneeId ||
          inc.assignments?.[0]?.assignee?.id ||
          inc.autoDispatchedTo?.staff?.id;

        if (!assigneeId) return null;

        const responder = staffArray.find(
          (sp) =>
            sp.staff?.id === assigneeId ||
            sp.staff?.email === inc.assignments?.[0]?.assignee?.email ||
            sp.staff?.id === inc.autoDispatchedTo?.staff?.id
        );

        if (!responder || !responder.coordinates) return null;
        const respFloor = responder.coordinates.floor || responder.floor;
        if (respFloor !== selectedFloor) return null;

        return {
          incident: inc,
          room: rm,
          roomPos: { x: cfg.doorX, y: cfg.doorY },
          responderPos: { x: responder.coordinates.x, y: responder.coordinates.y },
          responder,
          estimatedMeters: inc.autoDispatchedTo?.estimatedMeters || 18,
        };
      })
      .filter(Boolean);
  }, [activeIncidents, rooms, selectedFloor, staffPositions]);

  // Compute live evacuation egress routes on the selected floor
  const floorEvacRoutes = useMemo(() => {
    if (!showEvacPaths) return [];
    return floorRooms
      .map((rm) => {
        return calculateSafestEvacuationPath({
          startLocationKey: 'ROOM',
          roomNumber: rm.roomNumber,
          floor: selectedFloor,
          activeIncidents,
        });
      })
      .filter(Boolean);
  }, [showEvacPaths, floorRooms, selectedFloor, activeIncidents]);

  // Helper to get active reports for a specific room
  const getRoomReports = (rm) => {
    const roomIncidents = activeIncidents.filter(
      (i) => i.roomId === rm.id || i.room?.roomNumber === rm.roomNumber
    );
    const roomServices = activeServices.filter(
      (s) => s.roomId === rm.id || s.room?.roomNumber === rm.roomNumber
    );

    let filteredIncidents = roomIncidents;
    let filteredServices = roomServices;

    if (markerFilter === 'EMERGENCIES') filteredServices = [];
    if (markerFilter === 'SERVICES') filteredIncidents = [];

    return {
      allIncidents: roomIncidents,
      allServices: roomServices,
      filteredIncidents,
      filteredServices,
      hasEmergency: roomIncidents.some((i) => i.priority === 'CRITICAL'),
      hasHighHazard: roomIncidents.some((i) => ['HIGH', 'MEDIUM'].includes(i.priority)),
      totalCount: filteredIncidents.length + filteredServices.length,
    };
  };

  const handleZoom = (delta) => {
    setZoomLevel((prev) => Math.min(Math.max(0.7, prev + delta), 1.6));
  };

  const resetZoom = () => setZoomLevel(1);

  return (
    <div className="floorplan-container">
      {/* ── Toolbar: Floor Switcher, Marker Filters, Zoom ── */}
      <div className="floorplan-toolbar">
        <div className="floor-tabs">
          {availableFloors.map((fl) => (
            <button
              key={fl}
              className={`floor-tab-btn ${selectedFloor === fl ? 'active' : ''}`}
              onClick={() => {
                setSelectedFloor(fl);
                setSelectedEntity(null);
              }}
            >
              <span>Floor {fl}</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.75 }}>
                {fl === 1 ? '(Ground Floor)' : fl === 2 ? '(Level 2)' : '(Level 3 Suites)'}
              </span>
              {emergencyCountByFloor[fl] > 0 && (
                <span className="floor-badge-alert" title={`${emergencyCountByFloor[fl]} active emergencies on Floor ${fl}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="pulse-dot pulse-dot-critical" style={{ width: '5px', height: '5px' }} />
                  <span>{emergencyCountByFloor[fl]}</span>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Marker Filters */}
        <div className="marker-filters">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px' }}>Filter:</span>
          <button
            className={`filter-chip ${markerFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setMarkerFilter('ALL')}
          >
            All Reports ({activeIncidents.length + activeServices.length})
          </button>
          <button
            className={`filter-chip ${markerFilter === 'EMERGENCIES' ? 'active' : ''}`}
            onClick={() => setMarkerFilter('EMERGENCIES')}
          >
            Emergencies ({activeIncidents.length})
          </button>
          <button
            className={`filter-chip ${markerFilter === 'SERVICES' ? 'active' : ''}`}
            onClick={() => setMarkerFilter('SERVICES')}
          >
            Service Requests ({activeServices.length})
          </button>
          <button
            className={`filter-chip ${showEvacPaths ? 'active' : ''}`}
            style={{
              borderColor: showEvacPaths ? '#10b981' : undefined,
              color: showEvacPaths ? '#10b981' : undefined,
              fontWeight: showEvacPaths ? 700 : undefined,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setShowEvacPaths(!showEvacPaths)}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span>Safest Egress Routes</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="blueprint-controls">
          <button className="zoom-btn" onClick={() => handleZoom(0.15)} title="Zoom In">+</button>
          <button className="zoom-btn" onClick={() => handleZoom(-0.15)} title="Zoom Out">-</button>
          <button className="zoom-btn" onClick={resetZoom} title="Reset Scale">
            {Math.round(zoomLevel * 100)}% ⟲
          </button>
        </div>
      </div>

      {/* ── Workspace: SVG Blueprint + Side Inspector ── */}
      <div className="floorplan-workspace">
        {/* Architectural SVG Stage */}
        <div className="blueprint-card">
          <div className="blueprint-header">
            <div className="blueprint-title">
              <span>GRAND ATHITHI HOTEL • ARCHITECTURAL BLUEPRINT</span>
              <span style={{ color: '#fbbf24' }}>// LEVEL {selectedFloor}.00</span>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.74rem', color: '#64748b', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#38bdf8', fontWeight: 700 }}>
                <span className="pulse-dot pulse-dot-critical" style={{ width: '6px', height: '6px' }} />
                <span>{floorStaff.length} Responder{floorStaff.length === 1 ? '' : 's'} on Floor {selectedFloor}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Available
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} /> Occupied
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Active SOS
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} /> Service Req
              </span>
            </div>
          </div>

          <div className="blueprint-svg-wrapper">
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease',
              }}
            >
              <svg
                viewBox="0 0 1000 620"
                className="blueprint-svg"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Subtle technical millimeter grid */}
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="0.5" />
                    <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="0.5" />
                  </pattern>

                  {/* Major grid lines (100px) */}
                  <pattern id="majorGrid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <rect width="100" height="100" fill="url(#grid)" />
                    <line x1="0" y1="0" x2="100" y2="0" stroke="rgba(56, 189, 248, 0.09)" strokeWidth="1" />
                    <line x1="0" y1="0" x2="0" y2="100" stroke="rgba(56, 189, 248, 0.09)" strokeWidth="1" />
                  </pattern>

                  {/* Diagonal staircase hatching */}
                  <pattern id="stairHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="10" stroke="#1e3a5f" strokeWidth="1.5" />
                  </pattern>

                  {/* Radar ping animation for critical emergencies */}
                  <radialGradient id="criticalGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#ef4444" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Background Grid */}
                <rect width="1000" height="620" fill="#040811" />
                <rect width="1000" height="620" fill="url(#majorGrid)" />

                {/* ── EXTERIOR WALLS & PERIMETER ── */}
                <rect x="30" y="30" width="940" height="560" rx="4" fill="none" stroke="#162a45" strokeWidth="6" />
                <rect x="34" y="34" width="932" height="552" rx="3" fill="none" stroke="#0e1f36" strokeWidth="2" />

                {/* Corner Technical Dimension Marks */}
                <path d="M 20 40 L 40 40 M 40 20 L 40 40" stroke="#38bdf8" strokeWidth="1.5" />
                <path d="M 980 40 L 960 40 M 960 20 L 960 40" stroke="#38bdf8" strokeWidth="1.5" />
                <path d="M 20 580 L 40 580 M 40 600 L 40 580" stroke="#38bdf8" strokeWidth="1.5" />
                <path d="M 980 580 L 960 580 M 960 600 L 960 580" stroke="#38bdf8" strokeWidth="1.5" />

                {/* ── CENTRAL CORRIDOR & EGRESS PATH ── */}
                <rect x="50" y="240" width="900" height="140" fill="rgba(14, 31, 54, 0.4)" stroke="#162a45" strokeWidth="2" />
                <line x1="50" y1="310" x2="950" y2="310" stroke="rgba(56, 189, 248, 0.25)" strokeDasharray="6 6" strokeWidth="1.5" />

                {/* Directional Exit Arrows in Corridor */}
                <g fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.45">
                  <path d="M 120 310 L 105 310 M 112 305 L 105 310 L 112 315" />
                  <path d="M 230 310 L 215 310 M 222 305 L 215 310 L 222 315" />
                  <path d="M 770 310 L 785 310 M 778 305 L 785 310 L 778 315" />
                  <path d="M 880 310 L 895 310 M 888 305 L 895 310 L 888 315" />
                </g>

                {/* Corridor Label & Safety Equipment */}
                <text x="500" y="255" fill="#64748b" fontSize="11" fontFamily="ui-monospace" textAnchor="middle" letterSpacing="2">
                  CENTRAL ACCESS CORRIDOR • EGRESS PASSAGE
                </text>
                <text x="290" y="325" fill="#ef4444" fontSize="9" fontWeight="700" fontFamily="ui-monospace">[FE-1]</text>
                <text x="705" y="325" fill="#ef4444" fontSize="9" fontWeight="700" fontFamily="ui-monospace">[FE-2]</text>
                <text x="390" y="235" fill="#ef4444" fontSize="9" fontWeight="700" fontFamily="ui-monospace">[FHR]</text>

                {/* ── WEST STAIRCASE A (Upper Left of Center) ── */}
                <g>
                  <rect x="290" y="50" width="110" height="180" fill="#091422" stroke="#1f3d63" strokeWidth="2" />
                  {/* Step Lines */}
                  {[70, 90, 110, 130, 150, 170, 190, 210].map((sy) => (
                    <line key={sy} x1="290" y1={sy} x2="400" y2={sy} stroke="#172e4a" strokeWidth="1" />
                  ))}
                  <path d="M 345 210 L 345 70 M 340 80 L 345 70 L 350 80" stroke="#38bdf8" strokeWidth="1.5" fill="none" opacity="0.6" />
                  <rect x="300" y="125" width="90" height="20" fill="rgba(5, 11, 20, 0.85)" rx="3" />
                  <text x="345" y="139" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace" fontWeight="700" textAnchor="middle">
                    STAIRWELL A
                  </text>
                </g>

                {/* ── ELEVATOR BANK (LIFT 1 & LIFT 2) ── */}
                <g>
                  <rect x="410" y="50" width="170" height="180" fill="#07111c" stroke="#1f3d63" strokeWidth="2" />
                  {/* Lift A */}
                  <rect x="425" y="65" width="65" height="95" fill="#0b1a2d" stroke="#254a77" strokeWidth="1.5" />
                  <line x1="425" y1="65" x2="490" y2="160" stroke="#172e4a" strokeWidth="1" />
                  <line x1="490" y1="65" x2="425" y2="160" stroke="#172e4a" strokeWidth="1" />
                  <text x="457" y="115" fill="#38bdf8" fontSize="10" fontFamily="ui-monospace" fontWeight="800" textAnchor="middle">
                    LIFT 1
                  </text>

                  {/* Lift B */}
                  <rect x="500" y="65" width="65" height="95" fill="#0b1a2d" stroke="#254a77" strokeWidth="1.5" />
                  <line x1="500" y1="65" x2="565" y2="160" stroke="#172e4a" strokeWidth="1" />
                  <line x1="565" y1="65" x2="500" y2="160" stroke="#172e4a" strokeWidth="1" />
                  <text x="532" y="115" fill="#38bdf8" fontSize="10" fontFamily="ui-monospace" fontWeight="800" textAnchor="middle">
                    LIFT 2
                  </text>

                  {/* Elevator Lobby */}
                  <text x="495" y="195" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace" textAnchor="middle">
                    ELEVATOR VESTIBULE
                  </text>
                </g>

                {/* ── SERVICE / UTILITY STATION ── */}
                <g>
                  <rect x="590" y="50" width="110" height="180" fill="#091422" stroke="#1f3d63" strokeWidth="2" />
                  <text x="645" y="125" fill="#64748b" fontSize="10" fontFamily="ui-monospace" fontWeight="700" textAnchor="middle">
                    {selectedFloor === 1 ? 'KEY CONTROL' : selectedFloor === 2 ? 'LINEN & SUPPLY' : 'HVAC ACCESS'}
                  </text>
                  <text x="645" y="142" fill="#475569" fontSize="9" fontFamily="ui-monospace" textAnchor="middle">
                    UTILITY RM
                  </text>
                </g>

                {/* ── EAST EMERGENCY FIRE EXIT (Lower Left of Center) ── */}
                <g>
                  <rect x="290" y="390" width="110" height="180" fill="#091422" stroke="#1f3d63" strokeWidth="2" />
                  {/* Step Lines */}
                  {[410, 430, 450, 470, 490, 510, 530, 550].map((sy) => (
                    <line key={sy} x1="290" y1={sy} x2="400" y2={sy} stroke="#172e4a" strokeWidth="1" />
                  ))}
                  <path d="M 345 410 L 345 550 M 340 540 L 345 550 L 350 540" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.7" />
                  <rect x="300" y="475" width="90" height="22" fill="#042f2e" stroke="#10b981" rx="3" strokeWidth="1" />
                  <text x="345" y="490" fill="#10b981" fontSize="10" fontFamily="ui-monospace" fontWeight="800" textAnchor="middle">
                    EXIT • FIRE STAIR
                  </text>
                </g>

                {/* ── COMMON AMENITIES / LOBBY FEATURE ── */}
                <g>
                  <rect x="410" y="390" width="290" height="180" fill="#07111c" stroke="#1f3d63" strokeWidth="2" />
                  {selectedFloor === 1 && (
                    <>
                      <rect x="440" y="420" width="230" height="60" fill="#0b1b30" stroke="#254a77" rx="6" />
                      <text x="555" y="455" fill="#fbbf24" fontSize="13" fontWeight="800" fontFamily="ui-monospace" textAnchor="middle">
                        MAIN CONCIERGE & DESK
                      </text>
                      <text x="555" y="525" fill="#64748b" fontSize="10" fontFamily="ui-monospace" textAnchor="middle">
                        GUEST CHECK-IN & RECEPTION LOUNGE
                      </text>
                    </>
                  )}
                  {selectedFloor === 2 && (
                    <>
                      <circle cx="555" cy="480" r="45" fill="none" stroke="#254a77" strokeWidth="2" strokeDasharray="4 4" />
                      <text x="555" y="475" fill="#38bdf8" fontSize="13" fontWeight="800" fontFamily="ui-monospace" textAnchor="middle">
                        GUEST LOUNGE
                      </text>
                      <text x="555" y="495" fill="#64748b" fontSize="10" fontFamily="ui-monospace" textAnchor="middle">
                        BEVERAGE & SEATING OASIS
                      </text>
                    </>
                  )}
                  {selectedFloor === 3 && (
                    <>
                      <rect x="440" y="430" width="230" height="100" fill="none" stroke="#254a77" strokeWidth="1.5" strokeDasharray="8 4" />
                      <text x="555" y="475" fill="#a78bfa" fontSize="13" fontWeight="800" fontFamily="ui-monospace" textAnchor="middle">
                        EXECUTIVE ATRIUM
                      </text>
                      <text x="555" y="495" fill="#64748b" fontSize="10" fontFamily="ui-monospace" textAnchor="middle">
                        SKYLIGHT OBSERVATION DECK
                      </text>
                    </>
                  )}
                </g>

                {/* ── 4 GUEST ROOMS FOR THIS FLOOR ── */}
                {floorRooms.map((rm, idx) => {
                  const roomIndex = (idx % 4) + 1;
                  const cfg = ROOM_LAYOUT_CONFIG[roomIndex];
                  const { allIncidents, allServices, filteredIncidents, filteredServices, hasEmergency, hasHighHazard, totalCount } =
                    getRoomReports(rm);

                  const isSelected =
                    selectedEntity?.type === 'ROOM' && selectedEntity.data.id === rm.id;

                  const isOccupied = rm.operationalStatus === 'OCCUPIED';
                  const isMaintenance = rm.operationalStatus === 'MAINTENANCE';
                  const activeStay = rm.stays && rm.stays[0];

                  // Status border color
                  let borderColor = '#1f3d63';
                  let bgColor = 'rgba(11, 26, 45, 0.4)';

                  if (hasEmergency) {
                    borderColor = '#ef4444';
                    bgColor = 'rgba(239, 68, 68, 0.14)';
                  } else if (hasHighHazard) {
                    borderColor = '#f59e0b';
                    bgColor = 'rgba(245, 158, 11, 0.12)';
                  } else if (isOccupied) {
                    borderColor = '#2563eb';
                    bgColor = 'rgba(37, 99, 235, 0.08)';
                  }

                  return (
                    <g
                      key={rm.id}
                      className={`bp-room ${isSelected ? 'selected' : ''} ${hasEmergency ? 'has-incident' : ''}`}
                      onClick={() => {
                        setSelectedEntity({ type: 'ROOM', data: rm });
                        if (onSelectRoom) onSelectRoom(rm);
                      }}
                    >
                      {/* Room Interior Polygon */}
                      <rect
                        x={cfg.x}
                        y={cfg.y}
                        width={cfg.width}
                        height={cfg.height}
                        rx="2"
                        className="bp-room-bg"
                        fill={bgColor}
                        stroke={borderColor}
                        strokeWidth={isSelected ? '3' : '2'}
                      />

                      {/* Exterior Windows (Fine double lines on exterior edge) */}
                      {roomIndex <= 2 ? (
                        // North Wall Window
                        <g stroke="#38bdf8" strokeWidth="1.5" opacity="0.65">
                          <line x1={cfg.x + 50} y1={cfg.y} x2={cfg.x + 180} y2={cfg.y} stroke="#f8fafc" strokeWidth="2.5" />
                          <line x1={cfg.x + 50} y1={cfg.y - 2} x2={cfg.x + 180} y2={cfg.y - 2} />
                        </g>
                      ) : (
                        // South Wall Window
                        <g stroke="#38bdf8" strokeWidth="1.5" opacity="0.65">
                          <line x1={cfg.x + 50} y1={cfg.y + cfg.height} x2={cfg.x + 180} y2={cfg.y + cfg.height} stroke="#f8fafc" strokeWidth="2.5" />
                          <line x1={cfg.x + 50} y1={cfg.y + cfg.height + 2} x2={cfg.x + 180} y2={cfg.y + cfg.height + 2} />
                        </g>
                      )}

                      {/* Architectural Door Swing Arc */}
                      <g stroke="#38bdf8" strokeWidth="1.2" fill="none" opacity="0.6">
                        {roomIndex === 1 && (
                          <>
                            <line x1="280" y1="190" x2="280" y2="230" stroke="#040811" strokeWidth="4" />
                            <path d="M 280 230 A 35 35 0 0 1 245 195" strokeDasharray="3 3" />
                            <line x1="280" y1="230" x2="245" y2="195" />
                          </>
                        )}
                        {roomIndex === 2 && (
                          <>
                            <line x1="720" y1="190" x2="720" y2="230" stroke="#040811" strokeWidth="4" />
                            <path d="M 720 230 A 35 35 0 0 0 755 195" strokeDasharray="3 3" />
                            <line x1="720" y1="230" x2="755" y2="195" />
                          </>
                        )}
                        {roomIndex === 3 && (
                          <>
                            <line x1="280" y1="390" x2="280" y2="430" stroke="#040811" strokeWidth="4" />
                            <path d="M 280 390 A 35 35 0 0 0 245 425" strokeDasharray="3 3" />
                            <line x1="280" y1="390" x2="245" y2="425" />
                          </>
                        )}
                        {roomIndex === 4 && (
                          <>
                            <line x1="720" y1="390" x2="720" y2="430" stroke="#040811" strokeWidth="4" />
                            <path d="M 720 390 A 35 35 0 0 1 755 425" strokeDasharray="3 3" />
                            <line x1="720" y1="390" x2="755" y2="425" />
                          </>
                        )}
                      </g>

                      {/* Technical Room Labels */}
                      <text
                        x={cfg.labelX}
                        y={cfg.labelY - 14}
                        fill="#f8fafc"
                        fontSize="20"
                        fontWeight="900"
                        fontFamily="ui-monospace"
                        textAnchor="middle"
                        letterSpacing="1"
                      >
                        ROOM {rm.roomNumber}
                      </text>

                      <text
                        x={cfg.labelX}
                        y={cfg.labelY + 6}
                        fill="#94a3b8"
                        fontSize="11"
                        fontFamily="ui-monospace"
                        textAnchor="middle"
                        letterSpacing="1.5"
                      >
                        {rm.roomType}
                      </text>

                      {/* Occupancy Status Pill */}
                      <g transform={`translate(${cfg.labelX - 45}, ${cfg.labelY + 16})`}>
                        <rect
                          width="90"
                          height="18"
                          rx="4"
                          fill={
                            isOccupied
                              ? 'rgba(56, 189, 248, 0.15)'
                              : isMaintenance
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)'
                          }
                          stroke={
                            isOccupied
                              ? '#38bdf8'
                              : isMaintenance
                              ? '#f59e0b'
                              : '#10b981'
                          }
                          strokeWidth="1"
                        />
                        <text
                          x="45"
                          y="13"
                          fill={
                            isOccupied
                              ? '#38bdf8'
                              : isMaintenance
                              ? '#f59e0b'
                              : '#10b981'
                          }
                          fontSize="9.5"
                          fontWeight="700"
                          fontFamily="ui-monospace"
                          textAnchor="middle"
                        >
                          {rm.operationalStatus}
                        </text>
                      </g>

                      {/* Guest Stay Indicator */}
                      {activeStay && (
                        <text
                          x={cfg.labelX}
                          y={cfg.labelY + 48}
                          fill="#cbd5e1"
                          fontSize="10"
                          fontFamily="ui-monospace"
                          textAnchor="middle"
                        >
                          {activeStay.guest?.name}
                        </text>
                      )}

                      {/* ── ACTIVE INCIDENT & SERVICE REQUEST MARKERS ── */}
                      {totalCount > 0 && (
                        <g
                          transform={`translate(${roomIndex % 2 === 1 ? cfg.x + 25 : cfg.x + cfg.width - 25}, ${
                            roomIndex <= 2 ? cfg.y + 25 : cfg.y + cfg.height - 25
                          })`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Select highest priority report or open room
                            if (filteredIncidents.length > 0) {
                              setSelectedEntity({ type: 'INCIDENT', data: filteredIncidents[0] });
                            } else if (filteredServices.length > 0) {
                              setSelectedEntity({ type: 'SERVICE', data: filteredServices[0] });
                            } else {
                              setSelectedEntity({ type: 'ROOM', data: rm });
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Pulsing Radar Ring for Critical */}
                          {hasEmergency && (
                            <>
                              <circle cx="0" cy="0" r="14" fill="url(#criticalGlow)" />
                              <circle cx="0" cy="0" r="10" className="radar-wave" fill="none" stroke="#ef4444" strokeWidth="2" />
                            </>
                          )}

                          {/* Pin Body */}
                          <circle
                            cx="0"
                            cy="0"
                            r="14"
                            fill={hasEmergency ? '#ef4444' : hasHighHazard ? '#f59e0b' : '#06b6d4'}
                            stroke="#f8fafc"
                            strokeWidth="2"
                            filter="drop-shadow(0 0 6px rgba(0,0,0,0.8))"
                          />

                          {/* Marker Icon / Count */}
                          <text
                            x="0"
                            y="4.5"
                            fill="#fff"
                            fontSize="11"
                            fontWeight="900"
                            fontFamily="ui-monospace"
                            textAnchor="middle"
                          >
                            {totalCount > 1 ? totalCount : hasEmergency ? '!' : hasHighHazard ? '▲' : '•'}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* ── AUTOMATED PROXIMITY DISPATCH VECTORS ── */}
                {activeFloorIncidentsWithDispatch.map((vector, vIdx) => {
                  const midX = (vector.responderPos.x + vector.roomPos.x) / 2;
                  const midY = (vector.responderPos.y + vector.roomPos.y) / 2;
                  return (
                    <g key={`vector-${vector.incident.id || vIdx}`} className="dispatch-vector-group">
                      {/* Animated dashed line */}
                      <line
                        x1={vector.responderPos.x}
                        y1={vector.responderPos.y}
                        x2={vector.roomPos.x}
                        y2={vector.roomPos.y}
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                      {/* Target Pulse at Room Door */}
                      <circle
                        cx={vector.roomPos.x}
                        cy={vector.roomPos.y}
                        r="6"
                        fill="#ef4444"
                        opacity="0.9"
                      />
                      {/* Midpoint Distance Badge */}
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x="-62"
                          y="-11"
                          width="124"
                          height="22"
                          rx="4"
                          fill="#090d16"
                          stroke="#ef4444"
                          strokeWidth="1.5"
                        />
                        <text
                          x="0"
                          y="4"
                          fill="#fca5a5"
                          fontSize="8.5"
                          fontWeight="900"
                          fontFamily="ui-monospace"
                          textAnchor="middle"
                        >
                          [DISPATCH] ~{vector.estimatedMeters}m
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* ── LIVE STAFF RESPONDER POSITIONS ON THIS FLOOR ── */}
                {floorStaff.map((sp, sIdx) => {
                  const x = sp.coordinates?.x || 500;
                  const y = sp.coordinates?.y || 350;
                  const staffName = sp.staff?.name || 'On-Duty Responder';
                  const firstName = staffName.split(' ')[0].toUpperCase();
                  const roleCode =
                    sp.staff?.role === 'SECURITY'
                      ? 'SEC'
                      : sp.staff?.role === 'MAINTENANCE'
                      ? 'ENG'
                      : 'HKP';

                  return (
                    <g key={sp.staff?.id || sIdx} className="staff-responder-pin" style={{ cursor: 'pointer' }}>
                      {/* Outer radar ripple ring */}
                      <circle
                        cx={x}
                        cy={y}
                        r="20"
                        fill="rgba(14, 165, 233, 0.14)"
                        stroke="#0ea5e9"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                      {/* Staff pin badge */}
                      <circle
                        cx={x}
                        cy={y}
                        r="12"
                        fill="#0284c7"
                        stroke="#ffffff"
                        strokeWidth="2"
                        filter="drop-shadow(0 0 6px rgba(14, 165, 233, 0.6))"
                      />
                      {/* Role abbreviation text */}
                      <text
                        x={x}
                        y={y + 3.5}
                        fill="#ffffff"
                        fontSize="8.5"
                        fontWeight="900"
                        fontFamily="ui-monospace"
                        textAnchor="middle"
                      >
                        {roleCode}
                      </text>
                      {/* Name Label */}
                      <rect
                        x={x - 48}
                        y={y + 16}
                        width="96"
                        height="18"
                        rx="3"
                        fill="#090d16"
                        stroke="#0ea5e9"
                        strokeWidth="1"
                        opacity="0.95"
                      />
                      <text
                        x={x}
                        y={y + 28.5}
                        fill="#38bdf8"
                        fontSize="8.5"
                        fontWeight="800"
                        fontFamily="ui-monospace"
                        textAnchor="middle"
                      >
                        {firstName} • {roleCode}
                      </text>
                    </g>
                  );
                })}

                {/* ── DYNAMIC EVACUATION EGRESS ROUTES ON THIS FLOOR ── */}
                {showEvacPaths &&
                  floorEvacRoutes.map((evacRoute, rIdx) => {
                    if (!evacRoute.svgPolyline) return null;
                    return (
                      <g key={`evac-${rIdx}`} className="blueprint-evac-route">
                        {/* Underlay glow */}
                        <polyline
                          points={evacRoute.svgPolyline}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="7"
                          opacity="0.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Animated dash line */}
                        <polyline
                          points={evacRoute.svgPolyline}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeDasharray="8 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Safe Exit Beacon Marker */}
                        {evacRoute.targetExit && (
                          <g transform={`translate(${evacRoute.targetExit.x}, ${evacRoute.targetExit.y})`}>
                            <circle cx="0" cy="0" r="16" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
                            <circle cx="0" cy="0" r="9" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                            <rect x="-45" y="14" width="90" height="16" rx="3" fill="#064e3b" stroke="#10b981" strokeWidth="1" />
                            <text x="0" y="25.5" fill="#a7f3d0" fontSize="8" fontWeight="800" fontFamily="ui-monospace" textAnchor="middle">
                              SAFE EGRESS
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
              </svg>
            </div>
          </div>
        </div>

        {/* ── Side Inspector: Room / Report Details Drawer ── */}
        <div className="blueprint-inspector">
          {/* Active Detail Inspector */}
          {selectedEntity ? (
            <div className="inspector-card">
              <div className="inspector-header">
                <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--brand-light)', fontWeight: 700 }}>
                  {selectedEntity.type === 'ROOM' ? 'ROOM INSPECTION' : selectedEntity.type === 'INCIDENT' ? 'EMERGENCY DISPATCH' : 'SERVICE TICKET'}
                </span>
                <button
                  onClick={() => setSelectedEntity(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {/* ROOM INSPECTOR */}
              {selectedEntity.type === 'ROOM' && (
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Room {selectedEntity.data.roomNumber}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Floor {selectedEntity.data.floor} • {selectedEntity.data.roomType} Suite
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
                    <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>STATUS</span>
                      <strong style={{ color: selectedEntity.data.operationalStatus === 'OCCUPIED' ? '#38bdf8' : '#10b981' }}>
                        {selectedEntity.data.operationalStatus}
                      </strong>
                    </div>
                    <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>STAY STATE</span>
                      <strong>{selectedEntity.data.stays?.[0] ? 'Checked In' : 'Vacant'}</strong>
                    </div>
                  </div>

                  {/* Stay Details */}
                  {selectedEntity.data.stays?.[0] && (
                    <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '14px' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>REGISTERED GUEST</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selectedEntity.data.stays[0].guest?.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{selectedEntity.data.stays[0].guest?.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        In: {new Date(selectedEntity.data.stays[0].checkInAt).toLocaleDateString()} • Out: {new Date(selectedEntity.data.stays[0].scheduledCheckoutAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {/* Active Incidents in this room */}
                  {(() => {
                    const roomIncidents = activeIncidents.filter(
                      (i) => i.roomId === selectedEntity.data.id || i.room?.roomNumber === selectedEntity.data.roomNumber
                    );
                    if (roomIncidents.length === 0) return null;
                    return (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-critical)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldAlertIcon size={14} color="var(--color-critical)" />
                          <span>ACTIVE CRISIS REPORTS ({roomIncidents.length})</span>
                        </div>
                        {roomIncidents.map((inc) => (
                          <div
                            key={inc.id}
                            style={{
                              background: 'var(--color-critical-bg)',
                              border: '1px solid var(--color-critical-border)',
                              borderRadius: '4px',
                              padding: '8px 10px',
                              marginBottom: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedEntity({ type: 'INCIDENT', data: inc })}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                              <span>{inc.category.replace(/_/g, ' ')}</span>
                              <span style={{ color: 'var(--color-critical)' }}>{inc.priority}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {inc.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Active Routine Services in this room */}
                  {(() => {
                    const roomServices = activeServices.filter(
                      (s) => s.roomId === selectedEntity.data.id || s.room?.roomNumber === selectedEntity.data.roomNumber
                    );
                    if (roomServices.length === 0) return null;
                    return (
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-low)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <BellIcon size={14} color="var(--color-low)" />
                          <span>PENDING SERVICE REQUESTS ({roomServices.length})</span>
                        </div>
                        {roomServices.map((srv) => (
                          <div
                            key={srv.id}
                            style={{
                              background: 'var(--color-low-bg)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              borderRadius: '4px',
                              padding: '8px 10px',
                              marginBottom: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedEntity({ type: 'SERVICE', data: srv })}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                              <span>{srv.category.replace(/_/g, ' ')}</span>
                              <span style={{ color: '#38bdf8' }}>{srv.status}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {srv.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* INCIDENT INSPECTOR */}
              {selectedEntity.type === 'INCIDENT' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      backgroundColor: selectedEntity.data.priority === 'CRITICAL' ? 'var(--color-critical-bg)' : 'var(--color-high-bg)',
                      color: selectedEntity.data.priority === 'CRITICAL' ? 'var(--color-critical)' : 'var(--color-high)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}>
                      {selectedEntity.data.priority} PRIORITY
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(selectedEntity.data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '6px' }}>
                    {selectedEntity.data.category.replace(/_/g, ' ')}
                  </h3>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.4 }}>
                    {selectedEntity.data.description}
                  </div>

                  <div style={{ background: 'var(--bg-app)', padding: '10px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '14px' }}>
                    <div>Location Reference: <strong>Room {selectedEntity.data.room?.roomNumber || 'Unknown'} (Floor {selectedEntity.data.room?.floor || selectedFloor})</strong></div>
                    <div style={{ marginTop: '4px' }}>Status: <strong>{selectedEntity.data.status}</strong></div>
                    {selectedEntity.data.reporter && (
                      <div style={{ marginTop: '4px' }}>
                        Reporter: <strong>{selectedEntity.data.reporter.name}</strong>
                      </div>
                    )}
                  </div>

                  {/* Guest Physical Location Clarification (If outside room) */}
                  {(() => {
                    const locEvent = selectedEntity.data.events?.find(
                      (ev) => ev.eventType === 'LOCATION_SPECIFIED' || ev.description?.includes('clarified physical location')
                    );
                    if (!locEvent) return null;
                    return (
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.10)',
                        border: '1px solid rgba(245, 158, 11, 0.30)',
                        borderRadius: 'var(--radius-xs)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        color: '#fbbf24',
                        marginBottom: '14px',
                      }}>
                        <div style={{ fontSize: '0.74rem', color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <MapPinIcon size={13} color="#fbbf24" />
                          <span>Reported Physical Location:</span>
                        </div>
                        <div style={{ color: '#f8fafc', fontWeight: 600, marginTop: '3px' }}>
                          {locEvent.description.replace('Guest clarified physical location: ', '')}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Device GPS Location (If captured) */}
                  {(() => {
                    const gpsEvent = selectedEntity.data.events?.find(
                      (ev) => ev.eventType === 'GPS_COORDINATES_CAPTURED' && ev.metadata?.latitude
                    );
                    const descMatch = selectedEntity.data.description?.match(/\[GPS: ([0-9.-]+), ([0-9.-]+)( ±\d+m)?\]/);

                    const lat = gpsEvent?.metadata?.latitude || (descMatch && parseFloat(descMatch[1]));
                    const lng = gpsEvent?.metadata?.longitude || (descMatch && parseFloat(descMatch[2]));
                    const acc = gpsEvent?.metadata?.accuracy ? `±${Math.round(gpsEvent.metadata.accuracy)}m` : (descMatch?.[3] ? descMatch[3].trim() : null);

                    if (!lat || !lng) return null;

                    return (
                      <div style={{
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.30)',
                        borderRadius: 'var(--radius-xs)',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        color: '#38bdf8',
                        marginBottom: '14px',
                      }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPinIcon size={14} color="#38bdf8" />
                          <span>Device Coordinates Captured</span>
                          {acc && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>({acc})</span>}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#f8fafc', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${lat},${lng}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#fbbf24',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            marginTop: '6px',
                            textDecoration: 'underline',
                          }}
                        >
                          <ExternalLinkIcon size={12} color="#fbbf24" />
                          <span>View Coordinates on Google Maps ↗</span>
                        </a>
                      </div>
                    );
                  })()}

                  {/* Responder Assignment Info */}
                  <div style={{ background: 'var(--bg-app)', padding: '10px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '16px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '2px' }}>ASSIGNED DISPATCH</div>
                    {selectedEntity.data.assignments?.[0] ? (
                      <div>
                        <strong>{selectedEntity.data.assignments[0].assignee?.name}</strong> • State: <em>{selectedEntity.data.assignments[0].status}</em>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-critical)', fontWeight: 600 }}>No responder dispatched yet!</span>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {onAssignIncident && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={() => onAssignIncident(selectedEntity.data)}
                      >
                        <UserIcon size={14} />
                        <span>Dispatch Staff Responder</span>
                      </button>
                    )}
                    {onEscalateIncident && selectedEntity.data.status !== 'ESCALATED' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--color-high)', borderColor: 'rgba(249,115,22,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={() => onEscalateIncident(selectedEntity.data)}
                      >
                        <AlertTriangleIcon size={14} color="var(--color-high)" />
                        <span>Escalate Priority</span>
                      </button>
                    )}
                    {onCloseIncident && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--color-success)', borderColor: 'rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={() => onCloseIncident(selectedEntity.data)}
                      >
                        <CheckCircleIcon size={14} color="var(--color-success)" />
                        <span>Resolve & Close Incident</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* SERVICE REQUEST INSPECTOR */}
              {selectedEntity.type === 'SERVICE' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      backgroundColor: 'var(--color-low-bg)',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-xs)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      SERVICE TICKET
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(selectedEntity.data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '6px' }}>
                    {selectedEntity.data.category.replace(/_/g, ' ')}
                  </h3>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    {selectedEntity.data.description}
                  </div>

                  <div style={{ background: 'var(--bg-app)', padding: '10px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '14px' }}>
                    <div>Location: <strong>Room {selectedEntity.data.room?.roomNumber || 'Unknown'} (Floor {selectedEntity.data.room?.floor || selectedFloor})</strong></div>
                    <div style={{ marginTop: '4px' }}>Status: <strong>{selectedEntity.data.status}</strong></div>
                  </div>

                  {onAssignService && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => onAssignService(selectedEntity.data)}
                    >
                      Assign Staff Member
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="inspector-card" style={{ textAlign: 'center', padding: '24px 14px', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>
                Select a room or marker to view details
              </span>
            </div>
          )}

          {/* ── Unassigned Reports Shelf (only shown when reports exist) ── */}
          {unlocatedReports.length > 0 && (
            <div className="unlocated-shelf">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangleIcon size={14} color="#fbbf24" />
                  <span>Unassigned Reports ({unlocatedReports.length})</span>
                </span>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {unlocatedReports.map((rpt) => (
                  <div
                    key={rpt.id}
                    className="unlocated-item"
                    onClick={() => {
                      if (rpt.isPublic) {
                        setSelectedEntity({
                          type: 'INCIDENT',
                          data: {
                            ...rpt,
                            category: rpt.category || 'PUBLIC_HAZARD',
                            priority: 'MEDIUM',
                            description: rpt.description,
                            status: rpt.status,
                            createdAt: rpt.createdAt,
                          },
                        });
                      } else {
                        setSelectedEntity({ type: 'INCIDENT', data: rpt });
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 }}>
                      <span style={{ color: rpt.isPublic ? '#38bdf8' : 'var(--color-critical)' }}>
                        {rpt.isPublic ? 'Bystander Report' : 'Unlocated Incident'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.70rem', fontFamily: 'var(--font-mono)' }}>
                        {new Date(rpt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rpt.description || rpt.locationContext || 'Hazard reported'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
