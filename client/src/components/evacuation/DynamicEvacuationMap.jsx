import React, { useState, useMemo } from 'react';
import { calculateSafestEvacuationPath } from '../../utils/evacuationRouter';
import {
  ShieldAlertIcon,
  CheckCircleIcon,
  MapPinIcon,
  AlertTriangleIcon,
} from '../common/Icons';

export function DynamicEvacuationMap({
  locationKey = 'ROOM',
  roomNumber = '101',
  floor = 1,
  activeIncidents = [],
  embedded = false,
}) {
  // Interactive Simulation state for demonstrations
  const [simulatedHazardOverride, setSimulatedHazardOverride] = useState(null);

  // Compute safest evacuation route
  const route = useMemo(() => {
    return calculateSafestEvacuationPath({
      startLocationKey: locationKey,
      roomNumber,
      floor,
      activeIncidents,
      simulatedHazard: simulatedHazardOverride,
    });
  }, [locationKey, roomNumber, floor, activeIncidents, simulatedHazardOverride]);

  const {
    startWaypoint,
    targetExit,
    blockedExits,
    hazard,
    pathNodes,
    svgPolyline,
    totalDistanceMeters,
    steps,
    isRerouted,
  } = route;

  return (
    <div
      className="card card-elevated"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '2px solid rgba(16, 185, 129, 0.4)',
        borderRadius: 'var(--radius-md)',
        padding: embedded ? '16px' : '22px',
        marginBottom: '24px',
        boxShadow: '0 0 25px rgba(16, 185, 129, 0.12)',
      }}
    >
      {/* ── Top Header / Status Telemetry ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
          borderBottom: '1px solid var(--border-muted)',
          paddingBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircleIcon size={20} color="#10b981" />
          </div>
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#10b981',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Dynamic Evacuation Wayfinding Active</span>
              <span className="pulse-dot pulse-dot-success" style={{ width: '5px', height: '5px' }} />
            </div>
            <h3
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '2px 0 0 0',
              }}
            >
              Safest Egress: {targetExit?.label || 'Emergency Exit'}
            </h3>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isRerouted && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#fbbf24',
                backgroundColor: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <AlertTriangleIcon size={13} color="#fbbf24" />
              <span>Hazard Avoidance Active</span>
            </span>
          )}

          <div
            style={{
              textAlign: 'right',
              backgroundColor: 'var(--bg-app)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
              TOTAL EGRESS DISTANCE
            </span>
            <strong
              style={{
                fontSize: '1.1rem',
                color: '#10b981',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ~{totalDistanceMeters}m to Safety
            </strong>
          </div>
        </div>
      </div>

      {/* ── Interactive Judge Simulation Bar ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border-muted)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-xs)',
          marginBottom: '14px',
        }}
      >
        <span
          style={{
            fontSize: '0.70rem',
            color: 'var(--text-muted)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Dynamic Path Test Controls:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '0.72rem',
              padding: '6px 8px',
              borderColor: simulatedHazardOverride?.key === 'WEST' ? '#ef4444' : undefined,
              color: simulatedHazardOverride?.key === 'WEST' ? '#ef4444' : undefined,
              whiteSpace: 'normal',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
            onClick={() =>
              setSimulatedHazardOverride({
                key: 'WEST',
                x: 280,
                y: 190,
                label: 'Room 101 Fire (West Corridor Blocked)',
                blockedExitId: 'EXIT_A',
              })
            }
          >
            West Fire (Reroute East)
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '0.72rem',
              padding: '6px 8px',
              borderColor: simulatedHazardOverride?.key === 'EAST' ? '#ef4444' : undefined,
              color: simulatedHazardOverride?.key === 'EAST' ? '#ef4444' : undefined,
              whiteSpace: 'normal',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
            onClick={() =>
              setSimulatedHazardOverride({
                key: 'EAST',
                x: 720,
                y: 190,
                label: 'Room 102 Electrical Fire (East Corridor Blocked)',
                blockedExitId: 'EXIT_EAST',
              })
            }
          >
            East Fire (Reroute West)
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '0.72rem',
              padding: '6px 8px',
              borderColor: simulatedHazardOverride?.key === 'STAIR_A' ? '#ef4444' : undefined,
              color: simulatedHazardOverride?.key === 'STAIR_A' ? '#ef4444' : undefined,
              whiteSpace: 'normal',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
            onClick={() =>
              setSimulatedHazardOverride({
                key: 'STAIR_A',
                x: 345,
                y: 240,
                label: 'Stairwell A Smoke Contamination',
                blockedExitId: 'EXIT_A',
              })
            }
          >
            Stair A Blocked (Use B)
          </button>
          {simulatedHazardOverride && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.72rem', padding: '6px 8px', lineHeight: 1.2 }}
              onClick={() => setSimulatedHazardOverride(null)}
            >
              Reset Live Detection
            </button>
          )}
        </div>
      </div>

      {/* ── Architectural SVG Evacuation Stage ── */}
      <div
        style={{
          width: '100%',
          backgroundColor: '#040811',
          border: '1px solid #162a45',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
      >
        <svg
          viewBox="0 0 1000 620"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Dark millimeter architectural grid */}
            <pattern id="evacGrid" width="25" height="25" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="25" y2="0" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="0.5" />
              <line x1="0" y1="0" x2="0" y2="25" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="0.5" />
            </pattern>

            {/* Glowing red pulse gradient for hazard zones */}
            <radialGradient id="hazardGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>

            {/* Safe Exit beacon pulse gradient */}
            <radialGradient id="safeBeaconGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>

            {/* CSS Animation for animated directional dashes along evacuation line */}
            <style>
              {`
                @keyframes flowChevrons {
                  from { stroke-dashoffset: 0; }
                  to { stroke-dashoffset: -32; }
                }
                .evac-path-animated {
                  animation: flowChevrons 1s linear infinite;
                }
              `}
            </style>
          </defs>

          {/* Grid Background */}
          <rect width="1000" height="620" fill="#040811" />
          <rect width="1000" height="620" fill="url(#evacGrid)" />

          {/* Perimeter Outer Walls */}
          <rect x="30" y="30" width="940" height="560" rx="4" fill="none" stroke="#162a45" strokeWidth="5" />

          {/* Central Corridor Egress Zone */}
          <rect
            x="50"
            y="240"
            width="900"
            height="140"
            fill="rgba(14, 31, 54, 0.5)"
            stroke="#162a45"
            strokeWidth="2"
          />
          <text
            x="500"
            y="262"
            fill="#475569"
            fontSize="10"
            fontFamily="ui-monospace"
            textAnchor="middle"
            letterSpacing="2"
          >
            CENTRAL CORRIDOR EGRESS PASSAGE // LEVEL {floor}.00
          </text>

          {/* 4 Guest Rooms Outlines */}
          {/* Room 1 (NW) */}
          <rect x="50" y="50" width="230" height="180" fill="rgba(11, 26, 45, 0.4)" stroke="#1f3d63" strokeWidth="1.5" />
          <text x="165" y="145" fill="#64748b" fontSize="14" fontWeight="800" fontFamily="ui-monospace" textAnchor="middle">
            ROOM {floor}01
          </text>

          {/* Room 2 (NE) */}
          <rect x="720" y="50" width="230" height="180" fill="rgba(11, 26, 45, 0.4)" stroke="#1f3d63" strokeWidth="1.5" />
          <text x="835" y="145" fill="#64748b" fontSize="14" fontWeight="800" fontFamily="ui-monospace" textAnchor="middle">
            ROOM {floor}02
          </text>

          {/* Room 3 (SW) */}
          <rect x="50" y="390" width="230" height="180" fill="rgba(11, 26, 45, 0.4)" stroke="#1f3d63" strokeWidth="1.5" />
          <text x="165" y="485" fill="#64748b" fontSize="14" fontWeight="800" fontFamily="ui-monospace" textAnchor="middle">
            ROOM {floor}03
          </text>

          {/* Room 4 (SE) */}
          <rect x="720" y="390" width="230" height="180" fill="rgba(11, 26, 45, 0.4)" stroke="#1f3d63" strokeWidth="1.5" />
          <text x="835" y="485" fill="#64748b" fontSize="14" fontWeight="800" fontFamily="ui-monospace" textAnchor="middle">
            ROOM {floor}04
          </text>

          {/* Stairwell A (West Stairs) */}
          <g>
            <rect x="290" y="50" width="110" height="180" fill="#091422" stroke="#1f3d63" strokeWidth="1.5" />
            <text x="345" y="145" fill="#94a3b8" fontSize="11" fontFamily="ui-monospace" fontWeight="700" textAnchor="middle">
              STAIRWELL A
            </text>
          </g>

          {/* Elevator Bank (Disabled during major fire) */}
          <g opacity="0.6">
            <rect x="410" y="50" width="170" height="180" fill="#07111c" stroke="#1f3d63" strokeWidth="1.5" />
            <text x="495" y="130" fill="#ef4444" fontSize="10" fontFamily="ui-monospace" fontWeight="800" textAnchor="middle">
              [LIFTS 1 & 2 DISABLED]
            </text>
            <text x="495" y="148" fill="#64748b" fontSize="9" fontFamily="ui-monospace" textAnchor="middle">
              DO NOT USE IN EMERGENCY
            </text>
          </g>

          {/* East Emergency Fire Stair B */}
          <g>
            <rect x="290" y="390" width="110" height="180" fill="#091422" stroke="#1f3d63" strokeWidth="1.5" />
            <text x="345" y="485" fill="#10b981" fontSize="11" fontFamily="ui-monospace" fontWeight="800" textAnchor="middle">
              FIRE STAIR B
            </text>
          </g>

          {/* Central Lounge / Main Lobby Exit */}
          <g>
            <rect x="410" y="390" width="290" height="180" fill="#07111c" stroke="#1f3d63" strokeWidth="1.5" />
            <text x="555" y="485" fill="#fbbf24" fontSize="11" fontFamily="ui-monospace" fontWeight="700" textAnchor="middle">
              {floor === 1 ? 'MAIN LOBBY & STREET EXIT' : 'CENTRAL ATRIUM'}
            </text>
          </g>

          {/* ── HAZARD DANGER ZONE (Pulsing Red Area) ── */}
          {hazard && (
            <g className="hazard-zone">
              <circle cx={hazard.x} cy={hazard.y} r="80" fill="url(#hazardGlow)" />
              <circle cx={hazard.x} cy={hazard.y} r="50" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx={hazard.x} cy={hazard.y} r="14" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
              <text x={hazard.x} y={hazard.y + 4.5} fill="#fff" fontSize="11" fontWeight="900" fontFamily="ui-monospace" textAnchor="middle">
                !
              </text>
              <rect x={hazard.x - 70} y={hazard.y + 20} width="140" height="22" rx="4" fill="#1e1b4b" stroke="#ef4444" strokeWidth="1" />
              <text x={hazard.x} y={hazard.y + 35} fill="#fca5a5" fontSize="8.5" fontWeight="900" fontFamily="ui-monospace" textAnchor="middle">
                [HAZARD] {hazard.label}
              </text>
            </g>
          )}

          {/* ── BLOCKED EXITS ── */}
          {blockedExits.map((bExit) => (
            <g key={bExit.id} transform={`translate(${bExit.x}, ${bExit.y})`}>
              <rect x="-65" y="-14" width="130" height="28" rx="4" fill="#450a0a" stroke="#ef4444" strokeWidth="1.5" />
              <text x="0" y="4" fill="#fca5a5" fontSize="9" fontWeight="900" fontFamily="ui-monospace" textAnchor="middle">
                [EXIT BLOCKED]
              </text>
            </g>
          ))}

          {/* ── COMPUTED SAFEST EVACUATION PATH (Green Glowing Line) ── */}
          {svgPolyline && (
            <g className="evacuation-egress-route">
              {/* Outer Glow Path */}
              <polyline
                points={svgPolyline}
                fill="none"
                stroke="#10b981"
                strokeWidth="8"
                opacity="0.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Animated Inner Directed Flow Line */}
              <polyline
                className="evac-path-animated"
                points={svgPolyline}
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeDasharray="10 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Waypoint Nodes along the path */}
              {pathNodes.map((node, nIdx) => (
                <circle
                  key={`node-${node.id || nIdx}`}
                  cx={node.x}
                  cy={node.y}
                  r="4"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          )}

          {/* ── SAFE EXIT TARGET BEACON ── */}
          {targetExit && (
            <g transform={`translate(${targetExit.x}, ${targetExit.y})`}>
              <circle cx="0" cy="0" r="26" fill="url(#safeBeaconGlow)" />
              <circle cx="0" cy="0" r="14" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
              <text x="0" y="4.5" fill="#fff" fontSize="11" fontWeight="900" fontFamily="ui-monospace" textAnchor="middle">
                EXIT
              </text>
              <rect x="-70" y="18" width="140" height="22" rx="4" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
              <text x="0" y="33" fill="#a7f3d0" fontSize="9" fontWeight="900" fontFamily="ui-monospace" textAnchor="middle">
                [SAFE EXIT] {targetExit.label.split(' ')[0]}
              </text>
            </g>
          )}

          {/* ── USER POSITION (YOU ARE HERE) ── */}
          <g transform={`translate(${startWaypoint.x}, ${startWaypoint.y})`}>
            {/* Pulsing ring */}
            <circle cx="0" cy="0" r="20" fill="rgba(56, 189, 248, 0.18)" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="0" cy="0" r="12" fill="#0284c7" stroke="#ffffff" strokeWidth="2.5" />
            <text x="0" y="4" fill="#ffffff" fontSize="9" fontWeight="900" fontFamily="ui-monospace" textAnchor="middle">
              YOU
            </text>
            <rect x="-55" y="-30" width="110" height="20" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
            <text x="0" y="-16" fill="#38bdf8" fontSize="8.5" fontWeight="900" fontFamily="ui-monospace" textAnchor="middle">
              YOU ARE HERE
            </text>
          </g>
        </svg>
      </div>

      {/* ── Turn-by-Turn Guidance HUD Steps ── */}
      <div>
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <MapPinIcon size={14} color="#10b981" />
          <span>Step-by-Step Safest Egress Instructions</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '8px',
          }}
        >
          {steps.map((st, sIdx) => (
            <div
              key={sIdx}
              style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-muted)',
                borderRadius: 'var(--radius-xs)',
                padding: '10px 12px',
                fontSize: '0.82rem',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {sIdx + 1}
              </span>
              <span style={{ lineHeight: 1.4 }}>{st}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
