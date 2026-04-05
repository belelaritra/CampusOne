import { useState, useEffect, useCallback } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getConsoleStats,
  getConsoleUsers, updateConsoleUser,
  getConsoleMenus, deleteConsoleMenu,
  getConsoleCoupons, deleteConsoleCoupon,
  getConsoleRebates, reviewConsoleRebate, deleteConsoleRebate,
  getConsoleSettings, updateConsoleSetting,
} from '../services/api';

const TABS = ['Overview', 'Users', 'Menus', 'Coupons', 'Rebates', 'Settings'];

/* ── small helpers ────────────────────────────────────────────────── */
function Pill({ label, color }) {
  const palette = {
    green:  { bg: '#dcfce7', color: '#15803d' },
    red:    { bg: '#fee2e2', color: '#b91c1c' },
    yellow: { bg: '#fef9c3', color: '#a16207' },
    blue:   { bg: '#dbeafe', color: '#1d4ed8' },
    gray:   { bg: '#f3f4f6', color: '#374151' },
  };
  const s = palette[color] || palette.gray;
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem',
      borderRadius: 999, background: s.bg, color: s.color,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{label}</span>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--iitb-blue-primary,#003D82)' }}>{value}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
}

function ConfirmBtn({ onConfirm, children, danger, disabled }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) return (
    <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem', color: '#dc2626', border: '1px solid #fca5a5' }}
        onClick={() => { setConfirming(false); onConfirm(); }}>Yes</button>
      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
        onClick={() => setConfirming(false)}>No</button>
    </span>
  );
  return (
    <button className="btn" disabled={disabled}
      style={{ padding: '0.2rem 0.7rem', fontSize: '0.78rem', ...(danger ? { color: '#dc2626', border: '1px solid #fca5a5' } : {}) }}
      onClick={() => setConfirming(true)}>
      {children}
    </button>
  );
}

/* ── Tab: Overview ────────────────────────────────────────────────── */
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [err, setErr]     = useState('');

  useEffect(() => {
    getConsoleStats()
      .then(setStats)
      .catch(() => setErr('Failed to load stats.'));
  }, []);

  if (err) return <p style={{ color: '#dc2626' }}>{err}</p>;
  if (!stats) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard icon="👥" label="Total Users"       value={stats.total_users}       sub={`${stats.staff_users} staff`} />
        <StatCard icon="🏠" label="Mess Admins"       value={stats.mess_admins}       />
        <StatCard icon="🍽️" label="Menu Entries"      value={stats.total_menus}       sub="all time" />
        <StatCard icon="🎟️" label="Guest Coupons"     value={stats.total_coupons}     sub="issued" />
        <StatCard icon="📋" label="Rebate Requests"   value={stats.total_rebates}     sub={`${stats.pending_rebates} pending`} />
        <StatCard icon="🍕" label="Food Orders"       value={stats.total_food_orders} sub="all time" />
        <StatCard icon="🤝" label="Help Requests"     value={stats.total_help}        />
        <StatCard icon="🔍" label="L&F Items"         value={stats.total_lf}          />
      </div>

      <div className="request-card">
        <h4 style={{ marginTop: 0 }}>System Status</h4>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Sessions</span>
            <div style={{ fontWeight: 700 }}>{stats.active_sessions ?? '—'}</div></div>
          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Outlet Admins</span>
            <div style={{ fontWeight: 700 }}>{stats.outlet_admins ?? '—'}</div></div>
          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Approved Rebates</span>
            <div style={{ fontWeight: 700 }}>{stats.approved_rebates ?? '—'}</div></div>
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Users ───────────────────────────────────────────────────── */
// User.hostel — free-text field, human-readable labels
const USER_HOSTEL_OPTIONS = [
  '', 'H1','H2','H3','H4','H5','H6','H7','H8',
  'H9','H10','H11','H12','H13','H14','H15','H16',
  'Tansa','Natraj','GH1','GH2',
];

