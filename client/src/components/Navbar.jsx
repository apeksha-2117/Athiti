import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../realtime/socket';
import { ShieldAlertIcon, MegaphoneIcon, ActivityIcon } from './common/Icons';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setSocketConnected(false);
      return;
    }

    const socket = getSocket();
    setSocketConnected(socket.connected);

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header style={{
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 clamp(10px, 3vw, 24px)',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(8px)',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 24px)' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: 'rgba(217, 119, 6, 0.16)',
            border: '1px solid rgba(217, 119, 6, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand-light)',
            flexShrink: 0,
          }}>
            <ShieldAlertIcon size={16} />
          </div>
          <span style={{
            fontSize: '1rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'var(--text-primary)',
          }}>
            ATHITHI
          </span>
          <span
            className="hide-on-mobile"
            style={{
              fontSize: '0.68rem',
              padding: '2px 6px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontWeight: 700,
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            v1.0
          </span>
        </Link>

        {user && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {user.role === 'GUEST' && (
              <Link
                to="/guest"
                className={`btn btn-sm ${location.pathname === '/guest' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                Guest Portal
              </Link>
            )}
            {user.role === 'STAFF' && (
              <Link
                to="/staff"
                className={`btn btn-sm ${location.pathname === '/staff' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                Staff Portal
              </Link>
            )}
            {user.role === 'ADMIN' && (
              <Link
                to="/admin"
                className={`btn btn-sm ${location.pathname === '/admin' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
              >
                Command
              </Link>
            )}
          </nav>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link
          to="/report-incident"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            transition: 'color 0.12s ease, border-color 0.12s ease',
            whiteSpace: 'nowrap',
          }}
          title="File Public Hazard Report"
        >
          <MegaphoneIcon size={14} color="var(--brand-light)" />
          <span className="hide-on-mobile">Public Report</span>
        </Link>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Live Telemetry Beacon */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: socketConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${socketConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: socketConnected ? 'var(--color-success)' : 'var(--color-critical)',
              }}
              title={socketConnected ? 'Realtime WebSocket Dispatch Connected' : 'Disconnected from WebSocket'}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: socketConnected ? 'var(--color-success)' : 'var(--color-critical)',
                  boxShadow: socketConnected ? '0 0 6px var(--color-success)' : 'none',
                }}
              />
              <span className="hide-on-mobile">{socketConnected ? 'TELEMETRY LIVE' : 'OFFLINE'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className={`badge ${user.role === 'ADMIN' ? 'badge-critical' : user.role === 'STAFF' ? 'badge-high' : 'badge-neutral'}`} style={{ padding: '2px 5px', fontSize: '0.68rem' }}>
                {user.role}
              </span>
              <span className="hide-on-mobile" style={{ fontSize: '0.80rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {user.name}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.74rem', padding: '4px 8px' }}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
