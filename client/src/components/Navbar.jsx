import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../realtime/socket';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: 'var(--brand-light)',
          }}>ATHITHI</span>
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--brand-muted)',
            color: 'var(--brand-light)',
            fontWeight: 600,
          }}>DEMO</span>
        </Link>

        {user && (
          <nav style={{ display: 'flex', gap: '12px', marginLeft: '12px' }}>
            {user.role === 'GUEST' && (
              <Link to="/guest" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Guest Portal
              </Link>
            )}
            {user.role === 'STAFF' && (
              <Link to="/staff" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Staff Tasks
              </Link>
            )}
            {user.role === 'ADMIN' && (
              <Link to="/admin" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Command Centre
              </Link>
            )}
          </nav>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/report-incident" style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          borderBottom: '1px dotted var(--text-muted)',
        }}>
          Public Hazard Report
        </Link>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Realtime Dot Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: socketConnected ? 'var(--color-success)' : 'var(--text-muted)',
            }} title={socketConnected ? 'Live Connection Active' : 'Connecting to Live Hub'}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: socketConnected ? 'var(--color-success)' : '#ef4444',
                display: 'inline-block',
                boxShadow: socketConnected ? '0 0 8px #10b981' : 'none',
              }} />
              <span>{socketConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>

            <span className={`badge badge-${user.role.toLowerCase() === 'admin' ? 'critical' : 'high'}`}>
              {user.role}
            </span>

            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
              {user.name}
            </span>

            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
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
