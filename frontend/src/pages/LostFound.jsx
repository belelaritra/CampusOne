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
  getLFTopLostLocations, getLFTopLostCategories,
} from '../services/api';

// ---------------------------------------------------------------------------
// Predefined IITB campus locations (no free-text allowed)
// ---------------------------------------------------------------------------
const LF_LOCATIONS = [
  { group: 'Academic & Common', items: [
    { value: 'main_gate',     label: 'Main Gate' },
    { value: 'main_building', label: 'Main Building' },
    { value: 'central_lib',   label: 'Central Library' },
    { value: 'lecture_hall',  label: 'Lecture Hall Complex' },
    { value: 'conv_hall',     label: 'Convocation Hall' },
    { value: 'kresit',        label: 'KReSIT' },
    { value: 'sjmsom',        label: 'SJMSOM' },
    { value: 'sac',           label: 'Students Activity Centre' },
    { value: 'gymkhana',      label: 'Students Gymkhana' },
    { value: 'gulmohar',      label: 'Gulmohar' },
    { value: 'shree_balaji',  label: 'Shree Balaji Fruit & Vegetable' },
  ]},
  { group: 'Hostels', items: [
    { value: 'hostel_1',    label: 'Hostel 1' },  { value: 'hostel_2',    label: 'Hostel 2' },
    { value: 'hostel_3',    label: 'Hostel 3' },  { value: 'hostel_4',    label: 'Hostel 4' },
    { value: 'hostel_5',    label: 'Hostel 5' },  { value: 'hostel_6',    label: 'Hostel 6' },
    { value: 'hostel_7',    label: 'Hostel 7' },  { value: 'hostel_8',    label: 'Hostel 8' },
    { value: 'hostel_9',    label: 'Hostel 9' },  { value: 'hostel_10',   label: 'Hostel 10' },
    { value: 'hostel_11',   label: 'Hostel 11' }, { value: 'hostel_12',   label: 'Hostel 12' },
    { value: 'hostel_13',   label: 'Hostel 13' }, { value: 'hostel_14',   label: 'Hostel 14' },
    { value: 'hostel_15',   label: 'Hostel 15' }, { value: 'hostel_16',   label: 'Hostel 16' },
    { value: 'hostel_17',   label: 'Hostel 17' }, { value: 'hostel_18',   label: 'Hostel 18' },
    { value: 'hostel_19',   label: 'Hostel 19' }, { value: 'hostel_21',   label: 'Hostel 21' },
    { value: 'tansa_house', label: 'Tansa House' },
  ]},
];

// Flat label map for display purposes
const LF_LOCATION_LABEL = Object.fromEntries(
  LF_LOCATIONS.flatMap(g => g.items.map(i => [i.value, i.label]))
);

// Coordinates for client-side GPS → nearest location resolution
const LF_LOCATION_COORDS = {
  main_gate:     [19.12845641460189, 72.91926132752846],
  gulmohar:      [19.129814529274448, 72.91533444403758],
  shree_balaji:  [19.135117507090506, 72.90574766165889],
  central_lib:   [19.13332, 72.91318], lecture_hall:  [19.13260, 72.91182],
  kresit:        [19.13400, 72.91090], sac:           [19.13100, 72.91550],
  gymkhana:      [19.13050, 72.91500], main_building: [19.13360, 72.91270],
  conv_hall:     [19.13220, 72.91050], sjmsom:        [19.13520, 72.90980],
  hostel_1:  [19.13046, 72.91560], hostel_2:  [19.13012, 72.91520],
  hostel_3:  [19.12988, 72.91490], hostel_4:  [19.12960, 72.91460],
  hostel_5:  [19.12940, 72.91420], hostel_6:  [19.12910, 72.91380],
  hostel_7:  [19.12880, 72.91350], hostel_8:  [19.12850, 72.91310],
  hostel_9:  [19.12820, 72.91280], hostel_10: [19.12790, 72.91250],
  hostel_11: [19.13200, 72.91650], hostel_12: [19.13180, 72.91680],
  hostel_13: [19.13250, 72.91700], hostel_14: [19.13270, 72.91720],
  hostel_15: [19.13290, 72.91740], hostel_16: [19.13310, 72.91760],
  hostel_17: [19.13330, 72.91780], hostel_18: [19.13350, 72.91800],
  hostel_19: [19.13370, 72.91820], hostel_21: [19.13390, 72.91840],
  tansa_house: [19.13420, 72.91860],
};

function gpsHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestLFLocation(lat, lng) {
  let bestKey = '', bestDist = Infinity;
  for (const [key, [plat, plng]] of Object.entries(LF_LOCATION_COORDS)) {
    const d = gpsHaversine(lat, lng, plat, plng);
    if (d < bestDist) { bestDist = d; bestKey = key; }
  }
  return bestKey;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDistance(m) {
  if (m == null) return null;
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
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
      background: '#f0fdf4', borderRadius: 8, padding: '0.4rem 0.6rem',
      fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span>👤 <strong>{name}</strong></span>
      {phone && (
        <span>
          📞 {phone}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer"
              style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>WhatsApp</a>
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
      <button className="btn"
        style={{ fontSize: '1.1rem', padding: '0.35rem 0.6rem', position: 'relative' }}
        onClick={() => { setOpen(p => !p); if (!open && unread) onMarkAll(); }}>
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
// Responsive square-card grid: 4 cols on wide, 3 on medium, 2 on tablet, 1 on mobile
const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '1rem',
  alignItems: 'start',
};

const CARD_BASE = {
  background: 'var(--bg-card,#fff)',
  border: '1px solid var(--border,#e5e7eb)',
  borderRadius: 16,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  transition: 'transform 0.15s, box-shadow 0.15s',
};

// Row card for pending / list views
const ROW_CARD = {
  ...CARD_BASE,
  flexDirection: 'row',
  alignItems: 'stretch',
  borderRadius: 12,
};

function typeBadge(type) {
  return {
    background: type === 'LOST' ? '#ef4444' : '#22c55e',
    color: '#fff', borderRadius: 5, fontSize: '0.65rem', fontWeight: 700,
    padding: '0.15rem 0.4rem', letterSpacing: '0.03em',
  };
}

// ---------------------------------------------------------------------------
// Square Item Card — used in Dashboard, History grid, suggestions
// ---------------------------------------------------------------------------
function ItemCard({ item, currentUser, onInteract, onEdit, onDelete, compact = false }) {
  const isLost     = item.item_type === 'LOST';
  const isOwner    = item.reporter_username === currentUser?.username;
  const canInteract = !isOwner && item.status === 'AVAILABLE' && !item.user_has_claimed;
  const canEdit     = isOwner && item.status === 'AVAILABLE';
  const canDel      = isOwner && item.status === 'AVAILABLE';

  const mapsUrl = item.latitude && item.longitude
    ? `https://www.google.com/maps?q=${item.latitude},${item.longitude}` : null;

  const ri = item.resolved_interaction; // for history cards

  return (
    <div style={CARD_BASE}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = CARD_BASE.boxShadow; }}
    >
      {/* Square image — exact 1:1 */}
      <div style={{ width: '100%', aspectRatio: '1/1', background: '#f3f4f6', position: 'relative', flexShrink: 0 }}>
        {item.image_effective
          ? <img src={item.image_effective} alt={item.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>
              {item.category_icon || '📦'}
            </div>
        }
        {/* LOST / FOUND badge */}
        <span style={{ position: 'absolute', top: 7, left: 7, ...typeBadge(item.item_type) }}>
          {item.item_type}
        </span>
        {/* Status badge (non-AVAILABLE) */}
        {item.status !== 'AVAILABLE' && (
          <span style={{
            position: 'absolute', top: 7, right: 7,
            background: item.status === 'RESOLVED' ? '#dcfce7' : '#fef3c7',
            color: item.status === 'RESOLVED' ? '#15803d' : '#92400e',
            borderRadius: 5, fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem',
          }}>{item.status}</span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
        <strong style={{ fontSize: '0.88rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.title}
        </strong>

        {/* Category + tags */}
        {(item.category_name || item.tags?.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
            {item.category_name && (
              <span style={{ fontSize: '0.67rem', background: '#f3f4f6', borderRadius: 4, padding: '0.12rem 0.35rem', color: '#374151' }}>
                {item.category_icon} {item.category_name}
              </span>
            )}
            {(item.tags || []).slice(0, 2).map(t => (
              <span key={t} style={{ fontSize: '0.67rem', background: '#eff6ff', borderRadius: 4, padding: '0.12rem 0.35rem', color: '#1d4ed8' }}>#{t}</span>
            ))}
          </div>
        )}

        {/* Location */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mapsUrl
              ? <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{item.location_name || 'View map'}</a>
              : (item.location_name || '—')}
          </span>
        </div>

        {/* Time + reporter */}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          🕐 {timeAgo(item.date_reported)}
          {' · '}
          {isLost ? '😟' : '😊'} {item.reporter_name || item.reporter_username}
        </div>

        {/* History-specific: who found + resolved date */}
        {ri && (
          <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 2 }}>
            ✅ Found by <strong>{ri.interactor_name}</strong>
            {ri.resolved_at && <> · {fmtDate(ri.resolved_at)}</>}
          </div>
        )}

        {/* Distance */}
        {item.distance_meters != null && (
          <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>🗺️ {fmtDistance(item.distance_meters)}</div>
        )}

        {/* Action buttons */}
        {!compact && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: 'auto', paddingTop: '0.4rem' }}>
            {canInteract && (
              <button className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.28rem 0.6rem', flex: 1 }}
                onClick={() => onInteract && onInteract(item)}>
                {isLost ? '🙋 I Found It' : '🏷️ Claim'}
              </button>
            )}
            {item.user_has_claimed && (
              <span style={{ fontSize: '0.73rem', color: '#92400e', fontWeight: 600, padding: '0.28rem 0' }}>⏳ Pending</span>
            )}
            {canEdit && (
              <button className="btn"
                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem' }}
                onClick={() => onEdit && onEdit(item)}>✏️</button>
            )}
            {canDel && (
              <button className="btn"
                style={{ fontSize: '0.75rem', padding: '0.28rem 0.55rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
                onClick={() => onDelete && onDelete(item.id)}>🗑️</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending Item Card — square card with all info + role-based action buttons
// ---------------------------------------------------------------------------
function PendingItemCard({ item, onResolve, onRevert, busy }) {
  const isLost       = item.item_type === 'LOST';
  const isReporter   = item.is_reporter;
  const isInteractor = item.is_interactor;
  const interaction  = item.active_interaction;
  const canResolve   = item.can_resolve;   // from backend — mirrors resolve() permission
  const canRevert    = item.can_revert;    // from backend — mirrors revert() permission
  const bySecOffice  = item.contact_type === 'SECURITY';

  const mapsUrl = item.latitude && item.longitude
    ? `https://www.google.com/maps?q=${item.latitude},${item.longitude}` : null;

  return (
    <div style={CARD_BASE}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = CARD_BASE.boxShadow; }}
    >
      {/* Image — 4:3 aspect */}
      <div style={{ width: '100%', aspectRatio: '4/3', background: '#f3f4f6', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
        {item.image_effective
          ? <img src={item.image_effective} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>
              {item.category_icon || '📦'}
            </div>
        }
        {/* LOST/FOUND badge */}
        <span style={{ position: 'absolute', top: 7, left: 7, ...typeBadge(item.item_type) }}>
          {item.item_type}
        </span>
        {/* Security badge */}
        {bySecOffice && (
          <span style={{
            position: 'absolute', top: 7, right: 7,
            background: '#fef3c7', color: '#92400e', borderRadius: 5,
            fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem',
          }}>
            🏢 Security
          </span>
        )}
        {/* PENDING status */}
        <span style={{
          position: 'absolute', bottom: 7, right: 7,
          background: '#fef3c7', color: '#92400e', borderRadius: 5,
          fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem',
        }}>
          ⏳ PENDING
        </span>
      </div>

      {/* Card body */}
      <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.28rem', flex: 1 }}>
        <strong style={{ fontSize: '0.88rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.title}
        </strong>

        {/* Category */}
        {item.category_name && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.67rem', background: '#f3f4f6', borderRadius: 4, padding: '0.12rem 0.35rem', color: '#374151' }}>
              {item.category_icon} {item.category_name}
            </span>
          </div>
        )}

        {/* Location + distance */}
        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mapsUrl
              ? <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{item.location_name || 'View map'}</a>
              : (item.location_name || '—')}
          </span>
          {item.distance_meters != null && (
            <span style={{ flexShrink: 0, color: '#6b7280' }}>· 🗺️ {fmtDistance(item.distance_meters)}</span>
          )}
        </div>

        {/* Date + reporter */}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          🕐 {timeAgo(item.date_reported)} · {isLost ? '😟' : '😊'} {item.reporter_name || item.reporter_username}
        </div>

        {/* Interaction message */}
        {interaction?.message && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            💬 "{interaction.message}"
          </div>
        )}

        {/* Contact chips */}
        {isReporter && interaction && (
          <ContactChip name={interaction.interactor_name} phone={interaction.interactor_phone} />
        )}
        {isInteractor && interaction && (
          <ContactChip name={interaction.reporter_name} phone={interaction.reporter_phone} />
        )}

        {/* Action buttons — shown based on can_resolve / can_revert from backend */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.3rem' }}>
          {canResolve && (
            <button className="btn btn-primary" disabled={busy}
              style={{ fontSize: '0.74rem', padding: '0.26rem 0.65rem', flex: 1 }}
              onClick={() => onResolve && onResolve(item.id)}>
              {isLost ? '✅ Received' : '✅ Handed Over'}
            </button>
          )}
          {canRevert && (
            <button className="btn" disabled={busy}
              style={{ fontSize: '0.74rem', padding: '0.26rem 0.55rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
              onClick={() => onRevert && onRevert(item.id)}>
              ↩️ Revert
            </button>
          )}
          {isInteractor && !canResolve && !canRevert && (
            <span style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 500, paddingTop: '0.2rem' }}>
              ⏳ Awaiting reporter confirmation
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interact Modal
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
            {isLost ? 'Where did you find it? (optional)' : 'How can you prove ownership? (optional)'}
          </label>
          <textarea className="search-input" rows={3} style={{ resize: 'vertical' }}
            placeholder={isLost ? 'Describe where you found it…' : 'Describe identifying features…'}
            value={msg} onChange={e => setMsg(e.target.value)} />
        </div>
        {item.contact_type === 'SECURITY' && (
          <div style={{ background: '#fef3c7', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.82rem', marginTop: '0.75rem' }}>
            🏢 This item is at the <strong>Security Office</strong>. Bring ID proof.
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
// Item Form — unified create/edit with type selector
// ---------------------------------------------------------------------------
const EMPTY_FORM = {
  item_type: 'LOST', title: '', description: '',
  category: '', tags: '', image: null, image_url: '',
  location_name: '', latitude: null, longitude: null,
  collect_from: 'ME', id_card_number: '',
};

function LFForm({ initial, categories, onSave, onCancel, isEdit = false }) {
  // Normalize initial: map read-serializer field names (contact_type/roll_number) → form names
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...initial,
    collect_from:   initial?.contact_type   || 'ME',
    id_card_number: initial?.roll_number    || '',
    // If existing location_name is not in our predefined list, reset to empty
    location_name: LF_LOCATION_LABEL[initial?.location_name] ? (initial?.location_name || '') : '',
  });
  const [preview, setPreview]   = useState(initial?.image_effective || null);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const fileRef = useRef();

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) { setForm(p => ({ ...p, image: f })); setPreview(URL.createObjectURL(f)); }
  }

  function handleGPS() {
    if (!navigator.geolocation) return alert('Geolocation not supported.');
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const nearest = nearestLFLocation(lat, lng);
        setForm(p => ({ ...p, latitude: lat, longitude: lng, location_name: nearest }));
        setGpsLoading(false);
      },
      () => { alert('Could not get location. Please select manually.'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const isFound = form.item_type === 'FOUND';
  const selectedCat = categories.find(c => c.id === Number(form.category));
  const isIDCat = isFound && selectedCat?.name?.toLowerCase().includes('id');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Item name is required.');
    if (!form.location_name) return setError('Please select a location or use GPS.');
    if (isIDCat && !form.id_card_number.trim()) return setError('Roll number on ID card is required.');
    setBusy(true);
    try {
      const tagsList = form.tags
        ? form.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];
      const payload = {
        item_type:      form.item_type,
        title:          form.title.trim(),
        description:    form.description.trim(),
        category:       form.category || undefined,
        tags:           tagsList,
        location_name:  form.location_name,
        collect_from:   isFound ? form.collect_from : 'ME',
        id_card_number: isIDCat ? form.id_card_number.trim() : '',
      };
      if (form.latitude  != null) payload.latitude  = form.latitude;
      if (form.longitude != null) payload.longitude = form.longitude;
      if (form.image instanceof File) payload.image = form.image;
      else if (form.image_url)        payload.image_url = form.image_url;
      await onSave(payload);
    } catch (err) {
      const d = err.response?.data;
      setError(d && typeof d === 'object'
        ? Object.entries(d).map(([k, v]) => `${k}: ${[v].flat().join(', ')}`).join(' | ')
        : 'Failed to save. Please check all fields.');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 600 }}>
      {error && <div className="auth-error">{error}</div>}

      {/* Type selector */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {['LOST', 'FOUND'].map(t => (
          <label key={t} style={{
            flex: 1, textAlign: 'center', padding: '0.6rem', borderRadius: 10,
            cursor: isEdit ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem',
            border: form.item_type === t
              ? `2px solid ${t === 'LOST' ? '#ef4444' : '#22c55e'}`
              : '2px solid var(--border,#e5e7eb)',
            background: form.item_type === t
              ? (t === 'LOST' ? '#fee2e2' : '#dcfce7')
              : 'var(--bg-secondary,#f9f9f9)',
            color: form.item_type === t ? (t === 'LOST' ? '#991b1b' : '#15803d') : 'inherit',
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

      {/* Category (full width for LOST; half-width row with collect_from for FOUND) */}
      {isFound ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Category</label>
            <select name="category" className="category-select" value={form.category} onChange={handle}>
              <option value="">-- Select category --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Collection From</label>
            <select name="collect_from" className="category-select" value={form.collect_from} onChange={handle}>
              <option value="ME">📞 Me (finder)</option>
              <option value="SECURITY">🏢 Security Office</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label>Category</label>
          <select name="category" className="category-select" value={form.category} onChange={handle}>
            <option value="">-- Select category --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
      )}

      {/* ID Card number — FOUND + ID Card category only */}
      {isIDCat && (
        <div className="form-group">
          <label>Roll Number on ID Card *</label>
          <input name="id_card_number" className="search-input" value={form.id_card_number}
            onChange={handle} placeholder="e.g. 22B1234" maxLength={20} />
          <small style={{ color: 'var(--text-secondary)', marginTop: 3, display: 'block' }}>
            The owner will be notified automatically.
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
        <label>Tags <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(comma separated)</span></label>
        <input name="tags" className="search-input" value={form.tags}
          onChange={handle} placeholder="e.g. hp, laptop, silver" />
      </div>

      {/* Location — predefined dropdown only (no free text) */}
      <div className="form-group">
        <label>Location *</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select name="location_name" className="category-select" style={{ flex: 1 }}
            value={form.location_name} onChange={handle}>
            <option value="">-- Select campus location --</option>
            {LF_LOCATIONS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map(loc => (
                  <option key={loc.value} value={loc.value}>{loc.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="btn" style={{ flexShrink: 0, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            onClick={handleGPS} disabled={gpsLoading}>
            {gpsLoading ? '…' : '📍 Use GPS'}
          </button>
        </div>
        {form.latitude != null && form.longitude != null && (
          <small style={{ color: '#16a34a', marginTop: 3, display: 'block' }}>
            📍 GPS: {form.location_name ? LF_LOCATION_LABEL[form.location_name] : 'detected'} — coordinates stored
          </small>
        )}
      </div>

      <div className="form-group">
        <label>Image (optional)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}
            style={{ fontSize: '0.82rem' }}>📷 Upload</button>
          {preview && <img src={preview} alt="preview" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />}
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
// Dashboard Tab
// ---------------------------------------------------------------------------
function DashboardTab({ user, categories, onRefreshNotifs, onGoToPending }) {
  const [items,          setItems]         = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [topTags,        setTopTags]       = useState([]);
  const [activeTag,      setActiveTag]     = useState('');
  const [filter,         setFilter]        = useState({ type: '', category: '', q: '' });
  const [interactTarget, setInteractTarget] = useState(null);
  const [interactBusy,   setInteractBusy]   = useState(false);
  const [msg,            setMsg]           = useState('');
  const [editTarget,     setEditTarget]    = useState(null);
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
      setMsg('✅ Submitted! Track it in the Pending tab.');
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
    setEditTarget(null); setMsg('✅ Updated.'); load();
  }

  if (editTarget) {
    return (
      <div>
        <h4 style={{ marginBottom: '1rem' }}>Edit Item</h4>
        <LFForm initial={{ ...editTarget, tags: (editTarget.tags || []).join(', ') }}
          categories={categories} isEdit onSave={handleEditSave} onCancel={() => setEditTarget(null)} />
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

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <input className="search-input" style={{ flex: '1 1 180px' }}
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

      {/* Top tags */}
      {topTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
          {topTags.map(({ tag }) => (
            <button key={tag} className="btn"
              style={{
                fontSize: '0.7rem', padding: '0.18rem 0.5rem', borderRadius: 999,
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
              <p>No items found. Adjust filters or post a new item.</p>
            </div>
          : <div style={GRID}>
              {items.map(item => (
                <ItemCard key={item.id} item={item} currentUser={user}
                  onInteract={setInteractTarget} onEdit={setEditTarget} onDelete={handleDelete} />
              ))}
            </div>
      }

      <InteractModal item={interactTarget} busy={interactBusy}
        onConfirm={handleInteract} onCancel={() => setInteractTarget(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post Tab — unified form
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
          ✅ Posted! Here are suggested <strong>{opposite}</strong> items that may match:
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
// Pending Tab
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
      setMsg('✅ Marked as resolved. Moved to History.');
      onRefreshNotifs(); load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.detail || 'Error.'));
    } finally { setBusy(false); }
  }

  async function handleRevert(id) {
    if (!window.confirm('Revert interaction? Item will return to the public board.')) return;
    setBusy(true);
    try {
      await revertLFItem(id);
      setMsg('✅ Reverted. Item is back on the board.');
      onRefreshNotifs(); load();
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
              <p>No pending interactions yet.</p>
            </div>
          : <div style={GRID}>
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
// History Tab — square grid of RESOLVED items with who found + date
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
        <div style={{ padding: '0.65rem 1rem', borderRadius: 8, marginBottom: '1rem', background: '#fee2e2', color: '#991b1b', fontSize: '0.875rem' }}>
          {msg}
        </div>
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
          // Square card grid — same ItemCard, resolved_interaction auto-shows "Found by"
          : <div style={GRID}>
              {items.map(item => <ItemCard key={item.id} item={item} compact />)}
            </div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// My Activity Tab
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
    setEditTarget(null); setMsg('✅ Updated.'); load();
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

  function statusChip(s) {
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

  function claimChip(s) {
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
            // Square card grid for My Posts
            : <div style={GRID}>
                {myItems.map(item => (
                  <div key={item.id} style={{ ...CARD_BASE, position: 'relative' }}>
                    {/* Square image */}
                    <div style={{ width: '100%', aspectRatio: '1/1', background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', overflow: 'hidden' }}>
                      {item.image_effective
                        ? <img src={item.image_effective} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : item.category_icon || '📦'}
                    </div>
                    {/* Status badge overlay */}
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      {statusChip(item.status)}
                    </div>
                    {/* Type badge overlay */}
                    <div style={{ position: 'absolute', top: 8, left: 8 }}>
                      <span style={typeBadge(item.item_type)}>{item.item_type}</span>
                    </div>
                    <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                      <strong style={{ fontSize: '0.88rem', lineHeight: 1.3 }}>{item.title}</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        📍 {item.location_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        🕐 {timeAgo(item.date_reported)}
                      </div>
                      {/* Resolved: who found + date */}
                      {item.resolved_interaction && (
                        <div style={{ fontSize: '0.71rem', color: '#15803d' }}>
                          ✅ {item.item_type === 'LOST' ? 'Found' : 'Claimed'} by <strong>{item.resolved_interaction.interactor_name}</strong>
                          {item.resolved_interaction.resolved_at && <> · {fmtDate(item.resolved_interaction.resolved_at)}</>}
                        </div>
                      )}
                      {item.status === 'AVAILABLE' && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          <button className="btn" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', flex: 1 }}
                            onClick={() => setEditTarget(item)}>✏️ Edit</button>
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
            : <div style={GRID}>
                {claims.map(c => (
                  <div key={c.id} style={CARD_BASE}>
                    {/* Image — 4:3 aspect */}
                    <div style={{ width: '100%', aspectRatio: '4/3', background: '#f3f4f6', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
                      {c.item_image
                        ? <img src={c.item_image} alt={c.item_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>📦</div>
                      }
                      {/* LOST/FOUND badge */}
                      <span style={{ position: 'absolute', top: 7, left: 7, ...typeBadge(c.item_type) }}>
                        {c.item_type}
                      </span>
                      {/* Claim status badge */}
                      <div style={{ position: 'absolute', bottom: 7, right: 7 }}>
                        {claimChip(c.status)}
                      </div>
                    </div>
                    {/* Body */}
                    <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.28rem', flex: 1 }}>
                      <strong style={{ fontSize: '0.88rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.item_title}
                      </strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span>📍</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.item_location || '—'}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        🕐 {timeAgo(c.created_at)}
                      </div>
                      {c.message && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          "{c.message}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics Tab — Security only: top lost locations + top lost categories
// ---------------------------------------------------------------------------
function SquareAnalyticsGrid({ items, keyField, labelField, iconField, countField, accentColor, icon, showAll, onToggle }) {
  const shown = showAll ? items : items.slice(0, 10);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {shown.map((row, i) => (
          <div key={row[keyField]} style={{
            ...CARD_BASE,
            aspectRatio: '1/1', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '1rem',
            textAlign: 'center',
            borderTop: i === 0 ? '3px solid #ef4444' : i === 1 ? '3px solid #f97316' : i === 2 ? '3px solid #eab308' : `3px solid #e5e7eb`,
          }}>
            <div style={{ fontSize: '1.7rem', marginBottom: '0.3rem' }}>
              {iconField ? (row[iconField] || icon) : (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : icon)}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3, marginBottom: '0.4rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {row[labelField]}
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: accentColor, lineHeight: 1 }}>
              {row[countField]}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              item{row[countField] !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
      {items.length > 10 && (
        <button className="btn" onClick={onToggle} style={{ fontSize: '0.85rem' }}>
          {showAll ? 'Show Less' : `See More (${items.length - 10} more)`}
        </button>
      )}
    </>
  );
}

function AnalyticsTab({ user }) {
  const isSecurity = user?.is_security || user?.is_staff;
  const [locations,   setLocations]   = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [showAllLocs, setShowAllLocs] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);

  useEffect(() => {
    if (!isSecurity) { setLoading(false); return; }
    Promise.all([getLFTopLostLocations(), getLFTopLostCategories()])
      .then(([locs, cats]) => { setLocations(locs); setCategories(cats); })
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, [isSecurity]);

  if (!isSecurity) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
        <p>Analytics are only accessible to Security Office accounts.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>📊 Lost &amp; Found Analytics</h3>
        <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.6rem', borderRadius: 6, fontWeight: 600 }}>
          🏢 Security View
        </span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading analytics…</p>
      ) : error ? (
        <p style={{ color: '#991b1b' }}>{error}</p>
      ) : (
        <>
          {/* Top Lost Locations */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>🏨 Top Lost Item Locations</h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Campus locations with the most reported lost items
            </p>
            {locations.length === 0
              ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>No location data yet.</p>
              : <SquareAnalyticsGrid
                  items={locations} keyField="location_name"
                  labelField="location_name" iconField={null} countField="count"
                  accentColor="#ef4444" icon="📍"
                  showAll={showAllLocs} onToggle={() => setShowAllLocs(p => !p)}
                />
            }
          </div>

          {/* Top Lost Categories */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>📦 Top Lost Item Categories</h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Categories most frequently reported as lost
            </p>
            {categories.length === 0
              ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>No category data yet.</p>
              : <SquareAnalyticsGrid
                  items={categories} keyField="category_name"
                  labelField="category_name" iconField="category_icon" countField="count"
                  accentColor="#3b82f6" icon="📦"
                  showAll={showAllCats} onToggle={() => setShowAllCats(p => !p)}
                />
            }
          </div>
        </>
      )}
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

  const isSecurity = user?.is_security || user?.is_staff;

  const TABS = [
    { id: 'dashboard', label: '🔍 Browse' },
    { id: 'post',      label: '📮 Report Item' },
    { id: 'pending',   label: '⏳ Pending' },
    { id: 'history',   label: '📜 History' },
    { id: 'activity',  label: '📋 My Activity' },
    ...(isSecurity ? [{ id: 'analytics', label: '📊 Analytics' }] : []),
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
        <DashboardTab user={user} categories={categories}
          onRefreshNotifs={refreshNotifs} onGoToPending={() => setTab('pending')} />
      )}
      {tab === 'post'      && <PostTab categories={categories} onPosted={() => { refreshNotifs(); setTab('activity'); }} />}
      {tab === 'pending'   && <PendingTab onRefreshNotifs={refreshNotifs} />}
      {tab === 'history'   && <HistoryTab />}
      {tab === 'activity'  && <MyActivityTab categories={categories} />}
      {tab === 'analytics' && <AnalyticsTab user={user} />}
    </section>
  );
}
