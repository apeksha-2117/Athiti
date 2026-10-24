import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DEMO_ACCOUNTS = [
  { label: 'Admin (Control Room)', email: 'admin@athithi.demo', role: 'ADMIN' },
  { label: 'Staff (Security)', email: 'staff.security@athithi.demo', role: 'STAFF' },
  { label: 'Staff (Maintenance)', email: 'staff.maintenance@athithi.demo', role: 'STAFF' },
  { label: 'Guest (Room 101)', email: 'guest.ananya@athithi.demo', role: 'GUEST' },
  { label: 'Guest (Room 201)', email: 'guest.vikram@athithi.demo', role: 'GUEST' },
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

  const selectDemoUser = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Demo1234!');
    setError('');
  };

  return (
    <div style={{
      maxWidth: '460px',
      margin: '60px auto',
      padding: '0 20px',
      width: '100%',
    }}>
      <div className="card card-elevated" style={{ padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            color: 'var(--brand-light)',
            letterSpacing: '0.04em',
            marginBottom: '6px',
          }}>
            ATHITHI
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Hospitality Crisis & Service Coordination
          </p>
          <div style={{
            marginTop: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}>
            “Athithi Devo Bhava — Their safety, our responsibility”
          </div>
        </div>

        {/* Quick Demo Selector */}
        <div style={{
          backgroundColor: 'var(--bg-app)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--brand-light)',
            marginBottom: '8px',
          }}>
            ⚡ 1-Tap Demo Switcher
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => selectDemoUser(acc.email)}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: email === acc.email ? 'var(--brand-primary)' : 'var(--bg-surface-elevated)',
                  color: email === acc.email ? '#ffffff' : 'var(--text-secondary)',
                  border: '1px solid var(--border-muted)',
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--color-critical-bg)',
            border: '1px solid var(--color-critical-border)',
            color: 'var(--color-critical)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
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

          <div className="form-group" style={{ marginBottom: '24px' }}>
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
            style={{ width: '100%', fontSize: '1rem', padding: '12px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
