import React, { useState, useEffect } from 'react';
import { apiFetch, getMediaUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../realtime/socket';
import { HotelFloorPlan } from '../../components/floorplan/HotelFloorPlan';
import {
  ShieldAlertIcon,
  MapPinIcon,
  BellIcon,
  MegaphoneIcon,
  UsersIcon,
  ActivityIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  FlameIcon,
  ZapIcon,
  DropletIcon,
  FileTextIcon,
  ChevronRightIcon,
  SparklesIcon,
  GridIcon,
} from '../../components/common/Icons';

export function AdminPortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('INCIDENTS'); // 'INCIDENTS' | 'ROOMS' | 'SERVICES' | 'PUBLIC_REPORTS' | 'AUDIT_LOGS'
  const [floorplanViewMode, setFloorplanViewMode] = useState('BLUEPRINT'); // 'BLUEPRINT' | 'CARDS'

  const [incidents, setIncidents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [publicReports, setPublicReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [staffPositions, setStaffPositions] = useState({});
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
  const [closeLoading, setCloseLoading] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [externalContacted, setExternalContacted] = useState(false);
  const [externalDetails, setExternalDetails] = useState('');

  const [escalateModal, setEscalateModal] = useState(null);
  const [escalateReason, setEscalateReason] = useState('');

  // Service Request Assign Modal
  const [assignServiceModal, setAssignServiceModal] = useState(null);

  // AI Situation Brief Modal
  const [aiBriefModal, setAiBriefModal] = useState(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);

  // Public Report Review Modal
  const [reviewReportModal, setReviewReportModal] = useState(null);
  const [reviewAction, setReviewAction] = useState('ESCALATE');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const loadData = async () => {
    try {
      const [incData, staffData, roomsData, srvData, pubData, auditData, locData] = await Promise.all([
        apiFetch('/admin/incidents'),
        apiFetch('/admin/staff'),
        apiFetch('/admin/rooms'),
        apiFetch('/admin/service-requests'),
        apiFetch('/admin/public-reports'),
        apiFetch('/admin/audit-logs'),
        apiFetch('/admin/staff/locations').catch(() => ({ staffPositions: {} })),
      ]);
      setIncidents(incData.incidents || []);
      setStaffList(staffData.staff || []);
      setRooms(roomsData.rooms || []);
      setServiceRequests(srvData.requests || []);
      setPublicReports(pubData.reports || []);
      setAuditLogs(auditData.logs || []);
      setStaffPositions(locData?.staffPositions || {});
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
    const handleRefresh = () => {
      loadData();
    };

    const handleStaffPositions = (positions) => {
      setStaffPositions(positions || {});
    };

    const handleIncidentCreated = (newIncident) => {
      // Immediate 0ms UI update
      setIncidents((prev) => {
        if (!newIncident?.id || prev.some((inc) => inc.id === newIncident.id)) return prev;
        return [newIncident, ...prev];
      });
      loadData();
    };

    const handleIncidentUpdated = (updatedIncident) => {
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === updatedIncident?.id ? { ...inc, ...updatedIncident } : inc))
      );
      loadData();
    };

    socket.on('incident:created', handleIncidentCreated);
    socket.on('incident:updated', handleIncidentUpdated);
    socket.on('incident:assigned', handleRefresh);
    socket.on('staff:positions', handleStaffPositions);
    socket.on('assignment:acknowledged', handleRefresh);
    socket.on('assignment:declined', handleRefresh);
    socket.on('assignment:updated', handleRefresh);
    socket.on('assignment:escalated', handleRefresh);
    socket.on('service_request:created', handleRefresh);
    socket.on('service_request:updated', handleRefresh);
    socket.on('public_report:created', handleRefresh);
    socket.on('public_report:updated', handleRefresh);

    // Instant refresh when user returns to this tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', loadData);

    // 25-second background sync fallback (realtime handled instantly via Socket.IO)
    const syncTimer = setInterval(loadData, 25000);

    return () => {
      socket.off('incident:created', handleIncidentCreated);
      socket.off('incident:updated', handleIncidentUpdated);
      socket.off('incident:assigned', handleRefresh);
      socket.off('staff:positions', handleStaffPositions);
      socket.off('assignment:acknowledged', handleRefresh);
      socket.off('assignment:declined', handleRefresh);
      socket.off('assignment:updated', handleRefresh);
      socket.off('assignment:escalated', handleRefresh);
      socket.off('service_request:created', handleRefresh);
      socket.off('service_request:updated', handleRefresh);
      socket.off('public_report:created', handleRefresh);
      socket.off('public_report:updated', handleRefresh);

      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', loadData);
      clearInterval(syncTimer);
    };
  }, []);

  const openAiBrief = async (incident) => {
    setAiBriefLoading(true);
    setAiBriefModal({ incident, summary: null });
    try {
      const data = await apiFetch(`/admin/incidents/${incident.id}/summary`);
      setAiBriefModal({ incident, summary: data.summary });
    } catch (err) {
      alert(err.message || 'Failed to generate situation summary');
      setAiBriefModal(null);
    } finally {
      setAiBriefLoading(false);
    }
  };

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
    if (!resolutionNote.trim() || closeLoading) return;
    setCloseLoading(true);
    try {
      const payload = {
        resolutionNote: resolutionNote.trim(),
        externalServiceContacted: Boolean(externalContacted),
      };
      if (externalContacted && externalDetails.trim()) {
        payload.externalServiceDetails = { notes: externalDetails.trim() };
      }

      await apiFetch(`/admin/incidents/${closeModal.id}/close`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Optimistic state update
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === closeModal.id ? { ...inc, status: 'CLOSED', resolutionNote } : inc))
      );

      setCloseModal(null);
      setResolutionNote('');
      setExternalContacted(false);
      setExternalDetails('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to close incident');
    } finally {
      setCloseLoading(false);
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

  const submitReportReview = async () => {
    if (!reviewNote.trim()) return;
    setReviewLoading(true);
    try {
      await apiFetch(`/admin/public-reports/${reviewReportModal.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action: reviewAction,
          reviewNote,
        }),
      });
      setReviewReportModal(null);
      setReviewNote('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to review report');
    } finally {
      setReviewLoading(false);
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
  const pendingReportsCount = publicReports.filter((p) => p.status === 'UNVERIFIED').length;

  const floors = [1, 2, 3];

  return (
    <div className="container" style={{ maxWidth: '1240px', paddingBottom: '60px', paddingTop: '20px' }}>
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.015em' }}>
            Incident Command Console
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '2px' }}>
            Grand Athithi Hotel • Central Emergency Operations & Dispatch
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCwIcon size={14} />
          <span>Synchronize Console</span>
        </button>
      </div>

      {/* Telemetry Strip (Replaces clichéd KPI cards) */}
      <div className="telemetry-strip">
        <div className="telemetry-item">
          <div className="telemetry-label">
            <span className={`pulse-dot ${activeEmergencies > 0 ? 'pulse-dot-critical' : ''}`} style={{ backgroundColor: activeEmergencies > 0 ? 'var(--color-critical)' : 'var(--text-muted)' }} />
            Active Emergencies
          </div>
          <div className="telemetry-value" style={{ color: activeEmergencies > 0 ? 'var(--color-critical)' : 'var(--text-primary)' }}>
            {activeEmergencies}
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">
            <span className="pulse-dot" style={{ backgroundColor: unassignedCount > 0 ? 'var(--color-high)' : 'var(--text-muted)' }} />
            Unassigned SOS
          </div>
          <div className="telemetry-value" style={{ color: unassignedCount > 0 ? 'var(--color-high)' : 'var(--text-primary)' }}>
            {unassignedCount}
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">
            <span className="pulse-dot" style={{ backgroundColor: respondingCount > 0 ? 'var(--brand-light)' : 'var(--text-muted)' }} />
            Active Responders
          </div>
          <div className="telemetry-value" style={{ color: respondingCount > 0 ? 'var(--brand-light)' : 'var(--text-primary)' }}>
            {respondingCount}
          </div>
        </div>

        <div className="telemetry-item">
          <div className="telemetry-label">
            <span className="pulse-dot" style={{ backgroundColor: pendingReportsCount > 0 ? 'var(--color-low)' : 'var(--text-muted)' }} />
            Unverified Public Triage
          </div>
          <div className="telemetry-value" style={{ color: pendingReportsCount > 0 ? 'var(--color-low)' : 'var(--text-primary)' }}>
            {pendingReportsCount}
          </div>
        </div>
      </div>

      {/* Main Console View Selector Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '10px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        <button
          onClick={() => setActiveTab('INCIDENTS')}
          className={`btn btn-sm ${activeTab === 'INCIDENTS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}
        >
          <ShieldAlertIcon size={15} />
          <span>Incident Queue</span>
          <span className="badge badge-neutral" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>
            {incidents.filter(i => i.status !== 'CLOSED').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ROOMS')}
          className={`btn btn-sm ${activeTab === 'ROOMS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}
        >
          <MapPinIcon size={15} />
          <span>Floor Plan Blueprint</span>
          <span className="badge badge-neutral" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>
            {rooms.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SERVICES')}
          className={`btn btn-sm ${activeTab === 'SERVICES' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}
        >
          <BellIcon size={15} />
          <span>Service Requests</span>
          <span className="badge badge-neutral" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>
            {serviceRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PUBLIC_REPORTS')}
          className={`btn btn-sm ${activeTab === 'PUBLIC_REPORTS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}
        >
          <MegaphoneIcon size={15} />
          <span>Public Triage</span>
          <span className="badge badge-neutral" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>
            {publicReports.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT_LOGS')}
          className={`btn btn-sm ${activeTab === 'AUDIT_LOGS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}
        >
          <ActivityIcon size={15} />
          <span>Audit Trail</span>
          <span className="badge badge-neutral" style={{ fontSize: '0.65rem', marginLeft: '4px' }}>
            {auditLogs.length}
          </span>
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
                      border: inc.priority === 'CRITICAL' ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--border-muted)',
                      backgroundColor: inc.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-surface-elevated)',
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

                        {/* Attached Photos / Completion Proof */}
                        {inc.attachments && inc.attachments.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
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
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-xs)',
                                    fontSize: '0.74rem',
                                    color: isStaffProof ? '#6ee7b7' : '#7dd3fc',
                                    textDecoration: 'none',
                                  }}
                                >
                                  <img
                                    src={getMediaUrl(att.storageKey)}
                                    alt="evidence"
                                    style={{ width: '22px', height: '22px', borderRadius: '3px', objectFit: 'cover' }}
                                  />
                                  <span>{isStaffProof ? 'Staff Completion Proof' : 'Guest Photo Evidence'}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          Reporter: {inc.reporter?.name || 'Guest / Public'} • Room {inc.room?.roomNumber || 'N/A'} (Floor {inc.room?.floor || 'N/A'}) • {new Date(inc.createdAt).toLocaleTimeString()}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-high" style={{ padding: '6px 10px' }}>
                          {inc.status}
                        </span>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openAiBrief(inc)}
                          style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-light)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <SparklesIcon size={14} color="var(--brand-light)" />
                          <span>AI Brief</span>
                        </button>

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
                        padding: '10px 14px',
                        backgroundColor: 'rgba(56, 189, 248, 0.06)',
                        border: '1px solid rgba(56, 189, 248, 0.22)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'rgba(56, 189, 248, 0.15)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-xs)',
                            fontWeight: 700,
                            color: '#38bdf8',
                            fontSize: '0.74rem',
                          }}>
                            <span className="pulse-dot pulse-dot-critical" style={{ width: '4px', height: '4px' }} />
                            <span>Proximity Auto-Dispatched</span>
                          </span>
                          <span>
                            Responder: <strong>{activeAssignment.assignee?.name}</strong> ({activeAssignment.assignee?.role})
                          </span>
                          <span className="badge badge-high" style={{ fontSize: '0.70rem' }}>
                            {activeAssignment.status}
                          </span>
                          {activeAssignment.instructions && (
                            <span style={{ color: 'var(--text-secondary)' }}>• "{activeAssignment.instructions}"</span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Admin override available
                        </span>
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

      {/* VIEW 2: HOTEL FLOOR PLAN & ROOMS */}
      {activeTab === 'ROOMS' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
              Interactive architectural 2D blueprint with live hazard markers, occupancy tracking, and room inspection.
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className={`btn btn-sm ${floorplanViewMode === 'BLUEPRINT' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setFloorplanViewMode('BLUEPRINT')}
              >
                <GridIcon size={14} />
                <span>CAD Blueprint View</span>
              </button>
              <button
                className={`btn btn-sm ${floorplanViewMode === 'CARDS' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setFloorplanViewMode('CARDS')}
              >
                <FileTextIcon size={14} />
                <span>Room Cards Grid</span>
              </button>
            </div>
          </div>

          {floorplanViewMode === 'BLUEPRINT' ? (
            <HotelFloorPlan
              rooms={rooms}
              incidents={incidents}
              serviceRequests={serviceRequests}
              publicReports={publicReports}
              staffList={staffList}
              staffPositions={staffPositions}
              onSelectRoom={(rm) => setSelectedRoom(rm)}
              onAssignIncident={(inc) => {
                if (staffList.length > 0) setSelectedStaffId(staffList[0].id);
                setAssignModal(inc);
              }}
              onEscalateIncident={(inc) => setEscalateModal(inc)}
              onCloseIncident={(inc) => setCloseModal(inc)}
              onAssignService={(srv) => {
                if (staffList.length > 0) setSelectedStaffId(staffList[0].id);
                setAssignServiceModal(srv);
              }}
            />
          ) : (
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
                                {rm.incidents.length} Active Incident
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
                                Service
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
          )}
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

                      {/* Attached Photos / Resolution Proof */}
                      {s.attachments && s.attachments.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {s.attachments.map((att) => {
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
                                  padding: '3px 8px',
                                  borderRadius: 'var(--radius-xs)',
                                  fontSize: '0.74rem',
                                  color: isStaffProof ? '#6ee7b7' : '#7dd3fc',
                                  textDecoration: 'none',
                                }}
                              >
                                <img
                                  src={getMediaUrl(att.storageKey)}
                                  alt="evidence"
                                  style={{ width: '22px', height: '22px', borderRadius: '3px', objectFit: 'cover' }}
                                />
                                <span>{isStaffProof ? 'Staff Completion Proof' : 'Guest Photo'}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
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

      {/* VIEW 4: PUBLIC REPORTS TRIAGE */}
      {activeTab === 'PUBLIC_REPORTS' && (
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
            Public Hazard Reports Triage Queue ({publicReports.length})
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Review external hazard reports submitted by visitors and bystanders. Escalate to active incident or dismiss.
          </p>

          {publicReports.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              No public reports in review queue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {publicReports.map((rep) => (
                <div key={rep.id} className="card card-elevated" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span className={`badge ${rep.status === 'UNVERIFIED' ? 'badge-high' : rep.status === 'ESCALATED' ? 'badge-critical' : 'badge-low'}`}>
                          {rep.status}
                        </span>
                        <strong style={{ fontSize: '1rem' }}>
                          {rep.category.replace(/_/g, ' ')}
                        </strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--brand-light)', fontFamily: 'var(--font-mono)' }}>
                          Ref: {rep.reference}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--brand-light)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPinIcon size={14} color="var(--brand-light)" />
                        <span>Location: <strong>{rep.location}</strong></span>
                      </div>

                      <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '6px' }}>
                        {rep.description}
                      </p>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Received at {new Date(rep.createdAt).toLocaleString()}
                        {rep.reviewedAt && ` • Reviewed: ${new Date(rep.reviewedAt).toLocaleTimeString()}`}
                      </div>

                      {rep.reviewNote && (
                        <div style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          backgroundColor: 'var(--bg-app)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                        }}>
                          Operator Note: {rep.reviewNote}
                        </div>
                      )}
                    </div>

                    {rep.status === 'UNVERIFIED' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setReviewReportModal(rep);
                            setReviewAction('DISMISS');
                          }}
                        >
                          Dismiss
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setReviewReportModal(rep);
                            setReviewAction('ESCALATE');
                          }}
                        >
                          Verify & Escalate to Incident
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: AUDIT LOGS & CHAIN OF CUSTODY */}
      {activeTab === 'AUDIT_LOGS' && (
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
            System Audit Trail & Chain of Custody ({auditLogs.length})
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Authoritative, immutable event timeline of all triggers, assignments, acknowledgements, and closures.
          </p>

          <div className="card card-elevated" style={{ padding: '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Timestamp (UTC)</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                  <th style={{ padding: '12px 16px' }}>Actor</th>
                  <th style={{ padding: '12px 16px' }}>Entity Type</th>
                  <th style={{ padding: '12px 16px' }}>Change Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--brand-light)' }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {log.actor?.name || 'System / Automated'} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({log.actor?.role || 'SYSTEM'})</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>
                      {log.entityType}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {log.changeSummary ? JSON.stringify(log.changeSummary) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Situation Briefing Modal */}
      {aiBriefModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '620px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SparklesIcon size={18} color="var(--brand-light)" />
                <span>AI Situation Briefing #{aiBriefModal.incident?.id.slice(-6).toUpperCase()}</span>
              </h3>
              <button onClick={() => setAiBriefModal(null)} style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', padding: '4px' }}>
                ×
              </button>
            </div>

            {aiBriefLoading || !aiBriefModal.summary ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                Synthesizing audit events and incident records...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Verified Facts */}
                <div style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.80rem', color: '#6ee7b7', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircleIcon size={15} color="#10b981" />
                    <span>Verified Incident Facts</span>
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                    {aiBriefModal.summary.verifiedFacts.map((fact, idx) => (
                      <li key={idx}>{fact}</li>
                    ))}
                  </ul>
                </div>

                {/* Unresolved Questions */}
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.80rem', color: '#fca5a5', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangleIcon size={15} color="#ef4444" />
                    <span>Unresolved Questions & Risk Exposure</span>
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                    {aiBriefModal.summary.unresolvedQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Next Actions */}
                <div style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.80rem', color: '#fde047', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlertIcon size={15} color="#f59e0b" />
                    <span>Recommended Operator Protocol</span>
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                    {aiBriefModal.summary.recommendedActions.map((act, idx) => (
                      <li key={idx}>{act}</li>
                    ))}
                  </ul>
                </div>

                {/* Disclaimer */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <strong>Disclaimer:</strong> {aiBriefModal.summary.disclaimer}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setAiBriefModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Public Report Modal */}
      {reviewReportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: reviewAction === 'ESCALATE' ? 'var(--color-critical)' : 'var(--text-secondary)' }}>
              {reviewAction === 'ESCALATE' ? 'Verify & Escalate Report' : 'Dismiss Public Report'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Ref: <strong>{reviewReportModal.reference}</strong> ({reviewReportModal.category}) at {reviewReportModal.location}
            </p>

            <div className="form-group">
              <label className="form-label">Review Assessment Note</label>
              <textarea
                className="form-textarea"
                rows="3"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={reviewAction === 'ESCALATE' ? 'Confirmed hazard verified on security camera...' : 'Duplicate report; already dispatched...'}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setReviewReportModal(null)}>Cancel</button>
              <button
                className={`btn ${reviewAction === 'ESCALATE' ? 'btn-critical' : 'btn-secondary'}`}
                onClick={submitReportReview}
                disabled={reviewLoading || !reviewNote.trim()}
              >
                {reviewLoading ? 'Processing...' : reviewAction === 'ESCALATE' ? 'Confirm Escalation' : 'Confirm Dismissal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Room Detail Drawer / Modal */}
      {selectedRoom && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto' }}>
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
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto' }}>
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
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '440px', maxHeight: '88vh', overflowY: 'auto' }}>
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
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: 'var(--color-success)' }}>
              Verify & Close Incident
            </h3>

            {/* Visual Inspection of Attached Photos / Staff Proof */}
            {closeModal.attachments && closeModal.attachments.length > 0 && (
              <div style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-muted)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                marginBottom: '16px',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Attached Evidence & Staff Proof of Completion
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {closeModal.attachments.map((att) => {
                    const isStaffProof = att.uploadedBy?.role === 'STAFF';
                    return (
                      <a
                        key={att.id || att.storageKey}
                        href={getMediaUrl(att.storageKey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: isStaffProof ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                          border: `1px solid ${isStaffProof ? '#10b981' : '#38bdf8'}`,
                          borderRadius: 'var(--radius-xs)',
                          padding: '6px 10px',
                          textDecoration: 'none',
                          color: isStaffProof ? '#6ee7b7' : '#7dd3fc',
                          fontSize: '0.78rem',
                        }}
                      >
                        <img
                          src={getMediaUrl(att.storageKey)}
                          alt="proof"
                          style={{ width: '32px', height: '32px', borderRadius: '3px', objectFit: 'cover' }}
                        />
                        <div>
                          <strong>{isStaffProof ? 'Staff Completion Proof' : 'Guest Photo'}</strong>
                          <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>Tap to inspect full image</div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

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
              <button
                className="btn btn-secondary"
                onClick={() => setCloseModal(null)}
                disabled={closeLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={submitClose}
                disabled={!resolutionNote.trim() || closeLoading}
              >
                {closeLoading ? 'Closing...' : 'Confirm Closure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {escalateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 'clamp(10px, 3vw, 20px)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="card card-elevated modal-mobile-fit" style={{ width: '100%', maxWidth: '440px', maxHeight: '88vh', overflowY: 'auto' }}>
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
