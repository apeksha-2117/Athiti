import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { MegaphoneIcon, CheckCircleIcon } from '../../components/common/Icons';

const CATEGORIES = [
  { value: 'FIRE_OR_SMOKE', label: 'Fire or Smoke Observed' },
  { value: 'ELECTRICAL_HAZARD', label: 'Exposed Wires / Electrical Hazard' },
  { value: 'WATER_LEAKAGE', label: 'Water Burst / Flooding' },
  { value: 'STRUCTURAL_HAZARD', label: 'Falling Debris / Structural Hazard' },
  { value: 'SECURITY_THREAT', label: 'Suspicious Activity / Trespasser' },
  { value: 'OTHER', label: 'Other Physical Threat' },
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
    <div className="container" style={{ maxWidth: '580px', margin: 'clamp(20px, 4vh, 40px) auto', padding: '0 14px' }}>
      <div className="card card-elevated" style={{ padding: 'clamp(20px, 4vw, 36px) clamp(16px, 4vw, 30px)' }}>
        <div style={{ marginBottom: '22px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--brand-light)',
            marginBottom: '6px',
          }}>
            <MegaphoneIcon size={18} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.04em' }}>Public Hazard Reporting</span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 800, color: 'var(--text-primary)' }}>
            Report Incident or Physical Threat
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: '4px' }}>
            Submit a hazard report directly to hotel security and operations.
          </p>
        </div>

        {submitted ? (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '24px',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--color-success)' }}>
              <CheckCircleIcon size={32} />
            </div>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--color-success)', fontWeight: 700 }}>
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
              <strong>Emergency:</strong> In an immediate life-threatening emergency, please also call emergency services (112 / 911).
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading && <span className="btn-spinner" />}
              <span>{loading ? 'Transmitting to Control Room...' : 'Submit Incident Report'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
