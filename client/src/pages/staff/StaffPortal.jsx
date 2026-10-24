import React, { useState, useEffect } from 'react';
import { apiFetch, getMediaUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../realtime/socket';
import { PhotoUploader } from '../../components/common/PhotoUploader';
import { ShieldAlertIcon, CheckCircleIcon, RefreshCwIcon, RadioIcon, MapPinIcon, CameraIcon } from '../../components/common/Icons';

const PATROL_SECTORS = [
  {
    key: 'FLOOR_1_WEST',
    label: 'Floor 1 — West Wing (Security Post)',
    coordinates: { x: 120, y: 320, floor: 1 },
    zone: 'Floor 1 West Corridor / Fire Exit',
    floor: 1,
  },
  {
    key: 'FLOOR_2_CORE',
    label: 'Floor 2 — Central Core (Engineering Station)',
    coordinates: { x: 500, y: 350, floor: 2 },
    zone: 'Floor 2 Central Core / Mechanical',
    floor: 2,
  },
  {
    key: 'FLOOR_3_EAST',
    label: 'Floor 3 — East Wing (Housekeeping Hub)',
    coordinates: { x: 880, y: 320, floor: 3 },
    zone: 'Floor 3 East Wing / Linen Station',
    floor: 3,
  },
];

export function StaffPortal() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [declineModal, setDeclineModal] = useState(null); // task id
  const [declineReason, setDeclineReason] = useState('');
  const [statusModal, setStatusModal] = useState(null); // { task, status }
  const [progressNotes, setProgressNotes] = useState('');
  const [completionPhotoUrl, setCompletionPhotoUrl] = useState(null);

  // Proximity Patrol Sector state
  const defaultSectorKey = user?.email?.includes('security')
    ? 'FLOOR_1_WEST'
    : user?.email?.includes('housekeeping')
    ? 'FLOOR_3_EAST'
    : 'FLOOR_2_CORE';

  const [activeSectorKey, setActiveSectorKey] = useState(defaultSectorKey);
  const [urgentDispatch, setUrgentDispatch] = useState(null);

  const loadTasks = async () => {
    try {
      const data = await apiFetch('/staff/tasks');
      setTasks(data.tasks || []);
    } catch (err) {
      console.error(err);
      if (err.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const updateSector = async (sectorKey) => {
    setActiveSectorKey(sectorKey);
    const sec = PATROL_SECTORS.find((s) => s.key === sectorKey);
    if (!sec) return;
    const socket = getSocket();
    socket.emit('staff:update_location', {
      coordinates: sec.coordinates,
      sector: sec.zone,
      floor: sec.floor,
    });
    try {
      await apiFetch('/staff/location', {
        method: 'POST',
        body: JSON.stringify({
          coordinates: sec.coordinates,
          sector: sec.zone,
          floor: sec.floor,
        }),
      });
    } catch (err) {
      console.error('Failed to sync staff location to API:', err);
    }
  };

  useEffect(() => {
    loadTasks();
    // Broadcast initial patrol sector on mount
    updateSector(activeSectorKey);

    const socket = getSocket();
    const handleUpdate = () => {
      loadTasks();
    };

    const handleUrgentDispatch = (payload) => {
      setUrgentDispatch(payload);
      loadTasks();
    };

    socket.on('assignment:created', handleUpdate);
    socket.on('assignment:updated', handleUpdate);
    socket.on('incident:assigned', handleUpdate);
    socket.on('assignment:urgent_dispatch', handleUrgentDispatch);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadTasks();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', loadTasks);
    const syncTimer = setInterval(loadTasks, 25000);

    return () => {
      socket.off('assignment:created', handleUpdate);
      socket.off('assignment:updated', handleUpdate);
      socket.off('incident:assigned', handleUpdate);
      socket.off('assignment:urgent_dispatch', handleUrgentDispatch);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', loadTasks);
      clearInterval(syncTimer);
    };
  }, []);

  const acknowledgeAndEnRoute = async (taskId) => {
    setActionLoading(true);
    try {
      await apiFetch(`/assignments/${taskId}/acknowledge`, { method: 'POST' });
      await apiFetch(`/assignments/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'EN_ROUTE', notes: 'Auto-dispatch confirmed. En route to scene.' }),
      });
      setUrgentDispatch(null);
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to accept dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  const acknowledge = async (taskId) => {
    setActionLoading(true);
    try {
      await apiFetch(`/assignments/${taskId}/acknowledge`, { method: 'POST' });
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to acknowledge');
    } finally {
      setActionLoading(false);
    }
  };

  const submitDecline = async () => {
    if (!declineReason.trim()) return;
    setActionLoading(true);
    try {
      await apiFetch(`/assignments/${declineModal}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: declineReason }),
      });
      setDeclineModal(null);
      setDeclineReason('');
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to decline');
    } finally {
      setActionLoading(false);
    }
  };

  const submitStatus = async (status, photoUrl = null) => {
    setActionLoading(true);
    try {
      const activePhotoUrl = photoUrl || completionPhotoUrl;
      await apiFetch(`/assignments/${statusModal.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          notes: progressNotes,
          photoProofUrl: activePhotoUrl || undefined,
        }),
      });
      setStatusModal(null);
      setProgressNotes('');
      setCompletionPhotoUrl(null);
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL': return <span className="badge badge-critical">Critical</span>;
      case 'HIGH': return <span className="badge badge-high">High</span>;
      case 'MEDIUM': return <span className="badge badge-medium">Medium</span>;
      default: return <span className="badge badge-low">Low</span>;
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING');
  const activeTasks = tasks.filter((t) => ['ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS'].includes(t.status));
  const completedTasks = tasks.filter((t) => ['COMPLETED', 'DECLINED'].includes(t.status));

  return (
    <div className="container" style={{ maxWidth: '900px', paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{
        marginTop: '20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Responder Task Inbox</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {user?.name} • On Duty
          </p>
        </div>
        <button onClick={loadTasks} className="btn btn-secondary btn-sm">
          Refresh Tasks
        </button>
      </div>

      {/* Live Sector Patrol Selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'rgba(56, 189, 248, 0.06)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        padding: '12px 16px',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MapPinIcon size={18} color="#38bdf8" />
          <div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#38bdf8',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span>Live CAD Responder Telemetry</span>
              <span className="pulse-dot pulse-dot-critical" style={{ width: '5px', height: '5px' }} />
            </div>
            <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>
              Proximity engine auto-calculates distance from your active station.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '440px' }}>
          <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
            Stationed Sector:
          </label>
          <select
            value={activeSectorKey}
            onChange={(e) => updateSector(e.target.value)}
            className="form-input"
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '6px 12px',
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-app)',
              borderColor: '#38bdf8',
              color: '#f8fafc',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {PATROL_SECTORS.map((sec) => (
              <option key={sec.key} value={sec.key}>
                {sec.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Urgent Proximity Dispatch Modal */}
      {urgentDispatch && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 350, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(5px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '2px solid var(--color-critical)',
            boxShadow: '0 0 35px rgba(239, 68, 68, 0.45)',
            padding: '20px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <ShieldAlertIcon size={24} color="var(--color-critical)" />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                  URGENT PROXIMITY DISPATCH
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Zero-Latency Automated Intercept Assignment
                </span>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-app)',
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              border: '1px solid var(--border-muted)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>INCIDENT TARGET</span>
                <span className="badge badge-critical">
                  Room {urgentDispatch.incident?.room?.roomNumber || 'General'}
                </span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                {urgentDispatch.incident?.category?.replace(/_/g, ' ')}
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
                {urgentDispatch.incident?.description}
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
            }}>
              <span style={{ fontSize: '0.80rem', color: '#38bdf8', fontWeight: 600 }}>
                Estimated Proximity to Target:
              </span>
              <strong style={{ fontSize: '1.1rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                ~{urgentDispatch.estimatedMeters || 18} meters
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: '90px' }}
                onClick={() => setUrgentDispatch(null)}
              >
                Dismiss
              </button>
              <button
                className="btn btn-critical"
                onClick={() => acknowledgeAndEnRoute(urgentDispatch.assignment?.id || urgentDispatch.id)}
                disabled={actionLoading}
                style={{ flex: 2, minWidth: '160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <CheckCircleIcon size={16} />
                <span>Acknowledge & En Route</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {declineModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '440px', maxHeight: '88vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: 'var(--color-critical)' }}>
              Decline Assignment
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Please provide an operational reason (e.g. handling active medical call elsewhere).
            </p>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason for declining..."
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setDeclineModal(null)}>Cancel</button>
              <button
                className="btn btn-critical"
                onClick={submitDecline}
                disabled={actionLoading || !declineReason.trim()}
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '440px', maxHeight: '88vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: 'var(--brand-light)' }}>
              Update Task Status
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Select target response phase and optional notes.
            </p>
            <div className="form-group">
              <label className="form-label">Progress Note</label>
              <textarea
                className="form-textarea"
                rows="2"
                value={progressNotes}
                onChange={(e) => setProgressNotes(e.target.value)}
                placeholder="E.g. arriving on scene; breaker isolated / room sanitized..."
              />
            </div>

            {/* Photo Proof of Completion Upload */}
            <PhotoUploader
              photoUrl={completionPhotoUrl}
              onPhotoUploaded={(url) => setCompletionPhotoUrl(url)}
              onPhotoRemoved={() => setCompletionPhotoUrl(null)}
              label="Photo Proof of Completion"
              helperText="Snap or upload photo proving task resolution"
              compact={true}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => submitStatus('EN_ROUTE')}>En Route</button>
              <button className="btn btn-secondary btn-sm" onClick={() => submitStatus('ON_SCENE')}>On Scene</button>
              <button className="btn btn-secondary btn-sm" onClick={() => submitStatus('IN_PROGRESS')}>In Progress</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (!completionPhotoUrl) {
                    alert('Please attach a photo proof of completion before marking the task completed.');
                    return;
                  }
                  submitStatus('COMPLETED', completionPhotoUrl);
                }}
              >
                Mark Completed (With Photo)
              </button>
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setStatusModal(null); setCompletionPhotoUrl(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
          Loading assigned tasks...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Urgent Pending Acknowledgement Section */}
          {pendingTasks.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                color: 'var(--color-critical)',
                fontWeight: 700,
                fontSize: '0.88rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <ShieldAlertIcon size={16} />
                <span>Awaiting Immediate Response ({pendingTasks.length})</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="card card-elevated"
                    style={{
                      border: '1px solid rgba(239, 68, 68, 0.45)',
                      backgroundColor: 'rgba(239, 68, 68, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {getPriorityBadge(t.incident?.priority || t.serviceRequest?.priority)}
                        <strong style={{ fontSize: '1.05rem' }}>
                          Room {t.incident?.room?.roomNumber || t.serviceRequest?.room?.roomNumber || 'Unknown'} — {(t.incident?.category || t.serviceRequest?.category || '').replace(/_/g, ' ')}
                        </strong>
                      </div>
                      <span className="badge badge-critical">Needs Ack</span>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {t.incident?.description || t.serviceRequest?.description}
                    </p>

                    {/* Attached Photo Evidence */}
                    {(t.incident?.attachments || t.serviceRequest?.attachments) && (t.incident?.attachments?.length > 0 || t.serviceRequest?.attachments?.length > 0) && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {[...(t.incident?.attachments || []), ...(t.serviceRequest?.attachments || [])].map((att) => (
                          <a
                            key={att.id || att.storageKey}
                            href={getMediaUrl(att.storageKey)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.74rem',
                              color: '#7dd3fc',
                              textDecoration: 'none',
                            }}
                          >
                            <img
                              src={getMediaUrl(att.storageKey)}
                              alt="evidence"
                              style={{ width: '22px', height: '22px', borderRadius: '3px', objectFit: 'cover' }}
                            />
                            <span>Guest Attached Photo</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {t.instructions && (
                      <div style={{
                        backgroundColor: 'var(--bg-app)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        color: 'var(--brand-light)',
                        marginBottom: '14px',
                      }}>
                        Operator Instructions: <em>{t.instructions}</em>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setDeclineModal(t.id)}
                        className="btn btn-secondary btn-sm"
                        disabled={actionLoading}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => acknowledgeAndEnRoute(t.id)}
                        className="btn btn-critical btn-sm"
                        disabled={actionLoading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <CheckCircleIcon size={14} />
                        <span>Acknowledge & En Route</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Tasks Section */}
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)' }}>
              Active Ongoing Tasks ({activeTasks.length})
            </h2>

            {activeTasks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No active tasks currently in progress.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeTasks.map((t) => (
                  <div
                    key={t.id}
                    className="card card-elevated"
                    style={{
                      border: '1px solid rgba(217, 119, 6, 0.35)',
                      backgroundColor: 'rgba(217, 119, 6, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {getPriorityBadge(t.incident?.priority || t.serviceRequest?.priority)}
                        <strong style={{ fontSize: '1rem' }}>
                          Room {t.incident?.room?.roomNumber || t.serviceRequest?.room?.roomNumber || 'General'} — {(t.incident?.category || t.serviceRequest?.category || '').replace(/_/g, ' ')}
                        </strong>
                      </div>
                      <span className="badge badge-high">{t.status}</span>
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {t.incident?.description || t.serviceRequest?.description}
                    </p>

                    {/* Attached Photo Evidence */}
                    {(t.incident?.attachments || t.serviceRequest?.attachments) && (t.incident?.attachments?.length > 0 || t.serviceRequest?.attachments?.length > 0) && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {[...(t.incident?.attachments || []), ...(t.serviceRequest?.attachments || [])].map((att) => (
                          <a
                            key={att.id || att.storageKey}
                            href={getMediaUrl(att.storageKey)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.74rem',
                              color: '#7dd3fc',
                              textDecoration: 'none',
                            }}
                          >
                            <img
                              src={getMediaUrl(att.storageKey)}
                              alt="evidence"
                              style={{ width: '22px', height: '22px', borderRadius: '3px', objectFit: 'cover' }}
                            />
                            <span>Guest Attached Photo</span>
                          </a>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setStatusModal(t)}
                        className="btn btn-primary btn-sm"
                      >
                        Update Progress / Complete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Section */}
          {completedTasks.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px', color: 'var(--text-muted)' }}>
                Completed / Concluded ({completedTasks.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {completedTasks.map((t) => {
                  const attachments = t.incident?.attachments || t.serviceRequest?.attachments || [];
                  const staffProof = attachments.find((a) => a.uploadedBy?.role === 'STAFF');
                  return (
                    <div key={t.id} className="card" style={{ padding: '12px 16px', opacity: 0.9 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.90rem', fontWeight: 600 }}>
                            Room {t.incident?.room?.roomNumber || t.serviceRequest?.room?.roomNumber || 'General'} • {(t.incident?.category || t.serviceRequest?.category || '').replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Completed {t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : 'Recently'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {staffProof && (
                            <a
                              href={getMediaUrl(staffProof.storageKey)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid #10b981',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.72rem',
                                color: '#6ee7b7',
                                textDecoration: 'none',
                              }}
                            >
                              <img
                                src={getMediaUrl(staffProof.storageKey)}
                                alt="completion proof"
                                style={{ width: '18px', height: '18px', borderRadius: '2px', objectFit: 'cover' }}
                              />
                              <span>Proof Attached</span>
                            </a>
                          )}
                          <span className="badge badge-success">{t.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
