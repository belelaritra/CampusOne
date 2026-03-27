import { useState, useEffect, useCallback, useRef } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getLFItems, createLFItem, editLFItem, deleteLFItem,
  interactLFItem, resolveLFItem, revertLFItem,
  getLFSuggestions,
  getMyLFItems, getPendingLFItems, getHistoryLFItems,
  getMyClaims, getLFTopTags, getLFCategories,
  getLFNotifications, markAllLFNotifsRead,
} from '../services/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function whatsappLink(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const num = digits.startsWith('91') ? digits : `91${digits}`;
  return `https://wa.me/${num}`;
}

function ContactChip({ name, phone }) {
  if (!name) return null;
  const wa = whatsappLink(phone);
  return (
    <div style={{
      background: '#f0fdf4', borderRadius: 8, padding: '0.45rem 0.65rem',
      fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span>👤 <strong>{name}</strong></span>
      {phone && (
        <span>
          📞 {phone}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer"
              style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>
              WhatsApp
            </a>
          )}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification Bell
// ---------------------------------------------------------------------------
function NotifBell({ notifs, onMarkAll }) {
  const [open, setOpen] = useState(false);
  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn"
        style={{ fontSize: '1.1rem', padding: '0.35rem 0.6rem', position: 'relative' }}
        onClick={() => { setOpen(p => !p); if (!open && unread) onMarkAll(); }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, transform: 'translate(40%,-40%)',
            background: '#ef4444', color: '#fff', borderRadius: '999px',
            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', lineHeight: 1,
          }}>{unread}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 100, width: 320,
          background: 'var(--bg-card,#fff)', border: '1px solid var(--border,#e5e7eb)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 380, overflowY: 'auto',
        }}>
          {notifs.length === 0
            ? <p style={{ padding: '1rem', color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>No notifications</p>
            : notifs.map(n => (
                <div key={n.id} style={{
                  padding: '0.65rem 0.9rem',
                  borderBottom: '1px solid var(--border,#f0f0f0)',
                  background: n.is_read ? 'transparent' : '#eff6ff',
                  fontSize: '0.82rem',
                }}>
                  <div>{n.message}</div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 2, fontSize: '0.72rem' }}>{timeAgo(n.created_at)}</div>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared layout constants
// ---------------------------------------------------------------------------
const CARD_STYLE = {
  background: 'var(--bg-card,#fff)',
  border: '1px solid var(--border,#e5e7eb)',
  borderRadius: 16,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  transition: 'transform 0.15s, box-shadow 0.15s',
};

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: '1rem',
  alignItems: 'start',
};

// Status badge background/color for non-AVAILABLE items
function statusBadge(s) {
  if (s === 'PENDING')  return { bg: '#fef3c7', color: '#92400e' };
  if (s === 'RESOLVED') return { bg: '#dcfce7', color: '#15803d' };
  return { bg: '#f3f4f6', color: '#374151' };
}

// ---------------------------------------------------------------------------
// Item Card — Dashboard (AVAILABLE items)
// ---------------------------------------------------------------------------
function ItemCard({ item, currentUser, onInteract, onEdit, onDelete, compact = false }) {
  const isLost  = item.item_type === 'LOST';
  const isOwner = item.reporter_username === currentUser?.username;
  // Only non-owners can interact; only on AVAILABLE items
  const canInteract = !isOwner && item.status === 'AVAILABLE' && !item.user_has_claimed;
  const canEdit     = isOwner && item.status === 'AVAILABLE';
  const canDel      = isOwner && item.status === 'AVAILABLE';

  const mapsUrl = item.latitude && item.longitude
    ? `https://www.google.com/maps?q=${item.latitude},${item.longitude}`
    : null;

  return (
    <div
      style={CARD_STYLE}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = CARD_STYLE.boxShadow; }}
    >
      <div style={{ width: '100%', aspectRatio: '1/1', background: '#f3f4f6', position: 'relative', flexShrink: 0 }}>
        {item.image_effective
          ? <img src={item.image_effective} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
              {item.category_icon || '📦'}
            </div>
        }
        <span style={{
          position: 'absolute', top: 8, left: 8,
          background: isLost ? '#ef4444' : '#22c55e',
          color: '#fff', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
          padding: '0.2rem 0.5rem', letterSpacing: '0.04em',
        }}>{item.item_type}</span>
        {item.status !== 'AVAILABLE' && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            ...statusBadge(item.status),
            borderRadius: 6, fontSize: '0.65rem', fontWeight: 700,
            padding: '0.15rem 0.45rem',
          }}>{item.status}</span>
        )}
      </div>

      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
        <strong style={{ fontSize: '0.9rem', lineHeight: 1.3 }}>{item.title}</strong>

        {(item.category_name || (item.tags?.length > 0)) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {item.category_name && (
              <span style={{ fontSize: '0.7rem', background: '#f3f4f6', borderRadius: 4, padding: '0.15rem 0.4rem', color: '#374151' }}>
                {item.category_icon} {item.category_name}
              </span>
            )}
            {(item.tags || []).slice(0, 3).map(t => (
              <span key={t} style={{ fontSize: '0.7rem', background: '#eff6ff', borderRadius: 4, padding: '0.15rem 0.4rem', color: '#1d4ed8' }}>#{t}</span>
            ))}
          </div>
        )}

        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          📍 {mapsUrl
            ? <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{item.location_name || 'View map'}</a>
            : (item.location_name || '—')}
        </div>

        {item.distance_meters != null && (
          <div style={{ fontSize: '0.74rem', color: '#6b7280' }}>🗺️ {item.distance_meters}m away</div>
        )}

        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          🕐 {timeAgo(item.date_reported)}
          {' · '}
          {isLost ? '😟' : '😊'} {item.reporter_name || item.reporter_username}
          {item.reporter_roll ? ` (${item.reporter_roll})` : ''}
        </div>

        {!compact && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 'auto', paddingTop: '0.4rem' }}>
            {canInteract && (
              <button className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', flex: 1 }}
                onClick={() => onInteract && onInteract(item)}>
                {isLost ? '🙋 Mark I have found' : '🏷️ Claim'}
              </button>
            )}
            {item.user_has_claimed && (
              <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, padding: '0.3rem 0' }}>⏳ Pending</span>
            )}
            {canEdit && (
              <button className="btn"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                onClick={() => onEdit && onEdit(item)}>✏️</button>
            )}
            {canDel && (
              <button className="btn"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
                onClick={() => onDelete && onDelete(item.id)}>🗑️</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending Item Card — for the Pending tab
// Shows contact info + action buttons for reporter; waiting message for interactor.
// ---------------------------------------------------------------------------
function PendingItemCard({ item, onResolve, onRevert, busy }) {
  const isLost       = item.item_type === 'LOST';
  const isReporter   = item.is_reporter;
  const isInteractor = item.is_interactor;
  const interaction  = item.active_interaction;

  const mapsUrl = item.latitude && item.longitude
    ? `https://www.google.com/maps?q=${item.latitude},${item.longitude}`
    : null;

  return (
    <div style={{
      ...CARD_STYLE,
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: 120,
    }}>
      {/* Thumbnail */}
      <div style={{ width: 90, flexShrink: 0, background: '#f3f4f6', position: 'relative' }}>
        {item.image_effective
          ? <img src={item.image_effective} alt={item.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
              {item.category_icon || '📦'}
            </div>
        }
        <span style={{
          position: 'absolute', bottom: 4, left: 4,
          background: isLost ? '#ef4444' : '#22c55e',
          color: '#fff', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
          padding: '0.1rem 0.35rem',
        }}>{item.item_type}</span>
      </div>

      {/* Content */}
      <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 0 }}>
        <strong style={{ fontSize: '0.9rem' }}>{item.title}</strong>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          📍 {mapsUrl
            ? <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{item.location_name || 'View map'}</a>
            : (item.location_name || '—')}
          {' · '}{timeAgo(item.date_reported)}
        </div>

        {/* Interaction message */}
        {interaction?.message && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            💬 "{interaction.message}"
          </div>
        )}

        {/* Contact info — visible to involved parties only */}
        {isReporter && interaction && (
          <ContactChip
            name={interaction.interactor_name}
            phone={interaction.interactor_phone}
          />
        )}
        {isInteractor && interaction && (
          <ContactChip
            name={interaction.reporter_name}
            phone={interaction.reporter_phone}
          />
        )}

        {/* Security notice */}
        {item.contact_type === 'SECURITY' && (
          <div style={{ background: '#fef3c7', borderRadius: 6, padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}>
            🏢 Item handled by <strong>Security Office</strong>
          </div>
        )}

        {/* Action buttons — reporter only */}
        {isReporter && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 4 }}>
            <button
              className="btn btn-primary"
              disabled={busy}
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
              onClick={() => onResolve && onResolve(item.id)}>
              {isLost ? '✅ Received' : '✅ Handed Over'}
            </button>
            <button
              className="btn"
              disabled={busy}
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
              onClick={() => onRevert && onRevert(item.id)}>
              ↩️ Revert
            </button>
          </div>
        )}

        {isInteractor && (
          <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 500 }}>
            ⏳ Waiting for confirmation from reporter
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interact Modal (was ClaimModal) — "Mark I have found" / "Claim"
// ---------------------------------------------------------------------------
function InteractModal({ item, onConfirm, onCancel, busy }) {
  const [msg, setMsg] = useState('');
  if (!item) return null;
  const isLost = item.item_type === 'LOST';
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-card,#fff)', borderRadius: 16, padding: '1.5rem',
        width: '100%', maxWidth: 440, boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      }}>
        <h3 style={{ margin: '0 0 0.5rem' }}>
          {isLost ? '🙋 I Found This Item' : '🏷️ Claim This Item'}
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
          <strong>{item.title}</strong> · {item.location_name || 'campus'}
        </p>
        <div className="form-group">
          <label style={{ fontSize: '0.85rem' }}>
            {isLost ? 'Where did you find it?' : 'How can you prove ownership?'} (optional)
          </label>
          <textarea className="search-input" rows={3} style={{ resize: 'vertical' }}
            placeholder={isLost ? 'Describe where you found it…' : 'Describe identifying features…'}
            value={msg} onChange={e => setMsg(e.target.value)} />
        </div>
        {item.contact_type === 'SECURITY' && (
          <div style={{ background: '#fef3c7', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.82rem', marginTop: '0.75rem' }}>
            🏢 This item is managed by the <strong>Security Office</strong>. Bring ID proof.
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button className="btn btn-primary" disabled={busy} style={{ flex: 1 }}
            onClick={() => onConfirm(item.id, msg)}>
            {busy ? 'Submitting…' : 'Confirm'}
          </button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item Form (create + edit) — unified, type selector always visible on create
// ---------------------------------------------------------------------------
const EMPTY_FORM = {
  item_type: 'LOST', title: '', description: '',
  category: '', tags: '', image: null, image_url: '',
  location_name: '', latitude: '', longitude: '',
  contact_type: 'ME', roll_number: '',
};

function LFForm({ initial, categories, onSave, onCancel, isEdit = false }) {
  const [form, setForm]       = useState({ ...EMPTY_FORM, ...initial });
  const [preview, setPreview] = useState(initial?.image_effective || null);
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const fileRef               = useRef();

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) { setForm(p => ({ ...p, image: f })); setPreview(URL.createObjectURL(f)); }
  }

  function useGPS() {
    if (!navigator.geolocation) return alert('Geolocation not supported.');
    navigator.geolocation.getCurrentPosition(
      p => setForm(pr => ({ ...pr, latitude: p.coords.latitude, longitude: p.coords.longitude })),
      () => alert('Could not get location.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Item name is required.');
    setBusy(true);
    try {
      const tagsList = form.tags
        ? form.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];
      const payload = {
        item_type: form.item_type, title: form.title.trim(),
        description: form.description.trim(),
        category: form.category || undefined,
        tags: tagsList,
        location_name: form.location_name.trim(),
        contact_type: form.contact_type,
        roll_number: form.roll_number.trim(),
      };
      if (form.latitude)  payload.latitude  = parseFloat(form.latitude);
      if (form.longitude) payload.longitude = parseFloat(form.longitude);
      if (form.image instanceof File) payload.image = form.image;
      else if (form.image_url) payload.image_url = form.image_url;
      await onSave(payload);
    } catch (err) {
      const d = err.response?.data;
      setError(d && typeof d === 'object'
        ? Object.entries(d).map(([k, v]) => `${k}: ${[v].flat().join(', ')}`).join(' | ')
        : 'Failed to save. Please check all fields.');
    } finally { setBusy(false); }
  }

  const selectedCat = categories.find(c => c.id === Number(form.category));
  const isIDCat = selectedCat?.name?.toLowerCase().includes('id');

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 600 }}>
      {error && <div className="auth-error">{error}</div>}

      {/* Type selector — always shown (even on edit so user knows the type) */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {['LOST', 'FOUND'].map(t => (
          <label key={t} style={{
            flex: 1, textAlign: 'center', padding: '0.6rem', borderRadius: 10,
            cursor: isEdit ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '0.9rem',
            border: form.item_type === t
              ? `2px solid ${t === 'LOST' ? '#ef4444' : '#22c55e'}`
              : '2px solid var(--border,#e5e7eb)',
            background: form.item_type === t
              ? (t === 'LOST' ? '#fee2e2' : '#dcfce7')
              : 'var(--bg-secondary,#f9f9f9)',
            color: form.item_type === t
              ? (t === 'LOST' ? '#991b1b' : '#15803d')
              : 'inherit',
            opacity: isEdit ? 0.7 : 1,
          }}>
            <input type="radio" name="item_type" value={t}
              checked={form.item_type === t} onChange={handle}
              disabled={isEdit} style={{ display: 'none' }} />
            {t === 'LOST' ? '😟 I Lost This' : '😊 I Found This'}
          </label>
        ))}
      </div>

      <div className="form-group">
        <label>Item Name *</label>
        <input name="title" className="search-input" required value={form.title}
          onChange={handle} placeholder="e.g. Blue Backpack, IITB ID Card" maxLength={200} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>Category</label>
          <select name="category" className="category-select" value={form.category} onChange={handle}>
            <option value="">-- Select category --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Contact Via</label>
          <select name="contact_type" className="category-select" value={form.contact_type} onChange={handle}>
            <option value="ME">📞 Me (direct)</option>
            <option value="SECURITY">🏢 Security Office</option>
          </select>
        </div>
      </div>

      {isIDCat && (
        <div className="form-group">
          <label>Roll Number on ID Card</label>
          <input name="roll_number" className="search-input" value={form.roll_number}
            onChange={handle} placeholder="e.g. 22B1234" maxLength={20} />
          <small style={{ color: 'var(--text-secondary)', marginTop: 3, display: 'block' }}>
            Owner will be notified automatically.
          </small>
        </div>
      )}

      <div className="form-group">
        <label>Description</label>
        <textarea name="description" className="search-input" rows={3} style={{ resize: 'vertical' }}
          value={form.description} onChange={handle}
          placeholder="Colour, brand, identifying features…" />
      </div>

      <div className="form-group">
        <label>Tags <span style={{ color: 'var(--text-secondary)' }}>(comma separated)</span></label>
        <input name="tags" className="search-input" value={form.tags}
          onChange={handle} placeholder="e.g. hp, laptop, silver" />
      </div>

      <div className="form-group">
        <label>Location</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input name="location_name" className="search-input" style={{ flex: 1 }}
            value={form.location_name} onChange={handle}
            placeholder="e.g. Central Library, Hostel 5 mess" />
          <button type="button" className="btn" style={{ flexShrink: 0, fontSize: '0.8rem' }} onClick={useGPS}>
            📍 GPS
          </button>
        </div>
        {form.latitude && form.longitude && (
          <small style={{ color: '#16a34a', marginTop: 3, display: 'block' }}>
            ✅ {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
          </small>
        )}
      </div>

      <div className="form-group">
        <label>Image (optional)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}
            style={{ fontSize: '0.82rem' }}>📷 Upload</button>
          {preview && (
            <img src={preview} alt="preview" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ maxWidth: 200 }}>
          {busy ? 'Saving…' : (isEdit ? '💾 Save Changes' : '📮 Post Item')}
        </button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tab — shows AVAILABLE items; "Mark I have found" / "Claim" buttons
// ---------------------------------------------------------------------------
function DashboardTab({ user, categories, onRefreshNotifs, onGoToPending }) {
  const [items,        setItems]       = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [topTags,      setTopTags]     = useState([]);
  const [activeTag,    setActiveTag]   = useState('');
  const [filter,       setFilter]      = useState({ type: '', category: '', q: '' });
  const [interactTarget, setInteractTarget] = useState(null);
  const [interactBusy,   setInteractBusy]   = useState(false);
  const [msg,          setMsg]         = useState('');
  const [editTarget,   setEditTarget]  = useState(null);
  const posRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => { posRef.current = { lat: p.coords.latitude, lng: p.coords.longitude }; },
      () => {}, { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { status: 'AVAILABLE' };
    if (filter.type)     params.type     = filter.type;
    if (filter.category) params.category = filter.category;
    if (filter.q)        params.q        = filter.q;
    if (activeTag)       params.tags     = activeTag;
    if (posRef.current)  { params.lat = posRef.current.lat; params.lng = posRef.current.lng; }
    try { setItems(await getLFItems(params)); }
    catch { setMsg('❌ Failed to load items.'); }
    finally { setLoading(false); }
  }, [filter, activeTag]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getLFTopTags().then(setTopTags).catch(() => {}); }, []);

  async function handleInteract(id, message) {
    setInteractBusy(true);
    try {
      await interactLFItem(id, message);
      setInteractTarget(null);
      setMsg('✅ Submitted! You can track it in the Pending tab.');
      onRefreshNotifs();
      load();
      onGoToPending();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.detail || 'Could not submit.'));
      setInteractTarget(null);
    } finally { setInteractBusy(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this item?')) return;
    try { await deleteLFItem(id); setMsg('✅ Deleted.'); load(); }
    catch (err) { setMsg('❌ ' + (err.response?.data?.detail || 'Error.')); }
  }

  async function handleEditSave(data) {
    await editLFItem(editTarget.id, data);
    setEditTarget(null);
    setMsg('✅ Updated.');
    load();
  }

  if (editTarget) {
    return (
      <div>
        <h4 style={{ marginBottom: '1rem' }}>Edit Item</h4>
        <LFForm initial={{ ...editTarget, tags: (editTarget.tags || []).join(', ') }}
          categories={categories} isEdit
          onSave={handleEditSave} onCancel={() => setEditTarget(null)} />
      </div>
    );
  }

  return (
    <div>
      {msg && (
        <div style={{
          padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: msg.startsWith('✅') ? '#166534' : '#991b1b', fontSize: '0.875rem',
        }}>{msg}</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <input className="search-input" style={{ flex: '1 1 200px' }}
          placeholder="🔍 Search items, tags…"
          value={filter.q} onChange={e => setFilter(p => ({ ...p, q: e.target.value }))} />
        <select className="category-select" value={filter.type}
          onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}>
          <option value="">All Types</option>
          <option value="LOST">😟 Lost</option>
          <option value="FOUND">😊 Found</option>
        </select>
        <select className="category-select" value={filter.category}
          onChange={e => setFilter(p => ({ ...p, category: e.target.value }))}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <button className="btn" onClick={load} style={{ fontSize: '0.85rem' }}>🔄</button>
      </div>

      {topTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
          {topTags.map(({ tag }) => (
            <button key={tag} className="btn"
              style={{
                fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 999,
                background: activeTag === tag ? '#1d4ed8' : '#eff6ff',
                color: activeTag === tag ? '#fff' : '#1d4ed8',
                border: '1px solid #bfdbfe',
              }}
              onClick={() => setActiveTag(p => p === tag ? '' : tag)}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      {loading
        ? <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading…</p>
        : items.length === 0
          ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              <p>No items found. Try adjusting filters or post a new item.</p>
            </div>
          : <div style={GRID}>
              {items.map(item => (
                <ItemCard key={item.id} item={item} currentUser={user}
                  onInteract={setInteractTarget}
                  onEdit={setEditTarget}
                  onDelete={handleDelete} />
              ))}
            </div>
      }

      <InteractModal item={interactTarget} busy={interactBusy}
        onConfirm={handleInteract} onCancel={() => setInteractTarget(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post Tab — unified single form (LOST or FOUND toggled in form)
// ---------------------------------------------------------------------------
function PostTab({ categories, onPosted }) {
  const [done,        setDone]        = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  async function handleSave(data) {
    const created = await createLFItem(data);
    setDone(created);
    try { setSuggestions(await getLFSuggestions(created.id)); } catch { /**/ }
    onPosted?.();
  }

  if (done && suggestions.length > 0) {
    const opposite = done.item_type === 'LOST' ? 'Found' : 'Lost';
    return (
      <div>
        <div style={{ background: '#dcfce7', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: '#15803d' }}>
          ✅ Posted! Here are <strong>suggested {opposite} items</strong> that may match:
        </div>
        <div style={GRID}>
          {suggestions.map(item => <ItemCard key={item.id} item={item} compact />)}
        </div>
        <button className="btn btn-primary" style={{ marginTop: '1rem' }}
          onClick={() => { setDone(null); setSuggestions([]); }}>+ Post Another</button>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <div style={{ background: '#dcfce7', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.88rem', color: '#15803d' }}>
          ✅ Your {done.item_type.toLowerCase()} item has been posted!
        </div>
        <button className="btn btn-primary" onClick={() => setDone(null)}>+ Post Another</button>
      </div>
    );
  }

  return <LFForm categories={categories} onSave={handleSave} />;
}

// ---------------------------------------------------------------------------
// Pending Tab — items in PENDING state where current user is reporter or interactor
// Reporter: sees [Received/Handed Over] + [Revert] + interactor's contact
// Interactor: sees reporter's contact + waiting message
// ---------------------------------------------------------------------------
function PendingTab({ onRefreshNotifs }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');
  const [busy,    setBusy]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getPendingLFItems()); }
    catch { setMsg('❌ Failed to load pending items.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(id) {
    if (!window.confirm('Confirm resolution? This marks the item as fully resolved.')) return;
    setBusy(true);
    try {
      await resolveLFItem(id);
      setMsg('✅ Marked as resolved and moved to History.');
      onRefreshNotifs();
      load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.detail || 'Error.'));
    } finally { setBusy(false); }
  }

  async function handleRevert(id) {
    if (!window.confirm('Revert this interaction? The item will return to the public board.')) return;
    setBusy(true);
    try {
      await revertLFItem(id);
      setMsg('✅ Reverted. The item is back on the board.');
      onRefreshNotifs();
      load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.detail || 'Error.'));
    } finally { setBusy(false); }
  }

  return (
    <div>
      {msg && (
        <div style={{
          padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: msg.startsWith('✅') ? '#166534' : '#991b1b', fontSize: '0.875rem',
        }}>{msg}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Items awaiting confirmation from the reporter.
        </p>
        <button className="btn" onClick={load} style={{ fontSize: '0.82rem' }}>🔄</button>
      </div>

      {loading
        ? <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        : items.length === 0
          ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              <p>No pending items. Interactions will appear here.</p>
            </div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map(item => (
                <PendingItemCard key={item.id} item={item}
                  onResolve={handleResolve} onRevert={handleRevert} busy={busy} />
              ))}
            </div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Tab — RESOLVED items where user was involved (security sees all)
// ---------------------------------------------------------------------------
function HistoryTab() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getHistoryLFItems()); }
    catch { setMsg('❌ Failed to load history.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {msg && (
        <div style={{
          padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: '#fee2e2', color: '#991b1b', fontSize: '0.875rem',
        }}>{msg}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Resolved items you were involved in.
        </p>
        <button className="btn" onClick={load} style={{ fontSize: '0.82rem' }}>🔄</button>
      </div>

      {loading
        ? <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        : items.length === 0
          ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📜</div>
              <p>No resolved items yet.</p>
            </div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map(item => (
                <div key={item.id} style={{
                  ...CARD_STYLE,
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  gap: '0.85rem',
                }}>
                  <div style={{ width: 56, height: 56, flexShrink: 0, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                    {item.image_effective
                      ? <img src={item.image_effective} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : item.category_icon || '📦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.title}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      <span style={{
                        background: item.item_type === 'LOST' ? '#fee2e2' : '#dcfce7',
                        color: item.item_type === 'LOST' ? '#991b1b' : '#15803d',
                        borderRadius: 4, padding: '0.1rem 0.35rem', fontSize: '0.68rem', fontWeight: 700, marginRight: 6,
                      }}>{item.item_type}</span>
                      📍 {item.location_name || '—'} · {timeAgo(item.date_reported)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem',
                    borderRadius: 6, background: '#dcfce7', color: '#15803d', flexShrink: 0,
                  }}>✅ RESOLVED</span>
                </div>
              ))}
            </div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// My Activity Tab — all items posted by user (any status) + interactions
// ---------------------------------------------------------------------------
function MyActivityTab({ categories }) {
  const [myItems,    setMyItems]    = useState([]);
  const [claims,     setClaims]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState('items');
  const [msg,        setMsg]        = useState('');
  const [editTarget, setEditTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, c] = await Promise.all([getMyLFItems(), getMyClaims()]);
      setMyItems(i); setClaims(c);
    } catch { /**/ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this item?')) return;
    try { await deleteLFItem(id); setMsg('✅ Deleted.'); load(); }
    catch (err) { setMsg('❌ ' + (err.response?.data?.detail || 'Error.')); }
  }

  async function handleEditSave(data) {
    await editLFItem(editTarget.id, data);
    setEditTarget(null);
    setMsg('✅ Updated.');
    load();
  }

  if (editTarget) {
    return (
      <div>
        <h4 style={{ marginBottom: '1rem' }}>Edit Item</h4>
        <LFForm initial={{ ...editTarget, tags: (editTarget.tags || []).join(', ') }}
          categories={categories} isEdit
          onSave={handleEditSave} onCancel={() => setEditTarget(null)} />
      </div>
    );
  }

  // Status badge for my posts
  function postStatusChip(s) {
    const map = {
      AVAILABLE: { bg: '#eff6ff', color: '#1d4ed8', label: 'Active' },
      PENDING:   { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
      RESOLVED:  { bg: '#dcfce7', color: '#15803d', label: 'Resolved' },
    };
    const { bg, color, label } = map[s] || { bg: '#f3f4f6', color: '#374151', label: s };
    return (
      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 6, background: bg, color }}>
        {label}
      </span>
    );
  }

  // Interaction status badge
  function claimStatusChip(s) {
    const map = {
      PENDING:   { bg: '#fef3c7', color: '#92400e' },
      RESOLVED:  { bg: '#dcfce7', color: '#15803d' },
      CANCELLED: { bg: '#fee2e2', color: '#991b1b' },
    };
    const { bg, color } = map[s] || { bg: '#f3f4f6', color: '#374151' };
    return (
      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 6, background: bg, color }}>
        {s}
      </span>
    );
  }

  return (
    <div>
      {msg && (
        <div style={{
          padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: msg.startsWith('✅') ? '#166534' : '#991b1b', fontSize: '0.875rem',
        }}>{msg}</div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[['items', `📦 My Posts (${myItems.length})`], ['claims', `🏷️ My Interactions (${claims.length})`]].map(([v, l]) => (
          <button key={v} className={`tab-btn${view === v ? ' active' : ''}`}
            style={{ fontSize: '0.85rem' }} onClick={() => setView(v)}>{l}</button>
        ))}
        <button className="btn" onClick={load} style={{ fontSize: '0.82rem', marginLeft: 'auto' }}>🔄</button>
      </div>

      {loading
        ? <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        : view === 'items'
          ? myItems.length === 0
            ? <p style={{ color: 'var(--text-secondary)' }}>You haven't posted any items yet.</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {myItems.map(item => (
                  <div key={item.id} style={{
                    ...CARD_STYLE,
                    flexDirection: 'row', alignItems: 'center',
                    padding: '0.75rem 1rem', gap: '0.85rem',
                  }}>
                    <div style={{ width: 56, height: 56, flexShrink: 0, background: '#f3f4f6', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      {item.image_effective
                        ? <img src={item.image_effective} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : item.category_icon || '📦'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.title}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        📍 {item.location_name || '—'} · {timeAgo(item.date_reported)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                      {postStatusChip(item.status)}
                      {item.status === 'AVAILABLE' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => setEditTarget(item)}>✏️</button>
                          <button className="btn" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
                            onClick={() => handleDelete(item.id)}>🗑️</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
          : claims.length === 0
            ? <p style={{ color: 'var(--text-secondary)' }}>You haven't interacted with any items yet.</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {claims.map(c => (
                  <div key={c.id} style={{
                    ...CARD_STYLE,
                    flexDirection: 'row', alignItems: 'flex-start',
                    padding: '0.85rem 1rem', gap: '0.9rem',
                  }}>
                    {c.item_image && (
                      <img src={c.item_image} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.item_title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        📍 {c.item_location || '—'} · {c.item_type}
                      </div>
                      {c.message && (
                        <div style={{ fontSize: '0.8rem', marginTop: 4, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          "{c.message}"
                        </div>
                      )}
                    </div>
                    {claimStatusChip(c.status)}
                  </div>
                ))}
              </div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function LostFound() {
  const { user } = useAuth();
  const [tab,        setTab]        = useState('dashboard');
  const [categories, setCategories] = useState([]);
  const [notifs,     setNotifs]     = useState([]);

  useEffect(() => { getLFCategories().then(setCategories).catch(() => {}); }, []);

  const refreshNotifs = useCallback(() => {
    getLFNotifications().then(setNotifs).catch(() => {});
  }, []);

  useEffect(() => { refreshNotifs(); }, [refreshNotifs]);
  useEffect(() => {
    const id = setInterval(refreshNotifs, 60000);
    return () => clearInterval(id);
  }, [refreshNotifs]);

  const TABS = [
    { id: 'dashboard', label: '🔍 Browse' },
    { id: 'post',      label: '📮 Report Item' },
    { id: 'pending',   label: '⏳ Pending' },
    { id: 'history',   label: '📜 History' },
    { id: 'activity',  label: '📋 My Activity' },
  ];

  return (
    <section className="content-section active">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <SectionHeader
          title="Lost & Found"
          subtitle="Report lost items, claim found ones, help your campus community"
        />
        <NotifBell notifs={notifs} onMarkAll={() => {
          markAllLFNotifsRead().catch(() => {});
          setNotifs(p => p.map(n => ({ ...n, is_read: true })));
        }} />
      </div>

      <div className="tab-navigation" style={{ marginBottom: '1.25rem' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <DashboardTab
          user={user}
          categories={categories}
          onRefreshNotifs={refreshNotifs}
          onGoToPending={() => setTab('pending')}
        />
      )}
      {tab === 'post'     && (
        <PostTab
          categories={categories}
          onPosted={() => { refreshNotifs(); setTab('activity'); }}
        />
      )}
      {tab === 'pending'  && <PendingTab onRefreshNotifs={refreshNotifs} />}
      {tab === 'history'  && <HistoryTab />}
      {tab === 'activity' && <MyActivityTab categories={categories} />}
    </section>
  );
}
