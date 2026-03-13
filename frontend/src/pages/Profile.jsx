import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword } from '../services/api';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const [form, setForm]     = useState({ old_password: '', new_password: '', confirm: '' });
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy]     = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.new_password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await changePassword({ old_password: form.old_password, new_password: form.new_password });
      setSuccess('Password changed successfully!');
      setForm({ old_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Profile" subtitle="Manage your account and settings" />

      {/* User info card */}
      <div className="request-card" style={{ maxWidth: 520, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'var(--iitb-blue-primary, #003366)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', color: '#fff', flexShrink: 0,
          }}>
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{user?.username}</h3>
            <p style={{ margin: '0.15rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user?.email}</p>
            {user?.phone && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📞 {user.phone}</p>}
          </div>
        </div>
        <div style={{
          marginTop: '1rem', padding: '0.6rem 1rem',
          background: 'var(--bg-secondary, #f8f8f8)',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{ fontSize: '1.4rem' }}>⭐</span>
          <div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--iitb-blue-primary, #003366)' }}>
              {user?.points ?? 0}
            </span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: '0.4rem', fontSize: '0.9rem' }}>
              help points earned
            </span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div style={{ maxWidth: 520 }}>
        <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>

        {error   && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="auth-success" style={{ marginBottom: '1rem' }}>{success}</div>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Current Password</label>
            <input name="old_password" type="password" className="search-input"
              placeholder="Your current password" value={form.old_password} onChange={handle} required />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input name="new_password" type="password" className="search-input"
              placeholder="Min. 8 characters" value={form.new_password} onChange={handle} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input name="confirm" type="password" className="search-input"
              placeholder="Re-enter new password" value={form.confirm} onChange={handle} required />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Update Password'}
            </button>
            <button type="button" className="btn" onClick={logout}
              style={{ color: '#dc2626', border: '1px solid #fca5a5' }}>
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
