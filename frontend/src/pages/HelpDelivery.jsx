import { useState, useEffect, useCallback } from 'react';
import { SectionHeader, StatusBadge } from '../components/ui.jsx';
import Tabs from '../components/Tabs.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getHelpRequests, createHelpRequest, acceptRequest,
  completeRequest, getMyRequests, getHistory,
} from '../services/api';

// ---------------------------------------------------------------------------
// Fixed choices (must match backend)
// ---------------------------------------------------------------------------
const PICKUP_OPTIONS = [
  { value: 'gulmohar',     label: 'Gulmohar' },
  { value: 'main_gate',   label: 'Main Gate' },
  { value: 'shree_balaji',label: 'Shree Balaji Fruit & Vegetable' },
];

const DELIVERY_OPTIONS = [
  { group: 'Hostels', items: [
    { value: 'hostel_1', label: 'Hostel 1' },   { value: 'hostel_2', label: 'Hostel 2' },
    { value: 'hostel_3', label: 'Hostel 3' },   { value: 'hostel_4', label: 'Hostel 4' },
    { value: 'hostel_5', label: 'Hostel 5' },   { value: 'hostel_6', label: 'Hostel 6' },
    { value: 'hostel_7', label: 'Hostel 7' },   { value: 'hostel_8', label: 'Hostel 8' },
    { value: 'hostel_9', label: 'Hostel 9' },   { value: 'hostel_10', label: 'Hostel 10' },
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

function deliveryLabel(value) {
  for (const group of DELIVERY_OPTIONS) {
    const found = group.items.find(i => i.value === value);
    if (found) return found.label;
  }
  return value;
}

const STATUS_COLORS = {
  PENDING:   'available',
  ACCEPTED:  'warning',
  COMPLETED: 'success',
  EXPIRED:   'error',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ margin: 0 }}>{text}</p>
    </div>
  );
}

