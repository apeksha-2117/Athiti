import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../realtime/socket';

const EMERGENCY_CATEGORIES = [
  { value: 'FIRE_OR_SMOKE', label: '🔥 Fire / Smoke' },
  { value: 'MEDICAL_EMERGENCY', label: '🚑 Medical Emergency' },
  { value: 'ELECTRICAL_HAZARD', label: '⚡ Electrical Hazard' },
  { value: 'WATER_LEAKAGE', label: '💧 Water Leakage' },
  { value: 'SECURITY_THREAT', label: '🛡️ Security / Safety Threat' },
  { value: 'OTHER', label: '⚠️ Other Emergency' },
];

const SERVICE_CATEGORIES = [
  { value: 'HOUSEKEEPING', label: '🧹 Housekeeping / Room Cleaning' },
  { value: 'EXTRA_AMENITIES', label: '🛏️ Extra Blankets / Pillows / Towels' },
  { value: 'MAINTENANCE_PLUMBING', label: '🔧 Plumbing / Tap / Shower Issue' },
  { value: 'ELECTRICAL_APPLIANCE', label: '💡 Lamp / TV / AC Issue' },
  { value: 'GENERAL_ASSISTANCE', label: '🛎️ General Guest Assistance' },
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
  const [simulatedLocKey, setSimulatedLocKey] = useState('ROOM');

  // SOS state
  const [sosLoading, setSosLoading] = useState(false);
  const [sosSuccess, setSosSuccess] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('OTHER');
  const [customDescription, setCustomDescription] = useState('');

  // Location clarification state
  const [locationUpdating, setLocationUpdating] = useState(false);
  const [locationSubmitted, setLocationSubmitted] = useState('');
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [customLocationText, setCustomLocationText] = useState('');

  // Service Request form state
  const [serviceCategory, setServiceCategory] = useState('HOUSEKEEPING');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceLoading, setServiceLoading] = useState(false);

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

  const triggerSOS = async (category = 'OTHER', description = 'Immediate Emergency Assistance Requested') => {
    setSosLoading(true);
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

      const data = await apiFetch('/incidents/sos', {
        method: 'POST',
        body: JSON.stringify({ category, description: finalDesc, coordinates }),
      });
      setSosSuccess(data.incident);
      setLocationSubmitted('');
      setShowCategoryModal(false);
      setCustomDescription('');
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
        }),
      });
      setServiceDescription('');
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
        marginTop: '20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Welcome, {user?.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Grand Athithi Hotel • Room {activeRoomNumber} (Floor {activeFloor})
          </p>
        </div>
        <div style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-muted)',
          padding: '6px 14px',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          color: 'var(--brand-light)',
          fontWeight: 600,
        }}>
          🛡️ Hotel Safety System Connected
        </div>
      </div>

      {/* Demo Geolocation Simulator Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.28)',
        padding: '10px 16px',
        borderRadius: 'var(--radius-md)',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>📍</span>
          <div>
            <div style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#38bdf8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Demo Geolocation Simulator
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Grand Athithi Hotel • 42 Marina Drive, Mumbai
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Simulate Guest Position:
          </label>
          <select
            value={simulatedLocKey}
            onChange={(e) => setSimulatedLocKey(e.target.value)}
            className="form-input"
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-app)',
              borderColor: '#38bdf8',
              color: '#f8fafc',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <option value="ROOM">🛏️ Assigned Room {activeRoomNumber} (Floor {activeFloor})</option>
            <option value="POOL">🏊 Swimming Pool & Deck (Ground Floor)</option>
            <option value="GYM">🏋️ Fitness Center & Spa (Floor 2)</option>
            <option value="LOBBY">🍸 Main Lobby & Reception (Ground Floor)</option>
            <option value="REAL">🛰️ Real Device GPS (Browser Geolocation)</option>
          </select>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('EMERGENCY')}
          className={`btn ${activeTab === 'EMERGENCY' ? 'btn-critical' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '12px' }}
        >
          🚨 Emergency SOS
        </button>
        <button
          onClick={() => setActiveTab('SERVICE')}
          className={`btn ${activeTab === 'SERVICE' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '12px' }}
        >
          🛎️ Routine Service & Amenities
        </button>
      </div>

      {/* Emergency Tab */}
      {activeTab === 'EMERGENCY' && (
        <div>
          {/* Big SOS button card */}
          <div className="card" style={{
            textAlign: 'center',
            padding: '36px 20px',
            marginBottom: '32px',
            border: '1px solid var(--color-critical-border)',
            background: 'radial-gradient(circle at center, rgba(239,68,68,0.08) 0%, var(--bg-surface) 70%)',
          }}>
            <p style={{
              fontSize: '0.82rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-critical)',
              fontWeight: 700,
              marginBottom: '14px',
            }}>
              Immediate Hotel Crisis Assistance
            </p>

            <button
              onClick={() => triggerSOS('OTHER', 'Immediate Emergency Assistance Requested')}
              disabled={sosLoading}
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-critical)',
                color: '#ffffff',
                fontSize: '1.9rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
                boxShadow: 'var(--shadow-sos)',
                border: '4px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                margin: '0 auto 18px auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span>SOS</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.9 }}>
                {sosLoading ? 'SENDING...' : 'TAP FOR HELP'}
              </span>
            </button>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 16px auto' }}>
              Tapping SOS immediately alerts hotel control & dispatches on-duty security to your room.
            </p>

            <button
              onClick={() => setShowCategoryModal(true)}
              className="btn btn-secondary btn-sm"
            >
              Select Specific Hazard Category
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
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-critical)' }}>
                    🚨 Emergency Alert #{sosSuccess.id.slice(-6).toUpperCase()} Active
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                    Responders and control room have been alerted. Stay in a safe position.
                  </div>
                </div>
                <button
                  onClick={() => setSosSuccess(null)}
                  style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {/* Location Clarification Sub-flow */}
              <div style={{
                marginTop: '14px',
                paddingTop: '14px',
                borderTop: '1px solid rgba(239, 68, 68, 0.25)',
              }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fbbf24', marginBottom: '8px' }}>
                  📍 Help Security Locate You Fast: Are you in your room right now?
                </div>

                {locationSubmitted ? (
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10b981',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    fontSize: '0.84rem',
                    color: 'var(--color-success)',
                    fontWeight: 600,
                  }}>
                    ✓ Location updated: <strong>{locationSubmitted}</strong> — relayed to control room & blueprint!
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateGuestLocation('Inside room')}
                        disabled={locationUpdating}
                      >
                        🛏️ Yes, in my room
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateGuestLocation('In hallway / corridor')}
                        disabled={locationUpdating}
                      >
                        🚶 In hallway / corridor
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateGuestLocation('In stairwell')}
                        disabled={locationUpdating}
                      >
                        🪜 In stairwell
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateGuestLocation('Trapped in elevator')}
                        disabled={locationUpdating}
                      >
                        🛗 In elevator
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowCustomLocation(!showCustomLocation)}
                        disabled={locationUpdating}
                      >
                        📍 Other location...
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

          {/* Incident List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Emergency Reports</h2>
              <button onClick={loadData} className="btn btn-secondary btn-sm">Refresh</button>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={serviceLoading || !serviceDescription.trim()}
                >
                  {serviceLoading ? 'Submitting...' : 'Submit Service Request'}
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
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div className="card card-elevated" style={{ width: '100%', maxWidth: '480px' }}>
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

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCategoryModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-critical"
                onClick={() => triggerSOS(selectedCategory, customDescription || 'Specific Emergency Reported')}
                disabled={sosLoading}
              >
                Submit Emergency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
