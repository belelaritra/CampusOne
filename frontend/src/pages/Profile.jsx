import { useState, useRef } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api';
import keycloak from '../keycloak';

const HOSTEL_OPTIONS = [
  { key: '',       label: '— Select hostel —' },
  { key: 'H1',     label: 'Hostel 1'   }, { key: 'H2',  label: 'Hostel 2'  },
  { key: 'H3',     label: 'Hostel 3'   }, { key: 'H4',  label: 'Hostel 4'  },
  { key: 'H5',     label: 'Hostel 5'   }, { key: 'H6',  label: 'Hostel 6'  },
  { key: 'H7',     label: 'Hostel 7'   }, { key: 'H8',  label: 'Hostel 8'  },
  { key: 'H9',     label: 'Hostel 9'   }, { key: 'H10', label: 'Hostel 10' },
  { key: 'H11',    label: 'Hostel 11'  }, { key: 'H12', label: 'Hostel 12' },
  { key: 'H13',    label: 'Hostel 13'  }, { key: 'H14', label: 'Hostel 14' },
  { key: 'H15',    label: 'Hostel 15'  }, { key: 'H16', label: 'Hostel 16' },
  { key: 'H17',    label: 'Hostel 17'  }, { key: 'H18', label: 'Hostel 18' },
  { key: 'H19',    label: 'Hostel 19'  }, { key: 'H21', label: 'Hostel 21' },
  { key: 'Tansa',  label: 'Tansa House' },
];

const DEGREE_OPTIONS = [
  { key: '',      label: '— Select degree —' },
  { key: 'BTech', label: 'B.Tech' },
  { key: 'MTech', label: 'M.Tech' },
  { key: 'MS',    label: 'M.S. (Research)' },
  { key: 'MSc',   label: 'M.Sc' },
  { key: 'PhD',   label: 'Ph.D' },
  { key: 'Other', label: 'Other' },
];

const HOSTEL_LABEL = Object.fromEntries(HOSTEL_OPTIONS.filter(h => h.key).map(h => [h.key, h.label]));