// MessAdminProfile.hostel / MessHostelSettings.hostel — must match backend MESS_HOSTEL_KEYS
const MESS_HOSTEL_OPTIONS = [
  { key: '',          label: '— Not a mess admin —' },
  { key: 'hostel_1',  label: 'Hostel 1'  }, { key: 'hostel_2',  label: 'Hostel 2'  },
  { key: 'hostel_3',  label: 'Hostel 3'  }, { key: 'hostel_4',  label: 'Hostel 4'  },
  { key: 'hostel_5',  label: 'Hostel 5'  }, { key: 'hostel_6',  label: 'Hostel 6'  },
  { key: 'hostel_7',  label: 'Hostel 7'  }, { key: 'hostel_8',  label: 'Hostel 8'  },
  { key: 'hostel_9',  label: 'Hostel 9'  }, { key: 'hostel_10', label: 'Hostel 10' },
  { key: 'hostel_11', label: 'Hostel 11' }, { key: 'hostel_12', label: 'Hostel 12' },
  { key: 'hostel_13', label: 'Hostel 13' }, { key: 'hostel_14', label: 'Hostel 14' },
  { key: 'hostel_15', label: 'Hostel 15' }, { key: 'hostel_16', label: 'Hostel 16' },
  { key: 'hostel_17', label: 'Hostel 17' }, { key: 'hostel_18', label: 'Hostel 18' },
  { key: 'hostel_19', label: 'Hostel 19' }, { key: 'hostel_21', label: 'Hostel 21' },
  { key: 'tansa_house', label: 'Tansa House' },
];

