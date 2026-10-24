import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="container" style={{ maxWidth: '960px', padding: '40px 20px 80px 20px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '50px' }}>
        <div style={{
          display: 'inline-block',
          padding: '4px 14px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--brand-muted)',
          color: 'var(--brand-light)',
          fontSize: '0.8rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '14px',
        }}>
          SDG 11 • Sustainable Cities & Safe Communities
        </div>
        <h1 style={{
          fontSize: '2.8rem',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          marginBottom: '14px',
        }}>
          ATHITHI
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: 'var(--brand-light)',
          fontWeight: 600,
          marginBottom: '12px',
        }}>
          Athithi Devo Bhava. Their safety, our responsibility.
        </p>
        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)',
          maxWidth: '620px',
          margin: '0 auto 28px auto',
          lineHeight: 1.6,
        }}>
          A unified, real-time crisis coordination and hospitality service platform connecting hotel guests, first-responder staff, and control room command.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <Link
              to={user.role === 'GUEST' ? '/guest' : user.role === 'STAFF' ? '/staff' : '/admin'}
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: '1rem' }}
            >
              Go to Your {user.role} Portal →
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '1rem' }}>
              Launch Live Demo / Sign In
            </Link>
          )}

          <Link to="/report-incident" className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: '1rem' }}>
            Public Hazard Reporting →
          </Link>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '50px',
      }}>
        <div className="card card-elevated">
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>🚨</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Guest SOS</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Instant, friction-free emergency reporting. Directly notifies dispatch without waiting for reception phone pickups.
          </p>
        </div>

        <div className="card card-elevated">
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>📡</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Control Room</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Live incident queue, room overview, staff dispatch, and verified closure with external emergency service logs.
          </p>
        </div>

        <div className="card card-elevated">
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>⚡</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Staff Dispatch</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Actionable task inbox for security and maintenance responders. Mandatory acknowledgements and progress milestones.
          </p>
        </div>

        <div className="card card-elevated">
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>🌐</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Public Reporting</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Safe perimeter and public hazard channel. Bystanders report threats without access to private hotel or guest records.
          </p>
        </div>
      </div>
    </div>
  );
}
