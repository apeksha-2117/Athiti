import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlertIcon, RadioIcon, MapPinIcon, MegaphoneIcon, ChevronRightIcon } from '../../components/common/Icons';

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="container" style={{ maxWidth: '1040px', padding: 'clamp(28px, 6vh, 56px) 16px clamp(40px, 8vh, 80px) 16px' }}>
      {/* Hero Section */}
      <div style={{ maxWidth: '780px', marginBottom: 'clamp(32px, 6vh, 56px)' }}>
        <h1 style={{
          fontSize: 'clamp(1.85rem, 5.5vw, 3.0rem)',
          fontWeight: 800,
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          marginBottom: '16px',
        }}>
          Real-Time Hospitality Crisis Coordination & Safety Console
        </h1>

        <p style={{
          fontSize: 'clamp(0.95rem, 3.2vw, 1.15rem)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: '28px',
        }}>
          Athithi connects hotel guests, first-responder staff, and centralized control command through an interactive 2D architectural blueprint, low-latency WebSocket dispatch, and auditable incident tracking.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {user ? (
            <Link
              to={user.role === 'GUEST' ? '/guest' : user.role === 'STAFF' ? '/staff' : '/admin'}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '0.95rem', minHeight: '44px' }}
            >
              Open Your {user.role === 'ADMIN' ? 'Command Console' : user.role === 'STAFF' ? 'Staff Inbox' : 'Guest Portal'}
              <ChevronRightIcon size={16} />
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '0.95rem', minHeight: '44px' }}>
              Launch Operations Demo
              <ChevronRightIcon size={16} />
            </Link>
          )}

          <Link
            to="/report-incident"
            className="btn btn-secondary"
            style={{ padding: '12px 20px', fontSize: '0.95rem', minHeight: '44px' }}
          >
            Public Hazard Reporting
          </Link>
        </div>
      </div>

      {/* Structural Capabilities Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: '16px',
        marginBottom: '48px',
      }}>
        <div className="card card-elevated" style={{ padding: '24px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-critical)',
            marginBottom: '16px',
          }}>
            <ShieldAlertIcon size={20} />
          </div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Frictionless Guest SOS
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            One-touch emergency activation with automatic room association, high-precision property geolocation, and contextual area clarification.
          </p>
        </div>

        <div className="card card-elevated" style={{ padding: '24px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-low)',
            marginBottom: '16px',
          }}>
            <MapPinIcon size={20} />
          </div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
            2D Architectural Blueprint
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Multi-floor architectural blueprint with live radar markers, room inspection, and responder tracking.
          </p>
        </div>

        <div className="card card-elevated" style={{ padding: '24px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand-light)',
            marginBottom: '16px',
          }}>
            <RadioIcon size={20} />
          </div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Sub-Second Proximity Dispatch
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Real-time updates delivered instantly to on-duty security, facilities, and housekeeping staff.
          </p>
        </div>
      </div>

      {/* Safety Notice Footer */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Grand Athithi Hotel • Safety & Facilities Command System
        </div>
      </div>
    </div>
  );
}
