import { useState, useEffect, useCallback } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import Tabs from '../components/Tabs.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getHelpRequests, createHelpRequest, acceptRequest,
  completeRequest, editRequest, deleteRequest,
  getMyRequests, getHistory,
} from '../services/api';

// ---------------------------------------------------------------------------
// Constants (must match backend)
// ---------------------------------------------------------------------------
const PICKUP_OPTIONS = [
  { value: 'gulmohar',     label: 'Gulmohar' },
  { value: 'main_gate',   label: 'Main Gate' },
  { value: 'shree_balaji',label: 'Shree Balaji Fruit & Vegetable' },
];

const DELIVERY_OPTIONS = [
  { group: 'Hostels', items: [
    { value: 'hostel_1',  label: 'Hostel 1' },  { value: 'hostel_2',  label: 'Hostel 2' },
    { value: 'hostel_3',  label: 'Hostel 3' },  { value: 'hostel_4',  label: 'Hostel 4' },
    { value: 'hostel_5',  label: 'Hostel 5' },  { value: 'hostel_6',  label: 'Hostel 6' },
    { value: 'hostel_7',  label: 'Hostel 7' },  { value: 'hostel_8',  label: 'Hostel 8' },
    { value: 'hostel_9',  label: 'Hostel 9' },  { value: 'hostel_10', label: 'Hostel 10' },
    { value: 'hostel_11', label: 'Hostel 11' }, { value: 'hostel_12', label: 'Hostel 12' },
    { value: 'hostel_13', label: 'Hostel 13' }, { value: 'hostel_14', label: 'Hostel 14' },
    { value: 'hostel_15', label: 'Hostel 15' }, { value: 'hostel_16', label: 'Hostel 16' },
    { value: 'hostel_17', label: 'Hostel 17' }, { value: 'hostel_18', label: 'Hostel 18' },
    { value: 'hostel_19', label: 'Hostel 19' }, { value: 'hostel_21', label: 'Hostel 21' },
    { value: 'tansa_house', label: 'Tansa House' },
  ]},
  { group: 'Academic & Common', items: [
    { value: 'kresit',        label: 'KReSIT' },
    { value: 'sjmsom',        label: 'SJMSOM' },
    { value: 'lecture_hall',  label: 'Lecture Hall Complex' },
    { value: 'conv_hall',     label: 'Convocation Hall' },
    { value: 'main_building', label: 'Main Building' },
    { value: 'central_lib',   label: 'Central Library' },
    { value: 'sac',           label: 'Students Activity Centre' },
    { value: 'gymkhana',      label: 'Students Gymkhana' },
  ]},
];

const DURATION_OPTIONS = [
  { value: 5,   label: '5 min' },
  { value: 10,  label: '10 min' },
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hr' },
  { value: 90,  label: '1.5 hr' },
  { value: 120, label: '2 hr' },
];

function deliveryLabel(value) {
  for (const group of DELIVERY_OPTIONS) {
    const found = group.items.find(i => i.value === value);
    if (found) return found.label;
  }
  return value;
}

const STATUS_META = {
  PENDING:   { color: '#d97706', bg: '#fef3c7', label: 'Pending' },
  ACCEPTED:  { color: '#2563eb', bg: '#dbeafe', label: 'Accepted' },
  COMPLETED: { color: '#16a34a', bg: '#dcfce7', label: 'Completed' },
  EXPIRED:   { color: '#6b7280', bg: '#f3f4f6', label: 'Expired' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
  });
}

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '1rem',
      background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
      color: msg.startsWith('✅') ? '#166534' : '#991b1b',
      fontSize: '0.875rem',
    }}>{msg}</div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ margin: 0 }}>{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card grid wrapper
// ---------------------------------------------------------------------------
const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '1rem',
  alignItems: 'start',
};

const CARD_STYLE = {
  background: 'var(--bg-card, #fff)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 16,
  padding: '1.1rem 1.25rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
  transition: 'transform 0.15s, box-shadow 0.15s',
};

