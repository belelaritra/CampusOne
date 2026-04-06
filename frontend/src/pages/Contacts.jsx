import { useState, useEffect, useCallback, useRef } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getFaculty, createFaculty, updateFaculty, deleteFaculty, toggleFacultyAvail,
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getEmergencyContacts, createEmergencyContact, updateEmergencyContact, deleteEmergencyContact,
} from '../services/api.js';

// ─── tiny shared helpers ────────────────────────────────────────────────────

const TABS = ['Faculty', 'Departments', 'Emergency'];

function pill(color, label) {
  const map = {
    green:  { bg:'#dcfce7', color:'#15803d', border:'#86efac' },
    red:    { bg:'#fee2e2', color:'#b91c1c', border:'#fca5a5' },
    blue:   { bg:'#dbeafe', color:'#1d4ed8', border:'#93c5fd' },
    gray:   { bg:'#f3f4f6', color:'#374151', border:'#e5e7eb' },
  };
  const s = map[color] || map.gray;
  return (
    <span style={{
      fontSize:'0.7rem', fontWeight:700, padding:'0.18rem 0.6rem',
      borderRadius:999, background:s.bg, color:s.color, border:`1px solid ${s.border}`,
      textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap',
    }}>{label}</span>
  );
}

function Avatar({ src, name, size = 44 }) {
  const init = (name || '?')[0].toUpperCase();
  return src
    ? <img src={src} alt={name}
        style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover',
          border:'2px solid rgba(0,61,130,0.15)', flexShrink:0 }} />
    : <div style={{
        width:size, height:size, borderRadius:'50%', flexShrink:0,
        background:'linear-gradient(135deg,#003D82,#0066cc)',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#fff', fontWeight:700, fontSize: size * 0.38,
      }}>{init}</div>;
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <input className="search-input"
      style={{ width:'100%', marginBottom:'1rem' }}
      placeholder={placeholder || 'Search…'}
      value={value}
      onChange={e => onChange(e.target.value)} />
  );
}

