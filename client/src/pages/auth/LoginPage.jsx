import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlertIcon, UserIcon, BedIcon, WrenchIcon } from '../../components/common/Icons';

const DEMO_PRESETS = [
  { label: 'Hotel Command Admin', sub: 'Priya Sharma • Central Control', email: 'admin@athithi.demo', role: 'ADMIN', icon: ShieldAlertIcon },
  { label: 'Guest — Room 101', sub: 'Ananya Iyer • Active Stay Floor 1', email: 'guest.ananya@athithi.demo', role: 'GUEST', icon: BedIcon },
  { label: 'Guest — Room 201', sub: 'Vikram Patel • Active Stay Floor 2', email: 'guest.vikram@athithi.demo', role: 'GUEST', icon: BedIcon },
  { label: 'On-Duty Staff Responder', sub: 'Arjun Nair • Active On-Duty Staff', email: 'staff.security@athithi.demo', role: 'STAFF', icon: UserIcon },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('guest.ananya@athithi.demo');
  const [password, setPassword] = useState('Demo1234!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'GUEST') navigate('/guest');
      else if (user.role === 'STAFF') navigate('/staff');
      else if (user.role === 'ADMIN') navigate('/admin');
      else navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (presetEmail) => {
    setEmail(presetEmail);
    setPassword('Demo1234!');
    setError('');
  };

  return (
    <div style={{
      maxWidth: '480px',
      margin: 'clamp(20px, 4vh, 48px) auto',
      padding: '0 14px',
      width: '100%',
    }}>
      <div className="card card-elevated" style={{ padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 26px)' }}>
        <div style={{ marginBottom: '22px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--brand-light)',
            marginBottom: '6px',
          }}>
            <ShieldAlertIcon size={20} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.08em' }}>ATHITHI</span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.45rem)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Operations & Guest Sign In
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Grand Athithi Hotel • Hospitality Crisis & Service Network
          </p>
        </div>

        {/* Demo Preset Selector */}
        <div style={{
          backgroundColor: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 10px',
          marginBottom: '20px',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            fontSize: '0.70rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            marginBottom: '8px',
          }}>
            Demo Preset Selector
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {DEMO_PRESETS.map((p) => {
              const Icon = p.icon;
              const isSelected = email === p.email;
              return (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => selectPreset(p.email)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 10px',
                    minHeight: '44px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: isSelected ? 'var(--bg-surface-active)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'transparent'}`,
                    transition: 'all 0.12s ease',
                    textAlign: 'left',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1, marginRight: '8px' }}>
                    <div style={{
                      color: isSelected ? 'var(--brand-light)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.80rem',
                        fontWeight: 600,
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {p.label}
                      </div>
                      <div style={{
                        fontSize: '0.70rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {p.sub}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${p.role === 'ADMIN' ? 'badge-critical' : p.role === 'STAFF' ? 'badge-high' : 'badge-neutral'}`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                    {p.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--color-critical-bg)',
            border: '1px solid var(--color-critical-border)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
            marginBottom: '18px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', minHeight: '44px', fontSize: '0.92rem', padding: '12px' }}
          >
            {loading ? 'Authenticating Credentials...' : 'Authenticate'}
          </button>
        </form>
      </div>
    </div>
  );
}