// ---------------------------------------------------------------------------
// RequestCard
// ---------------------------------------------------------------------------
function RequestCard({
  req, currentUser, hasActiveAccepted,
  onAccept, onComplete, onEdit, onDelete,
  actionBusy,
}) {
  const isRequester = req.requester_username === currentUser?.username;
  const isHelper    = req.helper_username    === currentUser?.username;
  const meta        = STATUS_META[req.status] || STATUS_META.PENDING;

  // Accept button state
  const canAccept = !isRequester && !isHelper && req.status === 'PENDING';
  const outsideRange = req.is_within_range === false;          // null = no location provided
  const acceptBlocked = hasActiveAccepted || outsideRange;

  let acceptBlockReason = '';
  if (hasActiveAccepted) acceptBlockReason = 'Complete your current delivery before accepting another';
  else if (outsideRange && req.distance_in_meters != null)
    acceptBlockReason = `You are ${req.distance_in_meters}m away (need ≤200m)`;
  else if (outsideRange)
    acceptBlockReason = 'You are too far from the pickup point';

  const busy = actionBusy === req.id;

  return (
    <div
      className="help-card"
      style={{
        ...CARD_STYLE,
        ...(busy ? { opacity: 0.7 } : {}),
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = CARD_STYLE.boxShadow; }}
    >
      {/* Header: description + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.95rem', lineHeight: 1.3, flex: 1 }}>{req.item_description}</strong>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
          padding: '0.2rem 0.55rem', borderRadius: 999,
          background: meta.bg, color: meta.color, whiteSpace: 'nowrap', flexShrink: 0,
        }}>{meta.label}</span>
      </div>

      {/* Route */}
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        📦 <strong>{req.pickup_location_display}</strong> → 🏠 <strong>{deliveryLabel(req.delivery_location)}</strong>
      </div>

      {/* Time */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        ⏰ {fmtTime(req.from_time)}
        {' '}· {req.duration} min window
        {' '}→ until {fmtTime(req.to_time)}
      </div>

      {/* Posted by */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        👤 {req.requester_name || req.requester_username}
        {req.requester_roll ? ` (${req.requester_roll})` : ''}
        {req.helper_username && <> · 🤝 {req.helper_username}</>}
      </div>

      {/* Distance badge */}
      {req.distance_in_meters != null && (
        <div style={{
          fontSize: '0.78rem', fontWeight: 600,
          color: req.is_within_range ? '#15803d' : '#b91c1c',
          background: req.is_within_range ? '#dcfce7' : '#fee2e2',
          borderRadius: 6, padding: '0.2rem 0.55rem', alignSelf: 'flex-start',
        }}>
          {req.is_within_range ? '✅' : '📍'} {req.distance_in_meters}m away
        </div>
      )}

      {/* Contact (only for requester / helper) */}
      {req.contact_number && (isRequester || isHelper) && (
        <div style={{ fontSize: '0.82rem', background: 'var(--bg-secondary,#f8f8f8)', borderRadius: 8, padding: '0.4rem 0.6rem' }}>
          📞 {req.contact_number}
          {req.additional_info && <div style={{ marginTop: 2, color: 'var(--text-secondary)' }}>ℹ️ {req.additional_info}</div>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
        {/* Mark delivered */}
        {isRequester && req.status === 'ACCEPTED' && (
          <button className="btn btn-primary" disabled={busy} onClick={() => onComplete(req.id)}
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
            {busy ? 'Marking…' : '✅ Mark Delivered'}
          </button>
        )}

        {/* Accept */}
        {canAccept && (
          <div>
            <button className="btn btn-primary"
              disabled={busy || acceptBlocked}
              onClick={() => onAccept(req.id)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', width: '100%',
                opacity: acceptBlocked ? 0.5 : 1, cursor: acceptBlocked ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Checking location…' : '🚶 Accept & Deliver'}
            </button>
            {acceptBlocked && acceptBlockReason && (
              <p style={{ fontSize: '0.73rem', color: '#b91c1c', margin: '0.25rem 0 0' }}>
                {acceptBlockReason}
              </p>
            )}
          </div>
        )}

        {/* Edit / Delete (requester, PENDING only) */}
        {isRequester && req.status === 'PENDING' && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {onEdit && (
              <button className="btn" disabled={busy}
                onClick={() => onEdit(req)}
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', flex: 1 }}>
                ✏️ Edit
              </button>
            )}
            {onDelete && (
              <button className="btn"
                disabled={busy}
                onClick={() => onDelete(req.id)}
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', flex: 1,
                  background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                🗑️ Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit form (shared)
// ---------------------------------------------------------------------------
const EMPTY_FORM = {
  item_description: '', pickup_location: '', delivery_location: '',
  additional_info: '', from_time: '', duration: 30,
};

function HelpForm({ initial = EMPTY_FORM, onSave, onCancel, isEdit = false }) {
  const [form, setForm]   = useState({ ...EMPTY_FORM, ...initial });
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  const handle = e => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: name === 'duration' ? Number(value) : value }));
  };

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.pickup_location || !form.delivery_location) {
      return setError('Please select both pickup and delivery locations.');
    }
    setBusy(true);
    try {
      await onSave({
        item_description:  form.item_description,
        pickup_location:   form.pickup_location,
        delivery_location: form.delivery_location,
        additional_info:   form.additional_info,
        from_time:         new Date(form.from_time).toISOString(),
        duration:          Number(form.duration),
      });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${[v].flat().join(', ')}`).join(' | ');
        setError(msgs);
      } else {
        setError('Failed. Please check all fields.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 620 }}>
      <ErrorMsg msg={error} />

      <div className="form-group">
        <label>What do you need? *</label>
        <input name="item_description" className="search-input" required
          placeholder="e.g. 500g apples and a bottle of water"
          value={form.item_description} onChange={handle} maxLength={300} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>Pickup Location *</label>
          <select name="pickup_location" className="category-select" required
            value={form.pickup_location} onChange={handle}>
            <option value="">Select pickup</option>
            {PICKUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Deliver To *</label>
          <select name="delivery_location" className="category-select" required
            value={form.delivery_location} onChange={handle}>
            <option value="">Select destination</option>
            {DELIVERY_OPTIONS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>Available From *</label>
          <input name="from_time" type="datetime-local" className="search-input" required
            value={form.from_time} onChange={handle} />
        </div>
        <div className="form-group">
          <label>Duration *</label>
          <select name="duration" className="category-select" required
            value={form.duration} onChange={handle}>
            {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Additional Info <span style={{ color: 'var(--text-secondary)' }}>(optional)</span></label>
        <textarea name="additional_info" className="search-input" rows={3}
          style={{ resize: 'vertical' }}
          placeholder="Special instructions, building entrance, room number…"
          value={form.additional_info} onChange={handle} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ maxWidth: 200 }}>
          {busy ? (isEdit ? 'Saving…' : 'Posting…') : (isEdit ? '💾 Save Changes' : '📬 Post Request')}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// useGeolocation hook
// ---------------------------------------------------------------------------
function useGeolocation() {
  const [pos, setPos] = useState(null);     // { lat, lng }

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const refresh = useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      p => { const next = { lat: p.coords.latitude, lng: p.coords.longitude }; setPos(next); resolve(next); },
      reject,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }), []);

  return { pos, refresh };
}

// ---------------------------------------------------------------------------
// PendingTab
// ---------------------------------------------------------------------------
function PendingTab({ user }) {
  const { pos, refresh: refreshPos } = useGeolocation();
  const [requests,    setRequests]   = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');
  const [actionBusy,  setActionBusy] = useState(null);
  const [actionMsg,   setActionMsg]  = useState('');

  // Does this user already have an active accepted request?
  const hasActiveAccepted = requests.some(
    r => r.helper_username === user?.username && r.status === 'ACCEPTED',
  );

  const load = useCallback(async (latLng) => {
    setLoading(true);
    try {
      const loc = latLng || pos;
      const data = await getHelpRequests(loc?.lat, loc?.lng);
      setRequests(data);
    } catch { setError('Failed to load requests.'); }
    finally { setLoading(false); }
  }, [pos]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(() => load(), 30000); return () => clearInterval(id); }, [load]);

  async function handleAccept(id) {
    setActionMsg('');
    setActionBusy(id);
    try {
      const loc = await refreshPos();
      await acceptRequest(id, loc.lat, loc.lng);
      setActionMsg('✅ Request accepted! Check "My Requests" tab.');
      load(loc);
    } catch (err) {
      if (err.message === 'Geolocation not supported') {
        setActionMsg('❌ Geolocation is not supported by your browser.');
      } else if (err.response) {
        setActionMsg('❌ ' + (err.response.data?.detail || 'Could not accept request.'));
      } else {
        setActionMsg('❌ Location access denied. Allow location to accept requests.');
      }
    } finally {
      setActionBusy(null);
    }
  }

  if (loading && requests.length === 0)
    return <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading…</p>;
  if (error) return <p style={{ color: 'red', padding: '1rem' }}>{error}</p>;

  return (
    <div>
      <ErrorMsg msg={actionMsg} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button className="btn" onClick={() => load()} style={{ fontSize: '0.85rem' }}>🔄 Refresh</button>
      </div>
      {pos == null && (
        <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fef3c7',
          borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>
          📍 Share location to see distance & enable Accept button.
        </div>
      )}
      {requests.length === 0
        ? <EmptyState icon="📭" text="No pending requests right now." />
        : <div style={GRID_STYLE}>
            {requests.map(req => (
              <RequestCard key={req.id} req={req} currentUser={user}
                hasActiveAccepted={hasActiveAccepted}
                onAccept={handleAccept} actionBusy={actionBusy} />
            ))}
          </div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreateTab
// ---------------------------------------------------------------------------
function CreateTab() {
  const [success, setSuccess] = useState('');

  async function handleSave(data) {
    await createHelpRequest(data);
    setSuccess('✅ Your request has been posted!');
  }

  return (
    <div>
      {success && <ErrorMsg msg={success} />}
      <HelpForm onSave={handleSave} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MyRequestsTab
// ---------------------------------------------------------------------------
function MyRequestsTab({ user, updateUser }) {
  const [requests,   setRequests]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [actionBusy, setActionBusy] = useState(null);
  const [msg,        setMsg]        = useState('');
  const [editTarget, setEditTarget] = useState(null);   // req being edited

  const load = useCallback(async () => {
    setLoading(true);
    try { setRequests(await getMyRequests()); } catch { /**/ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  async function handleComplete(id) {
    setMsg(''); setActionBusy(id);
    try {
      const res = await completeRequest(id);
      // Update points instantly if this user is the helper
      if (res.helper_username === user?.username && res.helper_points != null) {
        updateUser({ points: res.helper_points });
      }
      setMsg('✅ Marked as delivered! Helper earned 1 point.');
      load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.detail || 'Could not complete.'));
    } finally { setActionBusy(null); }
  }

  async function handleDelete(id) {
    setMsg(''); setActionBusy(id);
    try {
      await deleteRequest(id);
      setMsg('✅ Request deleted.');
      load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.detail || 'Could not delete.'));
    } finally { setActionBusy(null); }
  }

  async function handleEditSave(data) {
    await editRequest(editTarget.id, data);
    setEditTarget(null);
    setMsg('✅ Request updated.');
    load();
  }

  if (loading && requests.length === 0)
    return <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading…</p>;

  if (editTarget) {
    const initial = {
      item_description:  editTarget.item_description,
      pickup_location:   editTarget.pickup_location,
      delivery_location: editTarget.delivery_location,
      additional_info:   editTarget.additional_info,
      from_time:         editTarget.from_time.slice(0, 16), // datetime-local format
      duration:          editTarget.duration,
    };
    return (
      <div>
        <h4 style={{ marginBottom: '1rem' }}>Edit Request</h4>
        <HelpForm initial={initial} onSave={handleEditSave}
          onCancel={() => setEditTarget(null)} isEdit />
      </div>
    );
  }

  return (
    <div>
      <ErrorMsg msg={msg} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button className="btn" onClick={load} style={{ fontSize: '0.85rem' }}>🔄 Refresh</button>
      </div>
      {requests.length === 0
        ? <EmptyState icon="📋" text="No active requests. Create one or accept someone else's!" />
        : <div style={GRID_STYLE}>
            {requests.map(req => (
              <RequestCard key={req.id} req={req} currentUser={user}
                hasActiveAccepted={false}
                onComplete={handleComplete}
                onEdit={setEditTarget}
                onDelete={handleDelete}
                actionBusy={actionBusy} />
            ))}
          </div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoryTab
// ---------------------------------------------------------------------------
function HistoryTab({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading…</p>;

  return (
    <div>
      {history.length === 0
        ? <EmptyState icon="📜" text="No history yet." />
        : <div style={GRID_STYLE}>
            {history.map(req => (
              <RequestCard key={req.id} req={req} currentUser={user}
                hasActiveAccepted={false} />
            ))}
          </div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function HelpDelivery() {
  const { user, updateUser } = useAuth();

  return (
    <section className="content-section active">
      <SectionHeader
        title="Help & Delivery"
        subtitle="Request campus errands or help others nearby to earn points"
      />

      {user && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'var(--bg-secondary, #f8f8f8)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 999, padding: '0.35rem 0.9rem',
          fontSize: '0.85rem', marginBottom: '1.25rem',
        }}>
          ⭐ <strong>{user.points}</strong> points earned
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'pending', label: '🔍 Pending' },
          { id: 'create',  label: '➕ Create' },
          { id: 'mine',    label: '📋 My Requests' },
          { id: 'history', label: '📜 History' },
        ]}
        renderContent={(tab) => {
          if (tab === 'pending') return <PendingTab user={user} />;
          if (tab === 'create')  return <CreateTab />;
          if (tab === 'mine')    return <MyRequestsTab user={user} updateUser={updateUser} />;
          if (tab === 'history') return <HistoryTab user={user} />;
        }}
      />
    </section>
  );
}
