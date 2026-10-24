import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client';

const CATEGORIES = [
  { value: 'FIRE_OR_SMOKE', label: '🔥 Fire / Smoke Observed' },
  { value: 'ELECTRICAL_HAZARD', label: '⚡ Exposed Wires / Electrical Spark' },
  { value: 'WATER_LEAKAGE', label: '💧 Water Burst / Flooding' },
  { value: 'STRUCTURAL_HAZARD', label: '🧱 Falling Debris / Structural Crack' },
  { value: 'SECURITY_THREAT', label: '🛡️ Suspicious Activity / Trespasser' },
  { value: 'OTHER', label: '⚠️ Other Physical Hazard' },
];

export function PublicReportPage() {
  const [category, setCategory] = useState('FIRE_OR_SMOKE');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/public/reports', {
        method: 'POST',
        body: JSON.stringify({ category, location, description }),
      });
      setSubmitted(data);
    } catch (err) {
      setError(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '580px', margin: '40px auto' }}>
      <div className="card card-elevated" style={{ padding: '36px 30px' }}>
        <div style={{ marginBottom: '24px' }}>
          <span className="badge badge-high" style={{ marginBottom: '8px' }}>
            Public Hazard Reporting
          </span>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Report Hazard / Safety Threat
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '6px' }}>
            For hotel visitors, passersby, or staff outside shift. Submissions route directly to the Grand Athithi Hotel safety command console.
          </p>
        </div>

        {submitted ? (
          <div style={{
            backgroundColor: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✅</div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--color-success)', fontWeight: 700 }}>
              Report Received by Control Room
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: '12px 0' }}>
              Your report reference number:
            </p>
            <div style={{
              backgroundColor: 'var(--bg-app)',
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '1.1rem',
              fontWeight: 800,
              color: 'var(--brand-light)',
              display: 'inline-block',
            }}>
              {submitted.reference}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '16px' }}>
              On-duty hotel operators have received your notification and will triage the situation promptly.
            </p>
            <div style={{ marginTop: '24px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSubmitted(null);
                  setDescription('');
                  setLocation('');
                }}
              >
                Submit Another Report
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                backgroundColor: 'var(--color-critical-bg)',
                border: '1px solid var(--color-critical-border)',
                color: 'var(--color-critical)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Hazard Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Approximate Location</label>
              <input
                type="text"
                className="form-input"
                placeholder="E.g. 2nd Floor corridor near elevator, or North perimeter gate"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Description of Hazard</label>
              <textarea
                className="form-textarea"
                rows="4"
                placeholder="Describe what you see, heard, or smelled (e.g. burning electrical wire smell near Room 204)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div style={{
              backgroundColor: 'var(--bg-app)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginBottom: '20px',
            }}>
              ⚠️ If life or physical safety is in immediate catastrophic peril, also dial local emergency dispatch (112 / 911) directly.
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px' }}
            >
              {loading ? 'Transmitting to Control Room...' : 'Submit Incident Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