function ordinal(n) {
  if (!n) return null;
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]) + ' Year';
}

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const photoInputRef = useRef(null);

  /* ---------- profile edit state ---------- */
  const [prof, setProf] = useState({
    full_name:    user?.full_name    || '',
    email:        user?.email        || '',
    phone_number: user?.phone_number || '',
    roll_number:  user?.roll_number  || '',
    hostel:       user?.hostel       || '',
    room_number:  user?.room_number  || '',
    degree:       user?.degree       || '',
    course:       user?.course       || '',
    year_of_study: user?.year_of_study || '',
  });
  const [photoFile,  setPhotoFile]  = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photo_url || null);
  const [profErr,  setProfErr]  = useState('');
  const [profOk,   setProfOk]   = useState('');
  const [profBusy, setProfBusy] = useState(false);
  const [editing,  setEditing]  = useState(false);


  /* ---------- handlers ---------- */
  const handleProf = e => setProf(p => ({ ...p, [e.target.name]: e.target.value }));

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function submitProfile(e) {
    e.preventDefault();
    setProfErr(''); setProfOk('');
    if (!prof.full_name.trim()) return setProfErr('Full name is required.');
    if (!prof.roll_number.trim()) return setProfErr('Roll number is required.');
    setProfBusy(true);
    try {
      // Use FormData so photo (binary) can be sent alongside text fields
      const fd = new FormData();
      Object.entries(prof).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) fd.append(k, v);
      });
      if (photoFile) fd.append('photo', photoFile);

      const { data } = await api.patch('/auth/me/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(data);
      setProfOk('Profile updated successfully!');
      setEditing(false);
      setPhotoFile(null);
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.email?.[0] || data?.detail || Object.values(data || {})?.[0]?.[0] || 'Failed to update profile.';
      setProfErr(msg);
    } finally {
      setProfBusy(false);
    }
  }

  /* ---------- avatar ---------- */
  const avatarUrl = photoPreview || user?.photo_url;
  const avatarInitial = (user?.full_name || user?.username || '?')[0].toUpperCase();

  /* ---------- render ---------- */
  return (
    <section className="content-section active">
      <SectionHeader title="My Profile" subtitle="Manage your account details and security" />

      {/* ── Avatar + summary card ─────────────────────────────── */}
      <div className="request-card" style={{ maxWidth: 560, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="profile"
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover',
                    border: '2px solid var(--iitb-blue-primary,#003D82)',
                    boxShadow: '0 4px 12px rgba(0,61,130,0.25)' }} />
              : <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--iitb-blue-primary,#003D82), #0066cc)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.6rem', color: '#fff', fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,61,130,0.25)',
                }}>{avatarInitial}</div>
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{user?.full_name || user?.username}</h3>
            <p style={{ margin: '0.1rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {user?.email || <em>No email set</em>}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              {user?.roll_number  && <span style={chipStyle}>🎓 {user.roll_number}</span>}
              {user?.degree       && <span style={chipStyle}>{user.degree}</span>}
              {user?.course       && <span style={chipStyle}>📚 {user.course}</span>}
              {user?.year_of_study && <span style={chipStyle}>{ordinal(user.year_of_study)}</span>}
              {user?.hostel       && <span style={chipStyle}>🏠 {HOSTEL_LABEL[user.hostel] || user.hostel}{user?.room_number ? ` / ${user.room_number}` : ''}</span>}
              {user?.phone_number && <span style={chipStyle}>📞 {user.phone_number}</span>}
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
              onClick={() => {
                setProfErr(''); setProfOk('');
                setProf({
                  full_name:    user?.full_name    || '',
                  email:        user?.email        || '',
                  phone_number: user?.phone_number || '',
                  roll_number:  user?.roll_number  || '',
                  hostel:       user?.hostel       || '',
                  room_number:  user?.room_number  || '',
                  degree:       user?.degree       || '',
                  course:       user?.course       || '',
                  year_of_study: user?.year_of_study || '',
                });
                setPhotoPreview(user?.photo_url || null);
                setPhotoFile(null);
                setEditing(true);
              }}>
              Edit
            </button>
          )}
        </div>

        {profErr && <div className="auth-error"   style={{ marginBottom: '0.75rem' }}>{profErr}</div>}
        {profOk  && <div className="auth-success" style={{ marginBottom: '0.75rem' }}>{profOk}</div>}

        {editing ? (
          <form onSubmit={submitProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Photo upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {photoPreview || user?.photo_url
                ? <img src={photoPreview || user?.photo_url} alt="preview"
                    style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                      border: '2px solid var(--iitb-blue-primary,#003D82)' }} />
                : <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--iitb-blue-primary,#003D82), #0066cc)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', color: '#fff', fontWeight: 700,
                  }}>{avatarInitial}</div>
              }
              <div>
                <input type="file" accept="image/*" ref={photoInputRef} style={{ display: 'none' }}
                  onChange={handlePhotoChange} />
                <button type="button" className="btn" style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}
                  onClick={() => photoInputRef.current.click()}>
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </button>
                {photoFile && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{photoFile.name}</span>}
              </div>
            </div>

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
                <label>Degree</label>
                <select name="degree" className="search-input" value={prof.degree} onChange={handleProf}>
                  {DEGREE_OPTIONS.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Course / Branch</label>
                <input name="course" className="search-input" placeholder="e.g. Computer Science and Engineering"
                  value={prof.course} onChange={handleProf} />
              </div>
              <div className="form-group">
                <label>Year of Study</label>
                <select name="year_of_study" className="search-input" value={prof.year_of_study} onChange={handleProf}>
                  <option value="">— Select year —</option>
                  {[1,2,3,4,5,6].map(y => <option key={y} value={y}>{y}{['st','nd','rd','th','th','th'][y-1]} Year</option>)}
                </select>
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
                onClick={() => { setEditing(false); setProfErr(''); setProfOk(''); }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="request-card" style={{ padding: '1rem 1.25rem' }}>
            <InfoRow label="Full Name"    value={user?.full_name    || <em style={emStyle}>Not set</em>} />
            <InfoRow label="Email"        value={user?.email        || <em style={emStyle}>Not set</em>} />
            <InfoRow label="Phone"        value={user?.phone_number || <em style={emStyle}>Not set</em>} />
            <InfoRow label="Roll Number"  value={user?.roll_number  || <em style={emStyle}>Not set</em>} />
            <InfoRow label="Degree"       value={DEGREE_OPTIONS.find(d => d.key === user?.degree)?.label || <em style={emStyle}>Not set</em>} />
            <InfoRow label="Course"       value={user?.course       || <em style={emStyle}>Not set</em>} />
            <InfoRow label="Year"         value={user?.year_of_study ? ordinal(user.year_of_study) : <em style={emStyle}>Not set</em>} />
            <InfoRow label="Hostel"       value={HOSTEL_LABEL[user?.hostel] || user?.hostel || <em style={emStyle}>Not set</em>} />
            <InfoRow label="Room Number"  value={user?.room_number  || <em style={emStyle}>Not set</em>} last />
          </div>
        )}
      </div>

      {/* ── Account Security ──────────────────────────────────── */}
      <div style={{ maxWidth: 560 }}>
        <h3 style={{ marginBottom: '1rem' }}>Account Security</h3>
        <div className="request-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Passwords and security settings are managed through the CampusOne identity portal.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => keycloak.login({ action: 'UPDATE_PASSWORD' })}
            >
              Change Password
            </button>
            <button
              type="button" className="btn"
              onClick={logout}
              style={{ color: '#dc2626', border: '1px solid #fca5a5' }}
            >
              Sign Out
            </button>
          </div>
        </div>
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

const emStyle = { color: 'var(--text-secondary)' };

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