function UsersTab() {
  const [users,   setUsers]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [err,     setErr]     = useState('');
  const [editing, setEditing] = useState(null);   // user object being edited
  const [form,    setForm]    = useState({});
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const load = useCallback(() => {
    const params = search ? { search } : {};
    getConsoleUsers(params).then(data => setUsers(Array.isArray(data) ? data : data.results ?? [])).catch(() => setErr('Failed to load users.'));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function startEdit(u) {
    setEditing(u);
    setForm({
      full_name:        u.full_name        || '',
      email:            u.email            || '',
      phone_number:     u.phone_number     || '',
      roll_number:      u.roll_number      || '',
      hostel:           u.hostel           || '',
      room_number:      u.room_number      || '',
      is_staff:         u.is_staff         || false,
      mess_admin_hostel: u.mess_admin_hostel || '',
    });
    setSaveErr('');
  }

  async function saveUser(e) {
    e.preventDefault();
    setSaving(true); setSaveErr('');
    try {
      const updated = await updateConsoleUser(editing.id, form);
      setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...updated } : u));
      setEditing(null);
    } catch (err) {
      const data = err.response?.data;
      setSaveErr(data?.detail || data?.email?.[0] || Object.values(data || {})?.[0]?.[0] || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input className="search-input" placeholder="Search by name / username / roll…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-primary" onClick={load}>Search</button>
      </div>

      {err && <p style={{ color: '#dc2626' }}>{err}</p>}

      {/* Edit modal */}
      {editing && (
        <div style={MODAL_BG}>
          <div style={MODAL_BOX}>
            <h3 style={{ marginTop: 0 }}>Edit User: {editing.username}</h3>
            {saveErr && <div className="auth-error" style={{ marginBottom: '0.75rem' }}>{saveErr}</div>}
            <form onSubmit={saveUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <FG label="Full Name">
                  <input className="search-input" value={form.full_name}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
                </FG>
                <FG label="Email">
                  <input type="email" className="search-input" value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </FG>
                <FG label="Phone">
                  <input className="search-input" value={form.phone_number}
                    onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} />
                </FG>
                <FG label="Roll Number">
                  <input className="search-input" value={form.roll_number}
                    onChange={e => setForm(p => ({ ...p, roll_number: e.target.value }))} />
                </FG>
                <FG label="Hostel">
                  <select className="search-input" value={form.hostel}
                    onChange={e => setForm(p => ({ ...p, hostel: e.target.value }))}>
                    {USER_HOSTEL_OPTIONS.map(h => <option key={h} value={h}>{h || '— None —'}</option>)}
                  </select>
                </FG>
                <FG label="Room Number">
                  <input className="search-input" value={form.room_number}
                    onChange={e => setForm(p => ({ ...p, room_number: e.target.value }))} />
                </FG>
                <FG label="Mess Admin Hostel" style={{ gridColumn: '1/-1' }}>
                  <select className="search-input" value={form.mess_admin_hostel}
                    onChange={e => setForm(p => ({ ...p, mess_admin_hostel: e.target.value }))}>
                    {MESS_HOSTEL_OPTIONS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </FG>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={form.is_staff}
                  onChange={e => setForm(p => ({ ...p, is_staff: e.target.checked }))} />
                Staff / Superuser
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE_STYLE}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary,#f0f4fa)' }}>
              <Th>Username</Th><Th>Name</Th><Th>Roll</Th><Th>Hostel</Th><Th>Roles</Th><Th>Joined</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color,#e5e7eb)' }}>
                <Td>{u.username}</Td>
                <Td>{u.full_name || <em style={{ color: 'var(--text-secondary)' }}>—</em>}</Td>
                <Td>{u.roll_number || '—'}</Td>
                <Td>{u.hostel || '—'}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {u.is_staff && <Pill label="Staff" color="blue" />}
                    {u.is_mess_admin && <Pill label={`Mess ${u.mess_admin_hostel}`} color="green" />}
                    {u.is_outlet_admin && <Pill label="Outlet" color="yellow" />}
                  </div>
                </Td>
                <Td>{u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}</Td>
                <Td>
                  <button className="btn btn-primary" style={{ padding: '0.2rem 0.7rem', fontSize: '0.78rem' }}
                    onClick={() => startEdit(u)}>Edit</button>
                </Td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tab: Menus ───────────────────────────────────────────────────── */
function MenusTab() {
  const [menus,  setMenus]  = useState([]);
  const [err,    setErr]    = useState('');
  const [busy,   setBusy]   = useState({});

  useEffect(() => {
    getConsoleMenus().then(data => setMenus(Array.isArray(data) ? data : data.results ?? [])).catch(() => setErr('Failed to load menus.'));
  }, []);

  async function del(id) {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await deleteConsoleMenu(id);
      setMenus(prev => prev.filter(m => m.id !== id));
    } catch { setErr('Delete failed.'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  }

  return (
    <div>
      {err && <p style={{ color: '#dc2626' }}>{err}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE_STYLE}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary,#f0f4fa)' }}>
              <Th>Hostel</Th><Th>Date</Th><Th>Meal</Th><Th>Items</Th><Th>Added By</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {menus.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color,#e5e7eb)' }}>
                <Td>{m.hostel}</Td>
                <Td>{m.date}</Td>
                <Td><Pill label={m.meal_type} color="blue" /></Td>
                <Td style={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.items || '—'}
                </Td>
                <Td>{m.created_by_username || '—'}</Td>
                <Td>
                  <ConfirmBtn danger disabled={busy[m.id]} onConfirm={() => del(m.id)}>Delete</ConfirmBtn>
                </Td>
              </tr>
            ))}
            {menus.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>No menu entries.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tab: Coupons ─────────────────────────────────────────────────── */
function CouponsTab() {
  const [coupons, setCoupons] = useState([]);
  const [err,     setErr]     = useState('');
  const [busy,    setBusy]    = useState({});

  useEffect(() => {
    getConsoleCoupons().then(data => setCoupons(Array.isArray(data) ? data : data.results ?? [])).catch(() => setErr('Failed to load coupons.'));
  }, []);

  async function del(id) {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await deleteConsoleCoupon(id);
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch { setErr('Delete failed.'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  }

  return (
    <div>
      {err && <p style={{ color: '#dc2626' }}>{err}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE_STYLE}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary,#f0f4fa)' }}>
              <Th>User</Th><Th>Hostel</Th><Th>Date</Th><Th>Meal</Th><Th>Qty</Th><Th>Total (₹)</Th><Th>Purchased</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {coupons.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color,#e5e7eb)' }}>
                <Td>{c.student_username || c.student}</Td>
                <Td>{c.hostel}</Td>
                <Td>{c.date}</Td>
                <Td><Pill label={c.meal_type} color="blue" /></Td>
                <Td>{c.quantity}</Td>
                <Td>₹{c.total_amount}</Td>
                <Td>{c.purchased_at ? new Date(c.purchased_at).toLocaleDateString() : '—'}</Td>
                <Td>
                  <ConfirmBtn danger disabled={busy[c.id]} onConfirm={() => del(c.id)}>Delete</ConfirmBtn>
                </Td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>No coupons.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tab: Rebates ─────────────────────────────────────────────────── */
function RebatesTab() {
  const [rebates, setRebates] = useState([]);
  const [err,     setErr]     = useState('');
  const [busy,    setBusy]    = useState({});

  useEffect(() => {
    getConsoleRebates().then(data => setRebates(Array.isArray(data) ? data : data.results ?? [])).catch(() => setErr('Failed to load rebates.'));
  }, []);

  async function review(id, action) {
    setBusy(p => ({ ...p, [id]: true }));
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    try {
      const updated = await reviewConsoleRebate(id, { status });
      setRebates(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    } catch { setErr('Action failed.'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  }

  async function del(id) {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await deleteConsoleRebate(id);
      setRebates(prev => prev.filter(r => r.id !== id));
    } catch { setErr('Delete failed.'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  }

  const statusColor = { PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red' };

  return (
    <div>
      {err && <p style={{ color: '#dc2626' }}>{err}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE_STYLE}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary,#f0f4fa)' }}>
              <Th>User</Th><Th>Hostel</Th><Th>From</Th><Th>To</Th><Th>Days</Th><Th>Reason</Th><Th>Status</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rebates.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color,#e5e7eb)' }}>
                <Td>{r.student_username || r.student}</Td>
                <Td>{r.hostel || '—'}</Td>
                <Td>{r.start_date}</Td>
                <Td>{r.end_date}</Td>
                <Td>{r.days}</Td>
                <Td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.reason || '—'}
                </Td>
                <Td><Pill label={r.status} color={statusColor[r.status] || 'gray'} /></Td>
                <Td>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {r.status === 'PENDING' && (
                      <>
                        <button className="btn btn-primary" disabled={busy[r.id]}
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => review(r.id, 'approve')}>Approve</button>
                        <button className="btn" disabled={busy[r.id]}
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem', color: '#dc2626', border: '1px solid #fca5a5' }}
                          onClick={() => review(r.id, 'reject')}>Reject</button>
                      </>
                    )}
                    <ConfirmBtn danger disabled={busy[r.id]} onConfirm={() => del(r.id)}>Delete</ConfirmBtn>
                  </div>
                </Td>
              </tr>
            ))}
            {rebates.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>No rebate requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tab: Settings ────────────────────────────────────────────────── */
function SettingsTab() {
  const [settings, setSettings] = useState([]);
  const [err,      setErr]      = useState('');
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState({});
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState('');
  const [saveOk,   setSaveOk]   = useState('');

  useEffect(() => {
    getConsoleSettings()
      .then(data => setSettings(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => setErr('Failed to load settings.'));
  }, []);

  function startEdit(s) {
    setEditing(s);
    setForm({
      monthly_sma:             s.monthly_sma,
      breakfast_deduction:     s.breakfast_deduction,
      lunch_deduction:         s.lunch_deduction,
      snacks_deduction:        s.snacks_deduction,
      dinner_deduction:        s.dinner_deduction,
      guest_breakfast_price:   s.guest_breakfast_price,
      guest_lunch_price:       s.guest_lunch_price,
      guest_snacks_price:      s.guest_snacks_price,
      guest_dinner_price:      s.guest_dinner_price,
      guest_student_slot_limit: s.guest_student_slot_limit,
      guest_slot_daily_limit:   s.guest_slot_daily_limit,
    });
    setSaveErr(''); setSaveOk('');
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setSaveErr(''); setSaveOk('');
    try {
      const updated = await updateConsoleSetting(editing.id, form);
      setSettings(prev => prev.map(s => s.id === editing.id ? { ...s, ...updated } : s));
      setSaveOk('Settings saved!');
      setEditing(null);
    } catch (err) {
      setSaveErr(err.response?.data?.detail || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const numFld = (name, label) => (
    <FG label={label}>
      <input type="number" min="0" step="0.01" className="search-input"
        value={form[name] ?? ''}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} />
    </FG>
  );

  return (
    <div>
      {err    && <p style={{ color: '#dc2626' }}>{err}</p>}
      {saveOk && <div className="auth-success" style={{ marginBottom: '0.75rem' }}>{saveOk}</div>}

      {editing && (
        <div style={MODAL_BG}>
          <div style={{ ...MODAL_BOX, maxWidth: 640 }}>
            <h3 style={{ marginTop: 0 }}>Settings — {editing.hostel}</h3>
            {saveErr && <div className="auth-error" style={{ marginBottom: '0.75rem' }}>{saveErr}</div>}
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                {numFld('monthly_sma', 'Monthly SMA (₹)')}
                <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border-color,#e5e7eb)', paddingTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Daily Meal Deductions</strong>
                </div>
                {numFld('breakfast_deduction', 'Breakfast (₹)')}
                {numFld('lunch_deduction',     'Lunch (₹)')}
                {numFld('snacks_deduction',    'Snacks (₹)')}
                {numFld('dinner_deduction',    'Dinner (₹)')}
                <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border-color,#e5e7eb)', paddingTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Guest Coupon Prices</strong>
                </div>
                {numFld('guest_breakfast_price', 'Guest Breakfast (₹)')}
                {numFld('guest_lunch_price',     'Guest Lunch (₹)')}
                {numFld('guest_snacks_price',    'Guest Snacks (₹)')}
                {numFld('guest_dinner_price',    'Guest Dinner (₹)')}
                <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border-color,#e5e7eb)', paddingTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Coupon Limits</strong>
                </div>
                {numFld('guest_student_slot_limit', 'Max / Student / Slot')}
                {numFld('guest_slot_daily_limit',   'Max / Slot (total)')}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1rem' }}>
        {settings.map(s => (
          <div key={s.id} className="request-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0 }}>{s.hostel}</h4>
              <button className="btn btn-primary" style={{ padding: '0.25rem 0.85rem', fontSize: '0.82rem' }}
                onClick={() => startEdit(s)}>Edit</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem', fontSize: '0.85rem' }}>
              <SettRow label="Monthly SMA"   value={`₹${s.monthly_sma}`} />
              <SettRow label="Breakfast"     value={`₹${s.breakfast_deduction}`} />
              <SettRow label="Lunch"         value={`₹${s.lunch_deduction}`} />
              <SettRow label="Snacks"        value={`₹${s.snacks_deduction}`} />
              <SettRow label="Dinner"        value={`₹${s.dinner_deduction}`} />
              <SettRow label="Max/Student"   value={s.guest_student_slot_limit} />
              <SettRow label="Max/Slot"      value={s.guest_slot_daily_limit} />
            </div>
          </div>
        ))}
        {settings.length === 0 && !err && (
          <p style={{ color: 'var(--text-secondary)' }}>No settings found.</p>
        )}
      </div>
    </div>
  );
}

function SettRow({ label, value }) {
  return (
    <>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </>
  );
}

/* ── Shared primitives ────────────────────────────────────────────── */
function FG({ label, children, style }) {
  return (
    <div className="form-group" style={style}>
      <label style={{ fontSize: '0.82rem' }}>{label}</label>
      {children}
    </div>
  );
}
function Th({ children }) {
  return <th style={{ padding: '0.6rem 0.9rem', textAlign: 'left', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding: '0.6rem 0.9rem', fontSize: '0.85rem', verticalAlign: 'middle', ...style }}>{children}</td>;
}

const TABLE_STYLE = {
  width: '100%', borderCollapse: 'collapse',
  background: '#fff', borderRadius: 10, overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const MODAL_BG = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
};

const MODAL_BOX = {
  background: '#fff', borderRadius: 14, padding: '1.75rem',
  width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
};

/* ── Page root ────────────────────────────────────────────────────── */
export default function AdminConsole() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Overview');

  if (!user?.is_staff) {
    return (
      <section className="content-section active">
        <SectionHeader title="Admin Console" subtitle="Staff access only" />
        <div className="request-card" style={{ maxWidth: 480, textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔒</div>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            This page is restricted to staff members.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Admin Master Console" subtitle="System-wide management — staff only" />

      <div className="tab-navigation" style={{ marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview'  && <OverviewTab />}
      {tab === 'Users'     && <UsersTab />}
      {tab === 'Menus'     && <MenusTab />}
      {tab === 'Coupons'   && <CouponsTab />}
      {tab === 'Rebates'   && <RebatesTab />}
      {tab === 'Settings'  && <SettingsTab />}
    </section>
  );
}
