import React, { useState, useEffect } from 'react';
import { apiFetch, getMediaUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../realtime/socket';
import { DynamicEvacuationMap } from '../../components/evacuation/DynamicEvacuationMap';
import { PhotoUploader } from '../../components/common/PhotoUploader';
import {
  ShieldAlertIcon,
  ShieldCheckIcon,
  BellIcon,
  MapPinIcon,
  CheckCircleIcon,
  FlameIcon,
  ZapIcon,
  DropletIcon,
  BedIcon,
  WrenchIcon,
  UserIcon,
  CameraIcon,
  RefreshCwIcon,
} from '../../components/common/Icons';

const EMERGENCY_CATEGORIES = [
  { value: 'FIRE_OR_SMOKE', label: 'Fire or Smoke Observed' },
  { value: 'MEDICAL_EMERGENCY', label: 'Medical Emergency' },
  { value: 'ELECTRICAL_HAZARD', label: 'Electrical Hazard / Spark' },
  { value: 'WATER_LEAKAGE', label: 'Water Leakage or Flooding' },
  { value: 'SECURITY_THREAT', label: 'Security or Safety Threat' },
  { value: 'OTHER', label: 'Other Life-Safety Hazard' },
];

const SERVICE_CATEGORIES = [
  { value: 'HOUSEKEEPING', label: 'Housekeeping & Room Turnover' },
  { value: 'EXTRA_AMENITIES', label: 'Extra Linens, Towels or Pillows' },
  { value: 'MAINTENANCE_PLUMBING', label: 'Plumbing & Fixture Repair' },
  { value: 'ELECTRICAL_APPLIANCE', label: 'Lighting, Climate Control or TV' },
  { value: 'GENERAL_ASSISTANCE', label: 'General Guest Support' },
];

export function GuestPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('EMERGENCY'); // 'EMERGENCY' | 'SERVICE'
  const [incidents, setIncidents] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derive guest's room and floor from stay or email fallback
  const activeStay = user?.stays?.[0];
  const activeRoomNumber = activeStay?.room?.roomNumber || (user?.email?.includes('101') ? '101' : user?.email?.includes('201') ? '201' : user?.email?.includes('301') ? '301' : '101');
  const activeFloor = activeStay?.room?.floor || (activeRoomNumber.startsWith('2') ? 2 : activeRoomNumber.startsWith('3') ? 3 : 1);

  // Demo Location Simulator state
  const [simulatedLocKey, setSimulatedLocKey] = useState(
    sessionStorage.getItem('athithi_location_handshake') || 'ROOM'
  );

  // Mandatory Check-in Handshake state
  const [showHandshakeModal, setShowHandshakeModal] = useState(
    !sessionStorage.getItem('athithi_location_handshake')
  );
  const [handshakeChoice, setHandshakeChoice] = useState(
    sessionStorage.getItem('athithi_location_handshake') || 'ROOM'
  );

  // SOS state
  const [sosLoading, setSosLoading] = useState(false);
  const [sosSuccess, setSosSuccess] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSeverityModal, setShowSeverityModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('OTHER');
  const [selectedPriority, setSelectedPriority] = useState('CRITICAL');
  const [severityCountdown, setSeverityCountdown] = useState(5);
  const [customDescription, setCustomDescription] = useState('');

  // Location clarification state
  const [locationUpdating, setLocationUpdating] = useState(false);
  const [locationSubmitted, setLocationSubmitted] = useState('');
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [customLocationText, setCustomLocationText] = useState('');

  // Evacuation Wayfinding Map state
  const [showEvacMapOverride, setShowEvacMapOverride] = useState(null);
  const hasMajorEmergency =
    !!sosSuccess ||
    incidents.some(
      (i) =>
        i.status !== 'CLOSED' &&
        (['CRITICAL', 'HIGH'].includes(i.priority) ||
          ['FIRE_OR_SMOKE', 'SECURITY_THREAT', 'ELECTRICAL_HAZARD'].includes(i.category))
    );
  const isEvacMapVisible = showEvacMapOverride !== null ? showEvacMapOverride : hasMajorEmergency;

  // Service Request form state
  const [serviceCategory, setServiceCategory] = useState('HOUSEKEEPING');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePhotoUrl, setServicePhotoUrl] = useState(null);
  const [serviceLoading, setServiceLoading] = useState(false);

  // Hazard Photo state
  const [hazardPhotoUrl, setHazardPhotoUrl] = useState(null);

  const loadData = async () => {
    try {
      const [incData, srvData] = await Promise.all([
        apiFetch('/incidents/mine'),
        apiFetch('/service-requests/mine'),
      ]);
      setIncidents(incData.incidents || []);
      setServiceRequests(srvData.requests || []);
    } catch (err) {
      console.error(err);
      if (err.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    const handleUpdate = () => {
      loadData();
    };

    socket.on('incident:created', handleUpdate);
    socket.on('incident:updated', handleUpdate);
    socket.on('service_request:created', handleUpdate);
    socket.on('service_request:updated', handleUpdate);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', loadData);
    const syncTimer = setInterval(loadData, 25000);

    return () => {
      socket.off('incident:created', handleUpdate);
      socket.off('incident:updated', handleUpdate);
      socket.off('service_request:created', handleUpdate);
      socket.off('service_request:updated', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', loadData);
      clearInterval(syncTimer);
    };
  }, []);

  const getDeviceLocation = async () => {
    if (simulatedLocKey === 'REAL') {
      return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          },
          () => resolve(null),
          { timeout: 3000, maximumAge: 30000, enableHighAccuracy: true }
        );
      });
    }

    // High-precision simulated GPS at Grand Athithi Hotel, 42 Marina Drive, Mumbai
    const roomOffset = (parseInt(activeRoomNumber, 10) % 10) * 0.00003;
    const floorOffset = activeFloor * 0.00004;

    const locMap = {
      ROOM: {
        latitude: 18.92982 + roomOffset,
        longitude: 72.82361 + floorOffset,
        accuracy: 3,
      },
      POOL: {
        latitude: 18.92965,
        longitude: 72.82385,
        accuracy: 4,
      },
      GYM: {
        latitude: 18.92978,
        longitude: 72.82350,
        accuracy: 3,
      },
      LOBBY: {
        latitude: 18.92972,
        longitude: 72.82362,
        accuracy: 4,
      },
    };

    return locMap[simulatedLocKey] || locMap.ROOM;
  };

  // Severity countdown timer: auto-dispatches if user doesn't cancel within 5 seconds
  useEffect(() => {
    if (!showSeverityModal) {
      setSeverityCountdown(5);
      return;
    }

    const timer = setInterval(() => {
      setSeverityCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showSeverityModal]);

  useEffect(() => {
    if (showSeverityModal && severityCountdown === 0) {
      triggerSOS(
        selectedCategory || 'OTHER',
        customDescription || 'Immediate Emergency Assistance Requested',
        selectedPriority
      );
    }
  }, [showSeverityModal, severityCountdown]);

  const triggerSOS = async (
    category = 'OTHER',
    description = 'Immediate Emergency Assistance Requested',
    priority = 'CRITICAL',
    photoUrl = null
  ) => {
    setSosLoading(true);
    setShowSeverityModal(false);
    try {
      const coordinates = await getDeviceLocation();

      let finalDesc = description;
      if (simulatedLocKey !== 'ROOM' && simulatedLocKey !== 'REAL') {
        const locLabels = {
          POOL: 'Swimming Pool & Sun Deck (Ground Floor)',
          GYM: 'Fitness Center & Spa (Floor 2)',
          LOBBY: 'Main Lobby & Reception (Ground Floor)',
        };
        if (locLabels[simulatedLocKey]) {
          finalDesc = `${description} [Location: ${locLabels[simulatedLocKey]}]`;
        }
      }

      const activePhotoUrl = photoUrl || hazardPhotoUrl;

      const data = await apiFetch('/incidents/sos', {
        method: 'POST',
        body: JSON.stringify({
          category,
          priority,
          description: finalDesc,
          coordinates,
          photoUrl: activePhotoUrl || undefined,
        }),
      });
      setSosSuccess(data.incident);
      setLocationSubmitted('');
      setShowCategoryModal(false);
      setCustomDescription('');
      setHazardPhotoUrl(null);
      loadData();

      // If user simulated being in common area (pool/gym/lobby), clarify location on incident event log
      if (simulatedLocKey !== 'ROOM' && simulatedLocKey !== 'REAL') {
        const locLabels = {
          POOL: 'Swimming Pool & Sun Deck (Ground Floor)',
          GYM: 'Fitness Center & Spa (Floor 2)',
          LOBBY: 'Main Lobby & Reception (Ground Floor)',
        };
        const label = locLabels[simulatedLocKey];
        if (label) {
          try {
            await apiFetch(`/incidents/${data.incident.id}/events`, {
              method: 'POST',
              body: JSON.stringify({
                eventType: 'LOCATION_SPECIFIED',
                description: `Guest clarified physical location: ${label}`,
              }),
            });
            setLocationSubmitted(label);
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to trigger SOS');
    } finally {
      setSosLoading(false);
    }
  };

  const updateGuestLocation = async (locationStr) => {
    if (!sosSuccess) return;
    setLocationUpdating(true);
    try {
      await apiFetch(`/incidents/${sosSuccess.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'LOCATION_SPECIFIED',
          description: `Guest clarified physical location: ${locationStr}`,
        }),
      });
      setLocationSubmitted(locationStr);
      setShowCustomLocation(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update location');
    } finally {
      setLocationUpdating(false);
    }
  };

  const submitServiceRequest = async (e) => {
    e.preventDefault();
    if (!serviceDescription.trim()) return;
    setServiceLoading(true);
    try {
      await apiFetch('/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          category: serviceCategory,
          description: serviceDescription,
          photoUrl: servicePhotoUrl || undefined,
        }),
      });
      setServiceDescription('');
      setServicePhotoUrl(null);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to submit service request');
    } finally {
      setServiceLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REPORTED':
      case 'SUBMITTED':
        return <span className="badge badge-critical">Submitted</span>;
      case 'ASSIGNED':
        return <span className="badge badge-high">Assigned</span>;
      case 'RESPONDING':
      case 'IN_PROGRESS':
        return <span className="badge badge-medium">In Progress</span>;
      case 'RESOLVED':
        return <span className="badge badge-success">Resolved</span>;
      case 'CLOSED':
        return <span className="badge" style={{ backgroundColor: '#334155', color: '#94a3b8' }}>Closed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="container" style={{ maxWidth: '820px', paddingBottom: '60px' }}>
      {/* Guest Header */}
      <div style={{
        marginTop: '16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
      }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 800 }}>Welcome, {user?.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Grand Athithi Hotel • Room {activeRoomNumber} (Floor {activeFloor})
          </p>
        </div>
        <div style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-muted)',
          padding: '5px 12px',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.80rem',
          color: 'var(--brand-light)',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <ShieldCheckIcon size={14} color="var(--brand-light)" />
          <span>Hotel Safety System Connected</span>
        </div>
      </div>

      {/* Demo Geolocation Simulator Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        backgroundColor: 'rgba(56, 189, 248, 0.06)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        padding: '10px 14px',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPinIcon size={18} color="#38bdf8" />
          <div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#38bdf8',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span>Live Location Handshake Active</span>
              <span style={{
                color: 'var(--color-success)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '0.68rem',
              }}>
                Verified
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Grand Athithi Hotel • 42 Marina Drive, Mumbai
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '440px' }}>
          <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
            Presence:
          </label>
          <select
            value={simulatedLocKey}
            onChange={(e) => {
              const val = e.target.value;
              setSimulatedLocKey(val);
              sessionStorage.setItem('athithi_location_handshake', val);
            }}
            className="form-input"
            style={{
              flex: 1,
              minWidth: '180px',
              padding: '6px 10px',
              fontSize: '0.80rem',
              backgroundColor: 'var(--bg-app)',
              borderColor: '#38bdf8',
              color: '#f8fafc',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <option value="ROOM">Assigned Room {activeRoomNumber} (Floor {activeFloor})</option>
            <option value="POOL">Swimming Pool & Deck (Ground Floor)</option>
            <option value="GYM">Fitness Center & Spa (Floor 2)</option>
            <option value="LOBBY">Main Lobby & Reception (Ground Floor)</option>
            <option value="REAL">Hardware GPS (Browser Geolocation)</option>
          </select>
          <button
            onClick={() => setShowHandshakeModal(true)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.72rem', padding: '6px 10px', flexShrink: 0 }}
            title="Re-open check-in presence verification"
          >
            Re-verify
          </button>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('EMERGENCY')}
          className={`btn ${activeTab === 'EMERGENCY' ? 'btn-critical' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 8px', fontSize: 'clamp(0.78rem, 2.8vw, 0.88rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <ShieldAlertIcon size={16} />
          <span>Emergency Help</span>
        </button>
        <button
          onClick={() => setActiveTab('SERVICE')}
          className={`btn ${activeTab === 'SERVICE' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px 8px', fontSize: 'clamp(0.78rem, 2.8vw, 0.88rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <BellIcon size={16} />
          <span>Guest Services</span>
        </button>
      </div>

      {/* Emergency Tab */}
      {activeTab === 'EMERGENCY' && (
        <div>
          {/* Big SOS button card */}
          <div className="card" style={{
            textAlign: 'center',
            padding: '32px 16px',
            marginBottom: '24px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: 'var(--bg-surface)',
          }}>
            <button
              onClick={() => {
                setSelectedCategory('OTHER');
                setSelectedPriority('CRITICAL');
                setShowSeverityModal(true);
              }}
              disabled={sosLoading}
              style={{
                width: 'clamp(142px, 38vw, 168px)',
                height: 'clamp(142px, 38vw, 168px)',
                borderRadius: '50%',
                backgroundColor: 'var(--color-critical)',
                color: '#ffffff',
                fontSize: 'clamp(1.5rem, 5vw, 1.85rem)',
                fontWeight: 900,
                letterSpacing: '0.08em',
                boxShadow: 'var(--shadow-sos)',
                border: '4px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
                transition: 'transform 0.12s ease',
                margin: '0 auto 16px auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
              onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span>SOS</span>
              <span style={{ fontSize: '0.70rem', fontWeight: 700, letterSpacing: '0.04em', opacity: 0.9 }}>
                {sosLoading ? 'DISPATCHING...' : 'TAP FOR HELP'}
              </span>
            </button>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 16px auto', lineHeight: 1.5 }}>
              Tap for immediate emergency assistance.
            </p>

            <button
              onClick={() => setShowCategoryModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FlameIcon size={14} />
              <span>Specify Hazard Category First</span>
            </button>
          </div>

          {/* SOS Success Banner & Location Clarifier */}
          {sosSuccess && (
            <div className="card card-elevated" style={{
              backgroundColor: 'var(--color-critical-bg)',
              border: '2px solid var(--color-critical)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px',
              marginBottom: '28px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--color-critical)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlertIcon size={18} color="var(--color-critical)" />
                    <span>Emergency Alert Active • #{sosSuccess.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                    Priority: <strong>{sosSuccess.priority || 'CRITICAL'}</strong> • Stand by in a safe position.
                  </div>
                </div>
                <button
                  onClick={() => setSosSuccess(null)}
                  style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {/* Dynamic Auto-Dispatched Proximity Responder HUD */}
              {(sosSuccess.autoDispatchedTo || (sosSuccess.assignments && sosSuccess.assignments[0])) && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px 14px',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      color: '#38bdf8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      textTransform: 'uppercase',
                    }}>
                      <span className="pulse-dot pulse-dot-critical" style={{ width: '6px', height: '6px' }} />
                      <span>0s Dynamic Proximity Dispatch Active</span>
                    </span>
                    <span className="badge badge-high" style={{ fontSize: '0.70rem' }}>
                      En Route • ETA &lt; 45s
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#f8fafc' }}>
                        {sosSuccess.autoDispatchedTo?.staff?.name || sosSuccess.assignments?.[0]?.assignee?.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {sosSuccess.autoDispatchedTo?.staff?.role || sosSuccess.assignments?.[0]?.assignee?.role} • Station: {sosSuccess.autoDispatchedTo?.zone || 'On-Duty Sector'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                        ~{sosSuccess.autoDispatchedTo?.estimatedMeters || 22}m
                      </div>
                      <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                        Proximity Distance
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Clarification Sub-flow */}
              <div style={{
                marginTop: '14px',
                paddingTop: '14px',
                borderTop: '1px solid rgba(239, 68, 68, 0.25)',
              }}>
                <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#fbbf24', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPinIcon size={14} color="#fbbf24" />
                  <span>Location Verification: Are you currently inside your room?</span>
                </div>

                {locationSubmitted ? (
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    color: 'var(--color-success)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <CheckCircleIcon size={15} color="var(--color-success)" />
                    <span>Location updated: <strong>{locationSubmitted}</strong> — relayed to command blueprint</span>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateGuestLocation('Inside room')}
                        disabled={locationUpdating}
                      >
                        Inside Assigned Room
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateGuestLocation('In hallway / corridor')}
                        disabled={locationUpdating}
                      >
                        In Hallway / Corridor
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateGuestLocation('In stairwell')}
                        disabled={locationUpdating}
                      >
                        In Stairwell
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateGuestLocation('Trapped in elevator')}
                        disabled={locationUpdating}
                      >
                        Inside Elevator Cab
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowCustomLocation(!showCustomLocation)}
                        disabled={locationUpdating}
                      >
                        Other Location...
                      </button>
                    </div>

                    {showCustomLocation && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                          placeholder="E.g. 2nd floor ice machine, pool side, restaurant..."
                          value={customLocationText}
                          onChange={(e) => setCustomLocationText(e.target.value)}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (customLocationText.trim()) {
                              updateGuestLocation(customLocationText.trim());
                            }
                          }}
                          disabled={!customLocationText.trim() || locationUpdating}
                        >
                          {locationUpdating ? 'Sending...' : 'Send Location'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dynamic Evacuation Route Strip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircleIcon size={18} color="#10b981" />
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#10b981' }}>
                  Dynamic Emergency Evacuation Wayfinding
                </strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Real-time Dijkstra egress path avoiding active hazard zones & blocked exits.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEvacMapOverride(!isEvacMapVisible)}
              className="btn btn-sm btn-secondary"
              style={{ borderColor: '#10b981', color: '#10b981', fontWeight: 700 }}
            >
              {isEvacMapVisible ? 'Hide Egress Map' : 'View Safest Exit Map'}
            </button>
          </div>

          {isEvacMapVisible && (
            <DynamicEvacuationMap
              locationKey={simulatedLocKey}
              roomNumber={activeRoomNumber}
              floor={activeFloor}
              activeIncidents={incidents}
            />
          )}

          {/* Incident List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Emergency Reports</h2>
              <button
                onClick={loadData}
                disabled={loading}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCwIcon size={14} className={loading ? 'spin-anim' : ''} />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Loading...</div>
            ) : incidents.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No active or past emergencies reported.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {incidents.map((inc) => (
                  <div key={inc.id} className="card card-elevated" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '8px' }}>
                          #{inc.id.slice(-6).toUpperCase()}
                        </span>
                        <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                          {inc.category.replace(/_/g, ' ')}
                        </strong>
                      </div>
                      <div>{getStatusBadge(inc.status)}</div>
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      {inc.description}
                    </p>

                    {/* Attached Photos / Proof of Work */}
                    {inc.attachments && inc.attachments.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {inc.attachments.map((att) => {
                          const isStaffProof = att.uploadedBy?.role === 'STAFF';
                          return (
                            <a
                              key={att.id || att.storageKey}
                              href={getMediaUrl(att.storageKey)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: isStaffProof ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                                border: `1px solid ${isStaffProof ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.74rem',
                                color: isStaffProof ? '#6ee7b7' : '#7dd3fc',
                                textDecoration: 'none',
                              }}
                            >
                              <img
                                src={getMediaUrl(att.storageKey)}
                                alt="attachment"
                                style={{ width: '22px', height: '22px', borderRadius: '3px', objectFit: 'cover' }}
                              />
                              <span>{isStaffProof ? 'Staff Completion Proof' : 'Your Attached Photo'}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {inc.assignments && inc.assignments[0] && (
                      <div style={{
                        backgroundColor: 'var(--bg-app)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        color: 'var(--brand-light)',
                        marginBottom: '8px',
                      }}>
                        Assigned Responder: <strong>{inc.assignments[0].assignee?.name}</strong> ({inc.assignments[0].status})
                      </div>
                    )}

                    {inc.resolutionNote && (
                      <div style={{
                        backgroundColor: 'var(--color-success-bg)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        color: 'var(--color-success)',
                      }}>
                        Resolution: {inc.resolutionNote}
                      </div>
                    )}

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Reported at {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Routine Service Request Tab */}
      {activeTab === 'SERVICE' && (
        <div>
          {/* Submission Form Card */}
          <div className="card card-elevated" style={{ marginBottom: '28px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px', color: 'var(--brand-light)' }}>
              Request Hotel Services & Amenities
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              Housekeeping, maintenance, fresh towels, or appliance support dispatched to your room.
            </p>

            <form onSubmit={submitServiceRequest}>
              <div className="form-group">
                <label className="form-label">Service Type</label>
                <select
                  className="form-select"
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                >
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Details</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="E.g. please send 2 extra bath towels and a fresh bottle of water..."
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  required
                />
              </div>

              {/* Photo Upload Option for Guests */}
              <PhotoUploader
                photoUrl={servicePhotoUrl}
                onPhotoUploaded={(url) => setServicePhotoUrl(url)}
                onPhotoRemoved={() => setServicePhotoUrl(null)}
                label="Attach Photo of Issue (Optional)"
                helperText="Upload photo of broken appliance, fixture, or room condition"
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={serviceLoading || !serviceDescription.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {serviceLoading && <span className="btn-spinner" />}
                  <span>{serviceLoading ? 'Submitting...' : 'Submit Service Request'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Service Requests Tracker List */}
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>
              My Active Service Requests
            </h2>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Loading...</div>
            ) : serviceRequests.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No routine service requests submitted yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {serviceRequests.map((req) => (
                  <div key={req.id} className="card card-elevated" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '8px' }}>
                          #{req.id.slice(-6).toUpperCase()}
                        </span>
                        <strong style={{ fontSize: '0.95rem' }}>
                          {req.category.replace(/_/g, ' ')}
                        </strong>
                      </div>
                      <div>{getStatusBadge(req.status)}</div>
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      {req.description}
                    </p>

                    {/* Attached Photos / Completion Proof */}
                    {req.attachments && req.attachments.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {req.attachments.map((att) => {
                          const isStaffProof = att.uploadedBy?.role === 'STAFF';
                          return (
                            <a
                              key={att.id || att.storageKey}
                              href={getMediaUrl(att.storageKey)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: isStaffProof ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                                border: `1px solid ${isStaffProof ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.74rem',
                                color: isStaffProof ? '#6ee7b7' : '#7dd3fc',
                                textDecoration: 'none',
                              }}
                            >
                              <img
                                src={getMediaUrl(att.storageKey)}
                                alt="attachment"
                                style={{ width: '22px', height: '22px', borderRadius: '3px', objectFit: 'cover' }}
                              />
                              <span>{isStaffProof ? 'Staff Completion Proof' : 'Your Attached Photo'}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {req.assignments && req.assignments[0] && (
                      <div style={{
                        backgroundColor: 'var(--bg-app)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        color: 'var(--brand-light)',
                      }}>
                        Assigned: <strong>{req.assignments[0].assignee?.name}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Modal for SOS */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--brand-light)' }}>
              Report Specific Hazard / Emergency
            </h3>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {EMERGENCY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Details / Notes (Optional)</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="E.g. smoke rising from air conditioner outlet..."
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
              />
            </div>

            {/* Optional Hazard Photo Evidence */}
            <PhotoUploader
              photoUrl={hazardPhotoUrl}
              onPhotoUploaded={(url) => setHazardPhotoUrl(url)}
              onPhotoRemoved={() => setHazardPhotoUrl(null)}
              label="Attach Hazard Photo (Optional)"
              helperText="Attach visual evidence for responders & command"
              compact={true}
            />

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: '90px' }}
                onClick={() => setShowCategoryModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-critical"
                style={{ flex: 2, minWidth: '160px' }}
                onClick={() => {
                  setShowCategoryModal(false);
                  setShowSeverityModal(true);
                }}
                disabled={sosLoading}
              >
                Proceed to Severity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Severity Layer Modal for SOS with 5s fail-safe countdown */}
      {showSeverityModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 250, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(5px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '2px solid var(--color-critical)',
            boxShadow: '0 0 35px rgba(239, 68, 68, 0.35)',
            padding: '20px 18px',
          }}>
            {/* Urgency Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlertIcon size={22} color="var(--color-critical)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.02em' }}>
                  EMERGENCY SEVERITY
                </h3>
              </div>
              <div style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-xs)',
              }}>
                AUTO IN: {severityCountdown}s
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.45 }}>
              Select severity level, or auto-dispatch will activate in {severityCountdown}s.
            </p>

            {/* 3 Severity Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {/* CRITICAL */}
              <div
                onClick={() => setSelectedPriority('CRITICAL')}
                className="interactive-tile"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: selectedPriority === 'CRITICAL' ? '2px solid #ef4444' : '1px solid var(--border-muted)',
                  backgroundColor: selectedPriority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.18)' : 'var(--bg-app)',
                  boxShadow: selectedPriority === 'CRITICAL' ? '0 0 14px rgba(239, 68, 68, 0.25)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                    <strong style={{ fontSize: '0.94rem', color: '#f8fafc' }}>CRITICAL • LIFE SAFETY</strong>
                  </div>
                  <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>Level 1</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Active fire, smoke, medical crisis, physical intruder, or imminent life threat.
                </p>
              </div>

              {/* HIGH / MEDIUM */}
              <div
                onClick={() => setSelectedPriority('HIGH')}
                className="interactive-tile"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: selectedPriority === 'HIGH' ? '2px solid #f97316' : '1px solid var(--border-muted)',
                  backgroundColor: selectedPriority === 'HIGH' ? 'rgba(249, 115, 22, 0.18)' : 'var(--bg-app)',
                  boxShadow: selectedPriority === 'HIGH' ? '0 0 14px rgba(249, 115, 22, 0.25)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f97316', display: 'inline-block' }} />
                    <strong style={{ fontSize: '0.94rem', color: '#f8fafc' }}>HIGH • URGENT HAZARD</strong>
                  </div>
                  <span className="badge badge-high" style={{ fontSize: '0.68rem' }}>Level 2</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Electrical sparking, water burst/flooding, elevator stoppage, or severe hazard.
                </p>
              </div>

              {/* LOW */}
              <div
                onClick={() => setSelectedPriority('LOW')}
                className="interactive-tile"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: selectedPriority === 'LOW' ? '2px solid #eab308' : '1px solid var(--border-muted)',
                  backgroundColor: selectedPriority === 'LOW' ? 'rgba(234, 179, 8, 0.18)' : 'var(--bg-app)',
                  boxShadow: selectedPriority === 'LOW' ? '0 0 14px rgba(234, 179, 8, 0.25)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308', display: 'inline-block' }} />
                    <strong style={{ fontSize: '0.94rem', color: '#f8fafc' }}>LOW • PRECAUTIONARY</strong>
                  </div>
                  <span className="badge badge-low" style={{ fontSize: '0.68rem' }}>Level 3</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Electronic door lock stuck, strange chemical odor, loud disturbance, or welfare check.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: '90px' }}
                onClick={() => setShowSeverityModal(false)}
                disabled={sosLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-critical"
                style={{ flex: 2, minWidth: '160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => triggerSOS(selectedCategory || 'OTHER', customDescription || 'Immediate Emergency Assistance Requested', selectedPriority)}
                disabled={sosLoading}
              >
                {sosLoading ? <span className="btn-spinner" /> : <ShieldAlertIcon size={16} />}
                <span>{sosLoading ? 'Dispatching Nearest...' : `Dispatch Now (${selectedPriority})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Check-In Location Handshake Modal */}
      {showHandshakeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(5px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid var(--brand-primary)',
            boxShadow: '0 0 30px rgba(14, 165, 233, 0.25)',
            padding: '22px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <MapPinIcon size={24} color="var(--brand-light)" />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Confirm Your Location
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--brand-light)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Safety Check-in
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.45 }}>
              Welcome to Grand Athithi Hotel, <strong>{user?.name}</strong>. Please confirm your current location to activate rapid emergency assistance.
            </p>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {[
                { id: 'ROOM', title: `Inside Assigned Room ${activeRoomNumber}`, desc: `Floor ${activeFloor} • Guest Suite`, badge: 'Recommended' },
                { id: 'LOBBY', title: 'Main Reception & Lobby', desc: 'Ground Floor • Concierge & Check-in' },
                { id: 'POOL', title: 'Swimming Pool & Sun Deck', desc: 'Ground Floor • Outdoor Recreation Area' },
                { id: 'GYM', title: 'Fitness Center & Spa', desc: 'Floor 2 • Health Club' },
                { id: 'REAL', title: 'Hardware GPS (Browser Geolocation)', desc: 'Real device latitude & longitude coordinates' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  onClick={() => setHandshakeChoice(opt.id)}
                  className="interactive-tile"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 13px',
                    borderRadius: 'var(--radius-sm)',
                    border: handshakeChoice === opt.id ? '2px solid var(--brand-primary)' : '1px solid var(--border-muted)',
                    backgroundColor: handshakeChoice === opt.id ? 'rgba(217, 119, 6, 0.16)' : 'var(--bg-app)',
                    boxShadow: handshakeChoice === opt.id ? '0 0 12px rgba(217, 119, 6, 0.2)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {opt.desc}
                    </div>
                  </div>
                  {opt.badge && (
                    <span className="badge badge-primary" style={{ fontSize: '0.66rem' }}>
                      {opt.badge}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.92rem', fontWeight: 700 }}
              onClick={() => {
                sessionStorage.setItem('athithi_location_handshake', handshakeChoice);
                setSimulatedLocKey(handshakeChoice);
                setShowHandshakeModal(false);
              }}
            >
              Confirm Presence & Activate Shield
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