function RequestCard({ req, currentUser, onAccept, onComplete, actionBusy }) {
  const isRequester = req.requester_username === currentUser?.username;
  const isHelper    = req.helper_username    === currentUser?.username;

  return (
    <div className="request-card" style={{ marginBottom: '1rem' }}>
      <div className="request-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4 style={{ margin: 0, flex: 1, marginRight: '1rem' }}>{req.item_description}</h4>
        <span className={`status-badge ${STATUS_COLORS[req.status] || 'available'}`}>
          {req.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <span>📦 <strong>Pickup:</strong> {req.pickup_location_display}</span>
        <span>🏠 <strong>Deliver to:</strong> {deliveryLabel(req.delivery_location)}</span>
        <span>⏰ <strong>From:</strong> {new Date(req.from_time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
        <span>⏳ <strong>Until:</strong> {new Date(req.to_time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
        <span>👤 <strong>Posted by:</strong> {req.requester_username}</span>
        {req.helper_username && (
          <span>🤝 <strong>Helper:</strong> {req.helper_username}</span>
        )}
      </div>

      {/* Show contact only to requester or helper */}
      {req.contact_number && (isRequester || isHelper) && (
        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: 8, fontSize: '0.875rem' }}>
          📞 <strong>Contact:</strong> {req.contact_number}
          {req.additional_info && (
            <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>ℹ️ {req.additional_info}</div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
        {/* Requester: mark complete */}
        {isRequester && req.status === 'ACCEPTED' && (
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={actionBusy === req.id}
            onClick={() => onComplete(req.id)}
          >
            {actionBusy === req.id ? 'Marking…' : '✅ Mark Delivered'}
          </button>
        )}
        {/* Other user: accept pending */}
        {!isRequester && !isHelper && req.status === 'PENDING' && onAccept && (
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={actionBusy === req.id}
            onClick={() => onAccept(req.id)}
          >
            {actionBusy === req.id ? 'Checking location…' : '🚶 Accept & Deliver'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function PendingTab({ user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [actionBusy, setActionBusy] = useState(null);
  const [actionMsg, setActionMsg]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHelpRequests();
      setRequests(data);
    } catch { setError('Failed to load requests.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 30s
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  async function handleAccept(id) {
    setActionMsg('');
    if (!navigator.geolocation) {
      return setActionMsg('❌ Geolocation is not supported by your browser.');
    }
    setActionBusy(id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await acceptRequest(id, pos.coords.latitude, pos.coords.longitude);
          setActionMsg('✅ Request accepted! Check "My Requests" tab.');
          load();
        } catch (err) {
          setActionMsg('❌ ' + (err.response?.data?.detail || 'Could not accept request.'));
        } finally {
          setActionBusy(null);
        }
      },
      (geoErr) => {
        setActionMsg('❌ Location access denied. Allow location to accept requests.');
        setActionBusy(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  if (loading) return <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading…</p>;
  if (error)   return <p style={{ color: 'red', padding: '1rem' }}>{error}</p>;

  return (
    <div>
      {actionMsg && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: actionMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: actionMsg.startsWith('✅') ? '#166534' : '#991b1b',
          fontSize: '0.9rem',
        }}>
          {actionMsg}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button className="btn" onClick={load} style={{ fontSize: '0.85rem' }}>🔄 Refresh</button>
      </div>
      {requests.length === 0
        ? <EmptyState icon="📭" text="No pending requests right now. Check back soon!" />
        : requests.map(req => (
            <RequestCard key={req.id} req={req} currentUser={user} onAccept={handleAccept} actionBusy={actionBusy} />
          ))
      }
    </div>
  );
}

function CreateTab({ onCreated }) {
  const EMPTY = {
    item_description: '', pickup_location: '', delivery_location: '',
    contact_number: '', additional_info: '', from_time: '', to_time: '',
  };
  const [form, setForm]   = useState(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy]   = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.pickup_location || !form.delivery_location) {
      return setError('Please select both pickup and delivery locations.');
    }
    setBusy(true);
    try {
      await createHelpRequest({
        ...form,
        // Convert local datetime-local input (no timezone) to ISO with offset
        from_time: new Date(form.from_time).toISOString(),
        to_time:   new Date(form.to_time).toISOString(),
      });
      setSuccess('✅ Your request has been posted! Others nearby can now accept it.');
      setForm(EMPTY);
      if (onCreated) onCreated();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${[v].flat().join(', ')}`).join(' | ');
        setError(msgs);
      } else {
        setError('Failed to create request. Please check all fields.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 620 }}>
      {error   && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

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

      <div className="form-group">
        <label>Your Contact Number *</label>
        <input name="contact_number" className="search-input" required
          placeholder="10-digit mobile number" type="tel"
          value={form.contact_number} onChange={handle} maxLength={15} />
        <small style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
          Shared only with the person who accepts your request.
        </small>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>Available From *</label>
          <input name="from_time" type="datetime-local" className="search-input" required
            value={form.from_time} onChange={handle} />
        </div>
        <div className="form-group">
          <label>Available Until *</label>
          <input name="to_time" type="datetime-local" className="search-input" required
            value={form.to_time} onChange={handle} />
        </div>
      </div>

      <div className="form-group">
        <label>Additional Info <span style={{ color: 'var(--text-secondary)' }}>(optional)</span></label>
        <textarea name="additional_info" className="search-input" rows={3} style={{ resize: 'vertical' }}
          placeholder="Any special instructions, building entrance, room number…"
          value={form.additional_info} onChange={handle} />
      </div>

      <button type="submit" className="btn btn-primary" disabled={busy} style={{ maxWidth: 200 }}>
        {busy ? 'Posting…' : '📬 Post Request'}
      </button>
    </form>
  );
}

function MyRequestsTab({ user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [actionBusy, setActionBusy] = useState(null);
  const [msg, setMsg] = useState('');

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
      await completeRequest(id);
      setMsg('✅ Marked as delivered! Helper earned 1 point.');
      load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.detail || 'Could not complete.'));
    } finally { setActionBusy(null); }
  }

  if (loading) return <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading…</p>;

  return (
    <div>
      {msg && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: msg.startsWith('✅') ? '#166534' : '#991b1b', fontSize: '0.9rem',
        }}>{msg}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button className="btn" onClick={load} style={{ fontSize: '0.85rem' }}>🔄 Refresh</button>
      </div>
      {requests.length === 0
        ? <EmptyState icon="📋" text="No active requests. Create one or accept someone else's!" />
        : requests.map(req => (
            <RequestCard key={req.id} req={req} currentUser={user} onComplete={handleComplete} actionBusy={actionBusy} />
          ))
      }
    </div>
  );
}

function HistoryTab({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading…</p>;

  return (
    <div>
      {history.length === 0
        ? <EmptyState icon="📜" text="No history yet. Complete some requests to see them here." />
        : history.map(req => (
            <RequestCard key={req.id} req={req} currentUser={user} />
          ))
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function HelpDelivery() {
  const { user } = useAuth();

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
          { id: 'pending',  label: '🔍 Pending' },
          { id: 'create',   label: '➕ Create' },
          { id: 'mine',     label: '📋 My Requests' },
          { id: 'history',  label: '📜 History' },
        ]}
        renderContent={(tab) => {
          if (tab === 'pending') return <PendingTab user={user} />;
          if (tab === 'create')  return <CreateTab />;
          if (tab === 'mine')    return <MyRequestsTab user={user} />;
          if (tab === 'history') return <HistoryTab user={user} />;
        }}
      />
    </section>
  );
}
