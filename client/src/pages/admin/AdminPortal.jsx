import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../realtime/socket';

export function AdminPortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('INCIDENTS'); // 'INCIDENTS' | 'ROOMS' | 'SERVICES' | 'PUBLIC_REPORTS'

  const [incidents, setIncidents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Selected Room for Detail Drawer
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Modals for Incidents
  const [assignModal, setAssignModal] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [closeModal, setCloseModal] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [externalContacted, setExternalContacted] = useState(false);
  const [externalDetails, setExternalDetails] = useState('');

  const [escalateModal, setEscalateModal] = useState(null);
  const [escalateReason, setEscalateReason] = useState('');

  // Modal for Service Requests Assignment
  const [assignServiceModal, setAssignServiceModal] = useState(null);

  const loadData = async () => {
    try {
      const [incData, staffData, roomsData, srvData] = await Promise.all([
        apiFetch('/admin/incidents'),
        apiFetch('/admin/staff'),
        apiFetch('/admin/rooms'),
        apiFetch('/admin/service-requests'),
      ]);
      setIncidents(incData.incidents || []);
      setStaffList(staffData.staff || []);
      setRooms(roomsData.rooms || []);
      setServiceRequests(srvData.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    const handleRefresh = () => {
      loadData();
    };

    socket.on('incident:created', handleRefresh);
    socket.on('incident:updated', handleRefresh);
    socket.on('incident:assigned', handleRefresh);
    socket.on('assignment:acknowledged', handleRefresh);
    socket.on('assignment:declined', handleRefresh);
    socket.on('assignment:updated', handleRefresh);
    socket.on('service_request:created', handleRefresh);
    socket.on('service_request:updated', handleRefresh);
    socket.on('public_report:created', handleRefresh);

    return () => {
      socket.off('incident:created', handleRefresh);
      socket.off('incident:updated', handleRefresh);
      socket.off('incident:assigned', handleRefresh);
      socket.off('assignment:acknowledged', handleRefresh);
      socket.off('assignment:declined', handleRefresh);
      socket.off('assignment:updated', handleRefresh);
      socket.off('service_request:created', handleRefresh);
      socket.off('service_request:updated', handleRefresh);
      socket.off('public_report:created', handleRefresh);
    };
  }, []);

  const submitAssign = async () => {
    if (!selectedStaffId) return;
    setAssignLoading(true);
    try {
      await apiFetch(`/admin/incidents/${assignModal.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          assigneeId: selectedStaffId,
          instructions: assignInstructions,
        }),
      });
      setAssignModal(null);
      setSelectedStaffId('');
      setAssignInstructions('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to assign');
    } finally {
      setAssignLoading(false);
    }
  };

  const submitServiceAssign = async () => {
    if (!selectedStaffId) return;
    setAssignLoading(true);
    try {
      await apiFetch(`/admin/service-requests/${assignServiceModal.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          assigneeId: selectedStaffId,
        }),
      });
      setAssignServiceModal(null);
      setSelectedStaffId('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to assign service request');
    } finally {
      setAssignLoading(false);
    }
  };

  const submitClose = async () => {
    if (!resolutionNote.trim()) return;
    try {
      await apiFetch(`/admin/incidents/${closeModal.id}/close`, {
        method: 'POST',
        body: JSON.stringify({
          resolutionNote,
          externalServiceContacted: externalContacted,
          externalServiceDetails: externalDetails ? { notes: externalDetails } : null,
        }),
      });
      setCloseModal(null);
      setResolutionNote('');
      setExternalContacted(false);
      setExternalDetails('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to close incident');
    }
  };

  const submitEscalate = async () => {
    if (!escalateReason.trim()) return;
    try {
      await apiFetch(`/admin/incidents/${escalateModal.id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ reason: escalateReason }),
      });
      setEscalateModal(null);
      setEscalateReason('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to escalate');
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (priorityFilter === 'ALL') return true;
    return inc.priority === priorityFilter;
  });

  // KPI Calculations
  const activeEmergencies = incidents.filter((i) => ['CRITICAL', 'HIGH'].includes(i.priority) && i.status !== 'CLOSED').length;
  const unassignedCount = incidents.filter((i) => i.status === 'REPORTED').length;
  const respondingCount = incidents.filter((i) => ['ASSIGNED', 'RESPONDING', 'IN_PROGRESS'].includes(i.status)).length;
  const pendingServicesCount = serviceRequests.filter((s) => s.status === 'SUBMITTED').length;

  // Group rooms by floor
  const floors = [1, 2, 3];

  return (
    <div className="container" style={{ maxWidth: '1240px', paddingBottom: '60px' }}>
      {/* Header */}
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
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Incident Command Centre</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Grand Athithi Hotel • Central Dispatch Console
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary btn-sm">
          Refresh Live Console
        </button>
      </div>

      {/* KPI Counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '24px',
      }}>
        <div className="card card-elevated" style={{ borderLeft: '4px solid var(--color-critical)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Active Emergencies
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-critical)', marginTop: '4px' }}>
            {activeEmergencies}
          </div>
        </div>

        <div className="card card-elevated" style={{ borderLeft: '4px solid var(--color-high)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Unassigned SOS Reports
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-high)', marginTop: '4px' }}>
            {unassignedCount}
          </div>
        </div>

        <div className="card card-elevated" style={{ borderLeft: '4px solid var(--brand-light)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Active Responders
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-light)', marginTop: '4px' }}>
            {respondingCount}
          </div>
        </div>

        <div className="card card-elevated" style={{ borderLeft: '4px solid var(--color-low)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Pending Service Requests
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-low)', marginTop: '4px' }}>
            {pendingServicesCount}
          </div>
        </div>
      </div>

      {/* Main Console View Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('INCIDENTS')}
          className={`btn btn-sm ${activeTab === 'INCIDENTS' ? 'btn-primary' : 'btn-secondary'}`}
        >
          🚨 Crisis Queue ({incidents.filter(i => i.status !== 'CLOSED').length})
        </button>
        <button
          onClick={() => setActiveTab('ROOMS')}
          className={`btn btn-sm ${activeTab === 'ROOMS' ? 'btn-primary' : 'btn-secondary'}`}
        >
          🏨 Hotel Floor Plan & Rooms ({rooms.length})
        </button>
        <button
          onClick={() => setActiveTab('SERVICES')}
          className={`btn btn-sm ${activeTab === 'SERVICES' ? 'btn-primary' : 'btn-secondary'}`}
        >
          🛎️ Routine Service Queue ({serviceRequests.length})
        </button>
      </div>

      {/* VIEW 1: INCIDENT CRISIS QUEUE */}
      {activeTab === 'INCIDENTS' && (
        <div>
          {/* Priority filter buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`btn btn-sm ${priorityFilter === p ? 'btn-primary' : 'btn-secondary'}`}
              >
                {p} ({p === 'ALL' ? incidents.length : incidents.filter(i => i.priority === p).length})
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading queue...</div>
          ) : filteredIncidents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              No incidents matching criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredIncidents.map((inc) => {
                const activeAssignment = inc.assignments && inc.assignments[0];
                return (
                  <div
                    key={inc.id}
                    className="card card-elevated"
                    style={{
                      borderLeft: inc.priority === 'CRITICAL' ? '4px solid var(--color-critical)' : '4px solid var(--border-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <span className={`badge badge-${inc.priority.toLowerCase()}`}>
                            {inc.priority}
                          </span>
                          <strong style={{ fontSize: '1.1rem' }}>
                            Room {inc.room?.roomNumber || 'General'} • {inc.category.replace(/_/g, ' ')}
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            #{inc.id.slice(-6).toUpperCase()}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '6px' }}>
                          {inc.description}
                        </p>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          Reporter: {inc.reporter?.name || 'Guest'} • Room {inc.room?.roomNumber || 'N/A'} (Floor {inc.room?.floor || 'N/A'}) • {new Date(inc.createdAt).toLocaleTimeString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-high" style={{ padding: '6px 10px' }}>
                          {inc.status}
                        </span>

                        {inc.status !== 'CLOSED' && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setAssignModal(inc);
                                if (staffList.length > 0) setSelectedStaffId(staffList[0].id);
                              }}
                            >
                              {activeAssignment ? 'Reassign' : 'Assign Staff'}
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--color-critical)' }}
                              onClick={() => setEscalateModal(inc)}
                            >
                              Escalate
                            </button>

                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setCloseModal(inc)}
                            >
                              Verify & Close
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {activeAssignment && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          Assigned: <strong>{activeAssignment.assignee?.name}</strong> • Status: <strong>{activeAssignment.status}</strong>
                          {activeAssignment.instructions && <span> • Instructions: "{activeAssignment.instructions}"</span>}
                        </div>
                      </div>
                    )}

                    {inc.resolutionNote && (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: 'var(--color-success-bg)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        color: 'var(--color-success)',
                      }}>
                        Closure Note: {inc.resolutionNote}
                        {inc.externalServiceContacted && ' • [External Emergency Services Notified]'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: HOTEL FLOOR PLAN & ROOMS (PRD 4.5 FR-027 to FR-030) */}
      {activeTab === 'ROOMS' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Interactive floor layout with booking occupancy, active stay records, and real-time hazard markers.
            </p>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>🟢 Available</span>
              <span>🔵 Occupied</span>
              <span>🔴 Active Incident</span>
              <span>🔧 Maintenance</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {floors.map((fl) => {
              const floorRooms = rooms.filter((r) => r.floor === fl);
              return (
                <div key={fl} className="card card-elevated" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--brand-light)' }}>
                    Floor {fl}
                  </h3>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '14px',
                  }}>
                    {floorRooms.map((rm) => {
                      const hasActiveIncident = rm.incidents && rm.incidents.length > 0;
                      const hasServiceReq = rm.serviceRequests && rm.serviceRequests.length > 0;
                      const activeStay = rm.stays && rm.stays[0];

                      return (
                        <div
                          key={rm.id}
                          onClick={() => setSelectedRoom(rm)}
                          style={{
                            backgroundColor: hasActiveIncident
                              ? 'rgba(239, 68, 68, 0.12)'
                              : 'var(--bg-app)',
                            border: hasActiveIncident
                              ? '2px solid var(--color-critical)'
                              : '1px solid var(--border-muted)',
                            borderRadius: 'var(--radius-md)',
                            padding: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                              Room {rm.roomNumber}
                            </strong>
                            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                              {rm.roomType}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.82rem', marginBottom: '6px' }}>
                            Status: <span style={{
                              fontWeight: 600,
                              color: rm.operationalStatus === 'OCCUPIED' ? '#38bdf8' : '#10b981',
                            }}>
                              {rm.operationalStatus}
                            </span>
                          </div>

                          {activeStay && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              Guest: <strong>{activeStay.guest?.name}</strong>
                            </div>
                          )}

                          {hasActiveIncident && (
                            <div style={{
                              backgroundColor: 'var(--color-critical-bg)',
                              color: 'var(--color-critical)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '4px',
                            }}>
                              🚨 {rm.incidents.length} Active Incident
                            </div>
                          )}

                          {hasServiceReq && (
                            <div style={{
                              backgroundColor: 'var(--color-low-bg)',
                              color: 'var(--color-low)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '4px',
                              marginLeft: hasActiveIncident ? '6px' : '0',
                            }}>
                              🛎️ Service
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: ROUTINE SERVICE REQUESTS QUEUE */}
      {activeTab === 'SERVICES' && (
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '14px' }}>
            Unified Guest Service Queue ({serviceRequests.length})
          </h2>

          {serviceRequests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              No service requests pending.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {serviceRequests.map((s) => (
                <div key={s.id} className="card card-elevated" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                        Room {s.room?.roomNumber || 'N/A'} — {s.category.replace(/_/g, ' ')}
                      </strong>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '6px 0' }}>
                        {s.description}
                      </p>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Submitted {new Date(s.createdAt).toLocaleTimeString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-low">{s.status}</span>
                      {s.status === 'SUBMITTED' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setAssignServiceModal(s);
                            if (staffList.length > 0) setSelectedStaffId(staffList[0].id);
                          }}
                        >
                          Dispatch Staff
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Room Detail Drawer / Modal */}
      {selectedRoom && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div className="card card-elevated" style={{ width: '100%', maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-light)' }}>
                Room {selectedRoom.roomNumber} Overview
              </h3>
              <button
                onClick={() => setSelectedRoom(null)}
                style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', padding: '4px' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px', fontSize: '0.88rem' }}>
              <div>Floor: <strong>Floor {selectedRoom.floor}</strong></div>
              <div>Type: <strong>{selectedRoom.roomType}</strong></div>
              <div>Status: <strong>{selectedRoom.operationalStatus}</strong></div>
              <div>Presence: <em style={{ color: 'var(--text-muted)' }}>Unknown (Per PRD FR-029)</em></div>
            </div>

            {selectedRoom.stays && selectedRoom.stays[0] ? (
              <div style={{
                backgroundColor: 'var(--bg-app)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>
                  Current Active Guest Stay
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Guest: <strong>{selectedRoom.stays[0].guest?.name}</strong> ({selectedRoom.stays[0].guest?.email})
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Checked In: {new Date(selectedRoom.stays[0].checkInAt).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active booking stay record for this room.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedRoom(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Assignment Modal for Incidents */}
      {assignModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div className="card card-elevated" style={{ width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: 'var(--brand-light)' }}>
              Assign Responder to #{assignModal.id.slice(-6).toUpperCase()}
            </h3>

            <div className="form-group">
              <label className="form-label">Select Active Staff Member</label>
              <select
                className="form-select"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email}) — {s.assignments?.length || 0} active tasks
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Dispatch Instructions</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={assignInstructions}
                onChange={(e) => setAssignInstructions(e.target.value)}
                placeholder="E.g. bring extinguisher and inspect room 101 immediately..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setAssignModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submitAssign}
                disabled={assignLoading || !selectedStaffId}
              >
                {assignLoading ? 'Dispatching...' : 'Dispatch Responder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Request Assign Modal */}
      {assignServiceModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div className="card card-elevated" style={{ width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: 'var(--brand-light)' }}>
              Assign Service Request
            </h3>
            <div className="form-group">
              <label className="form-label">Assign To</label>
              <select
                className="form-select"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setAssignServiceModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitServiceAssign} disabled={assignLoading}>
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {closeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div className="card card-elevated" style={{ width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: 'var(--color-success)' }}>
              Verify & Close Incident
            </h3>

            <div className="form-group">
              <label className="form-label">Resolution / Outcome Note</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe resolution outcome, inspection results, and guest safety state..."
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={externalContacted}
                  onChange={(e) => setExternalContacted(e.target.checked)}
                />
                External emergency service was contacted (Fire/Police/Ambulance)
              </label>
            </div>

            {externalContacted && (
              <div className="form-group">
                <label className="form-label">Handover / Reference Details</label>
                <input
                  type="text"
                  className="form-input"
                  value={externalDetails}
                  onChange={(e) => setExternalDetails(e.target.value)}
                  placeholder="E.g. Dispatched local fire station 4; unit 12 arrived"
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setCloseModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submitClose}
                disabled={!resolutionNote.trim()}
              >
                Confirm Closure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {escalateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div className="card card-elevated" style={{ width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: 'var(--color-critical)' }}>
              Escalate Incident Priority
            </h3>
            <div className="form-group">
              <label className="form-label">Escalation Reason</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Reason for escalating to CRITICAL..."
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setEscalateModal(null)}>Cancel</button>
              <button
                className="btn btn-critical"
                onClick={submitEscalate}
                disabled={!escalateReason.trim()}
              >
                Confirm Escalation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
