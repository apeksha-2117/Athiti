import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../realtime/socket';

export function StaffPortal() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [declineModal, setDeclineModal] = useState(null); // task id
  const [declineReason, setDeclineReason] = useState('');
  const [statusModal, setStatusModal] = useState(null); // { task, status }
  const [progressNotes, setProgressNotes] = useState('');

  const loadTasks = async () => {
    try {
      const data = await apiFetch('/staff/tasks');
      setTasks(data.tasks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();

    const socket = getSocket();
    const handleUpdate = () => {
      loadTasks();
    };

    socket.on('assignment:created', handleUpdate);
    socket.on('assignment:updated', handleUpdate);
    socket.on('incident:assigned', handleUpdate);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadTasks();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', loadTasks);
    const syncTimer = setInterval(loadTasks, 15000);

    return () => {
      socket.off('assignment:created', handleUpdate);
      socket.off('assignment:updated', handleUpdate);
      socket.off('incident:assigned', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', loadTasks);
      clearInterval(syncTimer);
    };
  }, []);

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

  const submitStatus = async (status) => {
    setActionLoading(true);
    try {
      await apiFetch(`/assignments/${statusModal.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes: progressNotes }),
      });
      setStatusModal(null);
      setProgressNotes('');
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
        marginBottom: '24px',
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

      {/* Decline Modal */}
      {declineModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div className="card card-elevated" style={{ width: '100%', maxWidth: '440px' }}>
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
          zIndex: 200, padding: '20px',
        }}>
          <div className="card card-elevated" style={{ width: '100%', maxWidth: '440px' }}>
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
                rows="3"
                value={progressNotes}
                onChange={(e) => setProgressNotes(e.target.value)}
                placeholder="E.g. arriving on scene; breaker isolated..."
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => submitStatus('EN_ROUTE')}>En Route</button>
              <button className="btn btn-secondary btn-sm" onClick={() => submitStatus('ON_SCENE')}>On Scene</button>
              <button className="btn btn-secondary btn-sm" onClick={() => submitStatus('IN_PROGRESS')}>In Progress</button>
              <button className="btn btn-primary btn-sm" onClick={() => submitStatus('COMPLETED')}>Mark Completed</button>
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setStatusModal(null)}>Close</button>
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
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                color: 'var(--color-critical)',
                fontWeight: 700,
                fontSize: '0.95rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <span>🚨 Awaiting Immediate Acknowledgement ({pendingTasks.length})</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="card card-elevated"
                    style={{
                      borderLeft: '4px solid var(--color-critical)',
                      backgroundColor: 'rgba(239, 68, 68, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {getPriorityBadge(t.incident?.priority)}
                        <strong style={{ fontSize: '1.05rem' }}>
                          Room {t.incident?.room?.roomNumber || 'Unknown'} — {t.incident?.category.replace(/_/g, ' ')}
                        </strong>
                      </div>
                      <span className="badge badge-critical">Needs Ack</span>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {t.incident?.description}
                    </p>

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
                        onClick={() => acknowledge(t.id)}
                        className="btn btn-critical btn-sm"
                        disabled={actionLoading}
                      >
                        ⚡ Acknowledge Assignment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Tasks Section */}
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)' }}>
              Active Ongoing Tasks ({activeTasks.length})
            </h2>

            {activeTasks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No active tasks currently in progress.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeTasks.map((t) => (
                  <div key={t.id} className="card card-elevated" style={{ borderLeft: '4px solid var(--brand-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {getPriorityBadge(t.incident?.priority)}
                        <strong style={{ fontSize: '1rem' }}>
                          Room {t.incident?.room?.roomNumber || 'General'} — {t.incident?.category.replace(/_/g, ' ')}
                        </strong>
                      </div>
                      <span className="badge badge-high">{t.status}</span>
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {t.incident?.description}
                    </p>

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
                {completedTasks.map((t) => (
                  <div key={t.id} className="card" style={{ padding: '12px 16px', opacity: 0.75 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.88rem' }}>
                        Room {t.incident?.room?.roomNumber || 'General'} • {t.incident?.category.replace(/_/g, ' ')}
                      </span>
                      <span className="badge badge-success">{t.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