function ModalWrap({ onClose, title, children }) {
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:1000, padding:'1rem',
    }}>
      <div style={{
        background:'#fff', borderRadius:14, padding:'1.75rem',
        width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 16px 48px rgba(0,0,0,0.22)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h3 style={{ margin:0, fontSize:'1rem', color:'var(--iitb-blue-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.4rem', lineHeight:1, color:'var(--text-secondary)' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FG({ label, children, required }) {
  return (
    <div className="form-group" style={{ margin:0 }}>
      <label style={{ fontSize:'0.82rem' }}>{label}{required && <span style={{ color:'#dc2626' }}> *</span>}</label>
      {children}
    </div>
  );
}

function Err({ msg }) {
  return msg ? <div className="auth-error" style={{ marginBottom:'0.75rem' }}>{msg}</div> : null;
}

// ─── FACULTY TAB ────────────────────────────────────────────────────────────

function FacultyTab({ isAdmin }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [modal,   setModal]   = useState(null); // null | { mode:'add'|'edit', data? }
  const [err,     setErr]     = useState('');

  const depts = [...new Set(list.map(f => f.department))].sort();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q)           params.q     = q;
      if (deptFilter)  params.dept  = deptFilter;
      if (availFilter) params.available = availFilter;
      setList(await getFaculty(params));
    } catch { setErr('Failed to load faculty.'); }
    finally { setLoading(false); }
  }, [q, deptFilter, availFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this faculty entry?')) return;
    try { await deleteFaculty(id); load(); } catch { setErr('Delete failed.'); }
  }

  async function handleToggle(id) {
    try { const updated = await toggleFacultyAvail(id); setList(prev => prev.map(f => f.id === id ? updated : f)); }
    catch { setErr('Failed to update.'); }
  }

  return (
    <div>
      {err && <Err msg={err} />}

      {/* Search + Filters row */}
      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'1rem', alignItems:'center' }}>
        <input className="search-input" placeholder="Search name, dept, specialization…"
          value={q} onChange={e => setQ(e.target.value)}
          style={{ flex:1, minWidth:200 }} />
        <select className="search-input" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ minWidth:160 }}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="search-input" value={availFilter} onChange={e => setAvailFilter(e.target.value)}
          style={{ minWidth:150 }}>
          <option value="">All Status</option>
          <option value="true">Available</option>
          <option value="false">On Leave</option>
        </select>
        {isAdmin && (
          <button className="btn btn-primary" style={{ whiteSpace:'nowrap' }}
            onClick={() => setModal({ mode:'add' })}>
            + Add Faculty
          </button>
        )}
      </div>

      {loading
        ? <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>Loading…</p>
        : list.length === 0
          ? <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>No faculty found.</p>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
              {list.map(f => (
                <div key={f.id} className="request-card" style={{ display:'flex', gap:'1rem', alignItems:'flex-start' }}>
                  <Avatar src={f.photo_url} name={f.name} size={52} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--iitb-blue-primary)', marginBottom:'0.1rem' }}>{f.name}</div>
                    <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'0.35rem' }}>{f.department}</div>
                    {f.specialization && <div style={{ fontSize:'0.78rem', color:'var(--text-primary)', marginBottom:'0.25rem' }}>📌 {f.specialization}</div>}
                    {f.cabin_no       && <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>🚪 Cabin: {f.cabin_no}</div>}
                    {f.email          && <a href={`mailto:${f.email}`} style={{ fontSize:'0.78rem', color:'var(--iitb-blue-light)', display:'block', marginTop:'0.2rem' }}>✉️ {f.email}</a>}
                    <div style={{ marginTop:'0.5rem', display:'flex', gap:'0.4rem', alignItems:'center', flexWrap:'wrap' }}>
                      {pill(f.is_available ? 'green' : 'red', f.is_available ? 'Available' : 'On Leave')}
                      {isAdmin && (
                        <>
                          <button className="btn" style={{ fontSize:'0.72rem', padding:'0.15rem 0.5rem' }}
                            onClick={() => handleToggle(f.id)}>
                            {f.is_available ? 'Mark Leave' : 'Mark Available'}
                          </button>
                          <button className="btn" style={{ fontSize:'0.72rem', padding:'0.15rem 0.5rem' }}
                            onClick={() => setModal({ mode:'edit', data:f })}>Edit</button>
                          <button className="btn" style={{ fontSize:'0.72rem', padding:'0.15rem 0.5rem', color:'#dc2626', border:'1px solid #fca5a5' }}
                            onClick={() => handleDelete(f.id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
      }

      {modal && (
        <FacultyModal
          mode={modal.mode}
          initial={modal.data}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function FacultyModal({ mode, initial, onClose, onSaved }) {
  const photoRef = useRef(null);
  const [form, setForm] = useState({
    name:          initial?.name           || '',
    department:    initial?.department     || '',
    specialization:initial?.specialization || '',
    email:         initial?.email          || '',
    cabin_no:      initial?.cabin_no       || '',
    is_available:  initial?.is_available   ?? true,
  });
  const [photoFile, setPhotoFile]   = useState(null);
  const [photoPreview, setPreview]  = useState(initial?.photo_url || null);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.department.trim()) return setErr('Name and Department are required.');
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (photoFile) fd.append('photo', photoFile);
      if (mode === 'add') await createFaculty(fd);
      else                await updateFaculty(initial.id, fd);
      onSaved();
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Save failed.');
    } finally { setBusy(false); }
  }

  return (
    <ModalWrap title={mode === 'add' ? 'Add Faculty' : 'Edit Faculty'} onClose={onClose}>
      <Err msg={err} />
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
        {/* Photo */}
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <Avatar src={photoPreview} name={form.name || '?'} size={52} />
          <div>
            <input type="file" accept="image/*" ref={photoRef} style={{ display:'none' }}
              onChange={e => { const f = e.target.files[0]; if (f) { setPhotoFile(f); setPreview(URL.createObjectURL(f)); } }} />
            <button type="button" className="btn" style={{ fontSize:'0.8rem' }}
              onClick={() => photoRef.current.click()}>
              {photoPreview ? 'Change Photo' : 'Upload Photo'}
            </button>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.9rem' }}>
          <FG label="Name" required><input name="name" className="search-input" value={form.name} onChange={set} /></FG>
          <FG label="Department" required><input name="department" className="search-input" value={form.department} onChange={set} /></FG>
          <FG label="Specialization" ><input name="specialization" className="search-input" value={form.specialization} onChange={set} /></FG>
          <FG label="Email"          ><input name="email" type="email" className="search-input" value={form.email} onChange={set} /></FG>
          <FG label="Cabin No."      ><input name="cabin_no" className="search-input" value={form.cabin_no} onChange={set} /></FG>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.875rem', cursor:'pointer' }}>
          <input type="checkbox" name="is_available" checked={form.is_available} onChange={set} />
          Currently Available (uncheck = On Leave)
        </label>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </ModalWrap>
  );
}

// ─── DEPARTMENTS TAB ─────────────────────────────────────────────────────────

function DepartmentsTab({ isAdmin }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState('');
  const [modal,   setModal]   = useState(null);
  const [err,     setErr]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await getDepartments(q ? { q } : {})); }
    catch { setErr('Failed to load departments.'); }
    finally { setLoading(false); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this department?')) return;
    try { await deleteDepartment(id); load(); } catch { setErr('Delete failed.'); }
  }

  return (
    <div>
      {err && <Err msg={err} />}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <input className="search-input" placeholder="Search departments…"
          value={q} onChange={e => setQ(e.target.value)} style={{ flex:1, minWidth:200 }} />
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal({ mode:'add' })}>+ Add Department</button>
        )}
      </div>

      {loading
        ? <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>Loading…</p>
        : list.length === 0
          ? <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>No departments found.</p>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'1rem' }}>
              {list.map(d => (
                <div key={d.id} className="request-card" style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', textAlign:'center',
                  padding:'1.5rem 1rem', gap:'0.5rem', aspectRatio:'1 / 1',
                }}>
                  <div style={{
                    width:52, height:52, borderRadius:12, flexShrink:0,
                    background:'linear-gradient(135deg,#dbeafe,#93c5fd)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'1.6rem', boxShadow:'0 2px 8px rgba(29,78,216,0.15)',
                  }}>🏛️</div>
                  <div style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--iitb-blue-primary)', lineHeight:1.3 }}>
                    {d.name}
                  </div>
                  {d.location && (
                    <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>📍 {d.location}</div>
                  )}
                  {d.official_contact && (
                    <div style={{ fontSize:'0.8rem', color:'var(--text-primary)' }}>📞 {d.official_contact}</div>
                  )}
                  {d.official_email && (
                    <a href={`mailto:${d.official_email}`}
                      style={{ fontSize:'0.75rem', color:'var(--iitb-blue-light)', wordBreak:'break-all' }}>
                      ✉️ {d.official_email}
                    </a>
                  )}
                  <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', justifyContent:'center', marginTop:'0.25rem' }}>
                    {d.maps_url && (
                      <a href={d.maps_url} target="_blank" rel="noreferrer"
                        style={{
                          display:'inline-flex', alignItems:'center', gap:'0.25rem',
                          fontSize:'0.72rem', padding:'0.2rem 0.6rem',
                          borderRadius:999, background:'#dcfce7', color:'#15803d',
                          border:'1px solid #86efac', textDecoration:'none', fontWeight:600,
                        }}>
                        🗺️ Maps
                      </a>
                    )}
                    {isAdmin && (
                      <>
                        <button className="btn" style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem' }}
                          onClick={() => setModal({ mode:'edit', data:d })}>Edit</button>
                        <button className="btn" style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', color:'#dc2626', border:'1px solid #fca5a5' }}
                          onClick={() => handleDelete(d.id)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
      }
      {modal && (
        <DeptModal mode={modal.mode} initial={modal.data}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function DeptModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:             initial?.name             || '',
    official_contact: initial?.official_contact || '',
    official_email:   initial?.official_email   || '',
    location:         initial?.location         || '',
    maps_url:         initial?.maps_url         || '',
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setErr('Department name is required.');
    setBusy(true); setErr('');
    try {
      if (mode === 'add') await createDepartment(form);
      else                await updateDepartment(initial.id, form);
      onSaved();
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Save failed.');
    } finally { setBusy(false); }
  }

  return (
    <ModalWrap title={mode === 'add' ? 'Add Department' : 'Edit Department'} onClose={onClose}>
      <Err msg={err} />
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
        <FG label="Department Name" required><input name="name" className="search-input" value={form.name} onChange={set} /></FG>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.9rem' }}>
          <FG label="Official Contact"><input name="official_contact" className="search-input" value={form.official_contact} onChange={set} /></FG>
          <FG label="Official Email"><input name="official_email" type="email" className="search-input" value={form.official_email} onChange={set} /></FG>
          <FG label="Location (building/room)"><input name="location" className="search-input" placeholder="e.g. KR Building, 2nd Floor" value={form.location} onChange={set} /></FG>
          <FG label="Google Maps URL"><input name="maps_url" type="url" className="search-input" placeholder="https://maps.google.com/..." value={form.maps_url} onChange={set} /></FG>
        </div>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </ModalWrap>
  );
}

// ─── EMERGENCY TAB ───────────────────────────────────────────────────────────

function EmergencyTab({ isAdmin }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState('');
  const [modal,   setModal]   = useState(null);
  const [err,     setErr]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await getEmergencyContacts(q ? { q } : {})); }
    catch { setErr('Failed to load emergency contacts.'); }
    finally { setLoading(false); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this emergency contact?')) return;
    try { await deleteEmergencyContact(id); load(); } catch { setErr('Delete failed.'); }
  }

  return (
    <div>
      {err && <Err msg={err} />}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <input className="search-input" placeholder="Search services…"
          value={q} onChange={e => setQ(e.target.value)} style={{ flex:1, minWidth:200 }} />
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal({ mode:'add' })}>+ Add Emergency Contact</button>
        )}
      </div>

      {loading
        ? <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>Loading…</p>
        : list.length === 0
          ? <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>No emergency contacts found.</p>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'1rem' }}>
              {list.map(ec => (
                <div key={ec.id} className="request-card" style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', textAlign:'center',
                  padding:'1.5rem 1rem', gap:'0.6rem', aspectRatio:'1 / 1',
                }}>
                  <div style={{
                    width:52, height:52, borderRadius:12, flexShrink:0,
                    background:'linear-gradient(135deg,#fee2e2,#fca5a5)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'1.6rem', boxShadow:'0 2px 8px rgba(220,38,38,0.18)',
                  }}>🚨</div>
                  <div style={{ fontWeight:700, fontSize:'0.92rem', color:'var(--iitb-blue-primary)', lineHeight:1.3 }}>
                    {ec.service_name}
                  </div>
                  <a href={`tel:${ec.contact}`}
                    style={{ fontFamily:'monospace', fontSize:'0.9rem', color:'#dc2626', fontWeight:700, textDecoration:'none' }}>
                    {ec.contact}
                  </a>
                  {isAdmin && (
                    <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.25rem' }}>
                      <button className="btn" style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem' }}
                        onClick={() => setModal({ mode:'edit', data:ec })}>Edit</button>
                      <button className="btn" style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', color:'#dc2626', border:'1px solid #fca5a5' }}
                        onClick={() => handleDelete(ec.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
      }
      {modal && (
        <EmergencyModal mode={modal.mode} initial={modal.data}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function EmergencyModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    service_name: initial?.service_name || '',
    contact:      initial?.contact      || '',
    order:        initial?.order        ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.service_name.trim() || !form.contact.trim()) return setErr('Service name and contact are required.');
    setBusy(true); setErr('');
    try {
      if (mode === 'add') await createEmergencyContact(form);
      else                await updateEmergencyContact(initial.id, form);
      onSaved();
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Save failed.');
    } finally { setBusy(false); }
  }

  return (
    <ModalWrap title={mode === 'add' ? 'Add Emergency Contact' : 'Edit Emergency Contact'} onClose={onClose}>
      <Err msg={err} />
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
        <FG label="Service Name" required>
          <input name="service_name" className="search-input"
            placeholder="e.g. Hospital, QRT, Fire, PWC"
            value={form.service_name} onChange={set} />
        </FG>
        <FG label="Contact Number" required>
          <input name="contact" className="search-input"
            placeholder="e.g. 022-2576-7777"
            value={form.contact} onChange={set} />
        </FG>
        <FG label="Display Order (lower = first)">
          <input name="order" type="number" min="0" className="search-input"
            value={form.order} onChange={set} />
        </FG>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </ModalWrap>
  );
}

// ─── PAGE ROOT ───────────────────────────────────────────────────────────────

export default function Contacts() {
  const { user }  = useAuth();
  const isAdmin   = user?.is_staff || false;
  const [tab, setTab] = useState('Faculty');

  return (
    <section className="content-section active">
      <SectionHeader
        title="Contacts"
        subtitle="Faculty, department, and emergency contacts"
      />

      {isAdmin && (
        <div style={{
          display:'inline-flex', alignItems:'center', gap:'0.4rem',
          background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a',
          borderRadius:999, padding:'0.3rem 0.9rem', fontSize:'0.78rem',
          fontWeight:600, marginBottom:'1rem',
        }}>
          🔑 Admin mode — you can add, edit and delete entries
        </div>
      )}

      {/* Tab navigation */}
      <div className="tab-navigation" style={{ marginBottom:'1.5rem' }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}>
            {t === 'Faculty'     && '👨‍🏫 Faculty'}
            {t === 'Departments' && '🏛️ Departments'}
            {t === 'Emergency'   && '🚨 Emergency'}
          </button>
        ))}
      </div>

      {tab === 'Faculty'     && <FacultyTab     isAdmin={isAdmin} />}
      {tab === 'Departments' && <DepartmentsTab isAdmin={isAdmin} />}
      {tab === 'Emergency'   && <EmergencyTab   isAdmin={isAdmin} />}
    </section>
  );
}
