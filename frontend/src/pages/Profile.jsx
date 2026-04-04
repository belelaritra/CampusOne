import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword, updateProfile } from '../services/api';

// Keys must match backend MESS_HOSTEL_KEYS (hostel_1 format)
const HOSTEL_OPTIONS = [
  { key: '',           label: '— Select hostel —' },
  { key: 'hostel_1',   label: 'Hostel 1'   }, { key: 'hostel_2',  label: 'Hostel 2'  },
  { key: 'hostel_3',   label: 'Hostel 3'   }, { key: 'hostel_4',  label: 'Hostel 4'  },
  { key: 'hostel_5',   label: 'Hostel 5'   }, { key: 'hostel_6',  label: 'Hostel 6'  },
  { key: 'hostel_7',   label: 'Hostel 7'   }, { key: 'hostel_8',  label: 'Hostel 8'  },
  { key: 'hostel_9',   label: 'Hostel 9'   }, { key: 'hostel_10', label: 'Hostel 10' },
  { key: 'hostel_11',  label: 'Hostel 11'  }, { key: 'hostel_12', label: 'Hostel 12' },
  { key: 'hostel_13',  label: 'Hostel 13'  }, { key: 'hostel_14', label: 'Hostel 14' },
  { key: 'hostel_15',  label: 'Hostel 15'  }, { key: 'hostel_16', label: 'Hostel 16' },
  { key: 'hostel_17',  label: 'Hostel 17'  }, { key: 'hostel_18', label: 'Hostel 18' },
  { key: 'hostel_19',  label: 'Hostel 19'  }, { key: 'hostel_21', label: 'Hostel 21' },
  { key: 'tansa_house', label: 'Tansa House' },
];

export default function Profile() {
  const { user, logout, updateUser } = useAuth();

  /* ---------- profile edit state ---------- */
  const [prof, setProf] = useState({
    full_name:    user?.full_name    || '',
    email:        user?.email        || '',
    phone_number: user?.phone_number || '',
    roll_number:  user?.roll_number  || '',
    hostel:       user?.hostel       || '',
    room_number:  user?.room_number  || '',
  });
  const [profErr,  setProfErr]  = useState('');
  const [profOk,   setProfOk]   = useState('');
  const [profBusy, setProfBusy] = useState(false);
  const [editing,  setEditing]  = useState(false);

  /* ---------- password change state ---------- */
  const [pw,     setPw]     = useState({ old_password: '', new_password: '', confirm: '' });
  const [pwErr,  setPwErr]  = useState('');
  const [pwOk,   setPwOk]   = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  /* ---------- handlers ---------- */
  const handleProf = e => setProf(p => ({ ...p, [e.target.name]: e.target.value }));
  const handlePw   = e => setPw(p => ({ ...p, [e.target.name]: e.target.value }));

  async function submitProfile(e) {
    e.preventDefault();
    setProfErr(''); setProfOk('');
    if (!prof.full_name.trim()) return setProfErr('Full name is required.');
    if (!prof.roll_number.trim()) return setProfErr('Roll number is required.');
    setProfBusy(true);
    try {
      const updated = await updateProfile(prof);
      updateUser(updated);
      setProfOk('Profile updated successfully!');
      setEditing(false);
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.email?.[0] || data?.detail || Object.values(data || {})?.[0]?.[0] || 'Failed to update profile.';
      setProfErr(msg);
    } finally {
      setProfBusy(false);
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    setPwErr(''); setPwOk('');
    if (pw.new_password !== pw.confirm) return setPwErr('Passwords do not match.');
    if (pw.new_password.length < 8) return setPwErr('Password must be at least 8 characters.');
    setPwBusy(true);
    try {
      await changePassword({ old_password: pw.old_password, new_password: pw.new_password });
      setPwOk('Password changed successfully!');
      setPw({ old_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwErr(err.response?.data?.detail || err.response?.data?.old_password?.[0] || 'Failed to change password.');
    } finally {
      setPwBusy(false);
    }
  }

  /* ---------- render ---------- */
  return (
    <section className="content-section active">
      <SectionHeader title="My Profile" subtitle="Manage your account details and security" />

      {/* ── Avatar + summary card ─────────────────────────────── */}
      <div className="request-card" style={{ maxWidth: 560, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--iitb-blue-primary,#003D82), #0066cc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', color: '#fff', fontWeight: 700, flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0,61,130,0.25)',
          }}>
            {(user?.full_name || user?.username || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{user?.full_name || user?.username}</h3>
            <p style={{ margin: '0.1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {user?.email || <em>No email set</em>}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
              {user?.roll_number && (
                <span style={chipStyle}>🎓 {user.roll_number}</span>
              )}
              {user?.hostel && (
                <span style={chipStyle}>🏠 {user.hostel}{user?.room_number ? ` / ${user.room_number}` : ''}</span>
              )}
              {user?.phone_number && (
                <span style={chipStyle}>📞 {user.phone_number}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--iitb-blue-primary,#003D82)' }}>
              {user?.points ?? 0}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>help pts</span>
          </div>
        </div>
      </div>

      {/* ── Edit Profile ──────────────────────────────────────── */}
      <div style={{ maxWidth: 560, marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Personal Information</h3>
          {!editing && (
            <button className="btn btn-primary" style={{ padding: '0.35rem 1rem', fontSize: '0.85rem' }}
              onClick={() => { setProfErr(''); setProfOk(''); setEditing(true); }}>
              Edit
            </button>
          )}
        </div>

        {profErr && <div className="auth-error"   style={{ marginBottom: '0.75rem' }}>{profErr}</div>}
        {profOk  && <div className="auth-success" style={{ marginBottom: '0.75rem' }}>{profOk}</div>}

        {editing ? (
          <form onSubmit={submitProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Full Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input name="full_name" className="search-input" placeholder="e.g. Ravi Kumar"
                  value={prof.full_name} onChange={handleProf} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input name="email" type="email" className="search-input" placeholder="you@iitb.ac.in"
                  value={prof.email} onChange={handleProf} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input name="phone_number" className="search-input" placeholder="+91 9xxxxxxxxx"
                  value={prof.phone_number} onChange={handleProf} />
              </div>
              <div className="form-group">
                <label>Roll Number <span style={{ color: '#dc2626' }}>*</span></label>
                <input name="roll_number" className="search-input" placeholder="e.g. 21B030001"
                  value={prof.roll_number} onChange={handleProf} required />
              </div>
              <div className="form-group">
                <label>Hostel</label>
                <select name="hostel" className="search-input" value={prof.hostel} onChange={handleProf}>
                  {HOSTEL_OPTIONS.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Room Number</label>
                <input name="room_number" className="search-input" placeholder="e.g. 101"
                  value={prof.room_number} onChange={handleProf} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={profBusy}>
                {profBusy ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" className="btn" disabled={profBusy}
                onClick={() => {
                  setEditing(false);
                  setProfErr(''); setProfOk('');
                  setProf({
                    full_name:    user?.full_name    || '',
                    email:        user?.email        || '',
                    phone_number: user?.phone_number || '',
                    roll_number:  user?.roll_number  || '',
                    hostel:       user?.hostel       || '',
                    room_number:  user?.room_number  || '',
                  });
                }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="request-card" style={{ padding: '1rem 1.25rem' }}>
            <InfoRow label="Full Name"    value={user?.full_name    || <em style={{ color: 'var(--text-secondary)' }}>Not set</em>} />
            <InfoRow label="Email"        value={user?.email        || <em style={{ color: 'var(--text-secondary)' }}>Not set</em>} />
            <InfoRow label="Phone"        value={user?.phone_number || <em style={{ color: 'var(--text-secondary)' }}>Not set</em>} />
            <InfoRow label="Roll Number"  value={user?.roll_number  || <em style={{ color: 'var(--text-secondary)' }}>Not set</em>} />
            <InfoRow label="Hostel"       value={user?.hostel       || <em style={{ color: 'var(--text-secondary)' }}>Not set</em>} />
            <InfoRow label="Room Number"  value={user?.room_number  || <em style={{ color: 'var(--text-secondary)' }}>Not set</em>} last />
          </div>
        )}
      </div>

      {/* ── Change Password ───────────────────────────────────── */}
      <div style={{ maxWidth: 560 }}>
        <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>

        {pwErr && <div className="auth-error"   style={{ marginBottom: '0.75rem' }}>{pwErr}</div>}
        {pwOk  && <div className="auth-success" style={{ marginBottom: '0.75rem' }}>{pwOk}</div>}

        <form onSubmit={submitPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Current Password</label>
            <input name="old_password" type="password" className="search-input"
              placeholder="Your current password" value={pw.old_password} onChange={handlePw} required />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input name="new_password" type="password" className="search-input"
              placeholder="Min. 8 characters" value={pw.new_password} onChange={handlePw} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input name="confirm" type="password" className="search-input"
              placeholder="Re-enter new password" value={pw.confirm} onChange={handlePw} required />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary" disabled={pwBusy}>
              {pwBusy ? 'Saving…' : 'Update Password'}
            </button>
            <button type="button" className="btn" onClick={logout}
              style={{ color: '#dc2626', border: '1px solid #fca5a5', marginLeft: 'auto' }}>
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

/* ── Small helpers ────────────────────────────────────────────────── */
const chipStyle = {
  fontSize: '0.75rem',
  background: 'var(--bg-secondary, #f0f4fa)',
  color: 'var(--text-secondary)',
  padding: '0.15rem 0.55rem',
  borderRadius: 999,
  whiteSpace: 'nowrap',
};

function InfoRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.55rem 0',
      borderBottom: last ? 'none' : '1px solid var(--border-color, #e5e7eb)',
      gap: '0.5rem',
    }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
