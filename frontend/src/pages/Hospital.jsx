import { useState, useEffect } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getDoctorSchedule, refreshDoctorSchedule } from '../services/api.js';

// ─── time helpers ─────────────────────────────────────────────────────────────

/** Parse "8.30AM", "9:15AM", "3.00 PM" → minutes since midnight. */
function parseTime(str) {
  const m = str.match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ap  = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Return { start, end } in minutes from a (possibly multi-line) timing string. */
function timingBounds(timingStr) {
  if (!timingStr) return { start: Infinity, end: null };
  const times = timingStr
    .split('\n')
    .flatMap(line => Array.from(line.matchAll(/(\d{1,2})[.:](\d{2})\s*(AM|PM)/gi), m => parseTime(m[0])))
    .filter(t => t !== null);
  if (times.length === 0) return { start: Infinity, end: null };
  return { start: Math.min(...times), end: Math.max(...times) };
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// ─── static config ────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'opd',        label: 'OPD',               icon: '🏥', cats: ['main_opd', 'general_opd'] },
  { key: 'specialist', label: 'Visiting Specialist', icon: '🩺', cats: ['visiting_specialist'] },
  { key: 'leave',      label: "Dr's on Leave",       icon: '🏖️', cats: ['on_leave'] },
];

// ─── DoctorCard ───────────────────────────────────────────────────────────────

function DoctorCard({ doc, isLeave, now }) {
  const { end } = timingBounds(doc.timing);
  const done    = !isLeave && end !== null && now > end;

  return (
    <div className="request-card" style={{
      display: 'flex', flexDirection: 'column', gap: '0.3rem',
      opacity: done ? 0.45 : 1,
      background: done ? '#f9fafb' : undefined,
      transition: 'opacity 0.3s',
    }}>
      <div style={{
        fontWeight: 700, fontSize: '0.92rem',
        color: done ? 'var(--text-secondary)' : 'var(--iitb-blue-primary)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem',
      }}>
        <span>{isLeave ? '🏖️' : '👨‍⚕️'} {doc.name}</span>
        {done && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.45rem',
            borderRadius: 999, background: '#f3f4f6', color: '#6b7280',
            border: '1px solid #e5e7eb', whiteSpace: 'nowrap',
          }}>Done</span>
        )}
      </div>

      {isLeave ? (
        <div style={{ fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600 }}>
          On leave till: {doc.room}
        </div>
      ) : (
        <>
          {doc.room && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              🚪 Room: <span style={{ fontWeight: 600, color: done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{doc.room}</span>
            </div>
          )}
          {doc.timing && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {doc.timing.split('\n').map((line, i) => (
                <div key={i}>{i === 0 ? '🕐 ' : '\u00a0\u00a0\u00a0 '}{line}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Hospital() {
  const { user } = useAuth();
  const isAdmin  = user?.is_staff || false;

  const [schedule,   setSchedule]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState('');
  const [tab,        setTab]        = useState('opd');
  const [shift,      setShift]      = useState('morning');
  const [refreshing, setRefreshing] = useState(false);
  const [now,        setNow]        = useState(nowMinutes);

  // Tick every minute so "Done" badges appear automatically
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    getDoctorSchedule()
      .then(data => setSchedule(data))
      .catch(() => setErr('Could not load doctor schedule.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await refreshDoctorSchedule();
      setSchedule(data);
      setErr('');
    } catch {
      setErr('Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }

  const lastUpdated = schedule?.last_updated
    ? new Date(schedule.last_updated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  const activeSection = SECTIONS.find(s => s.key === tab);

  // Collect + sort docs for the active tab
  const docs = (() => {
    if (!schedule || !activeSection) return [];

    let raw;
    if (tab === 'leave') {
      // Merge both shifts, deduplicate by name
      const seen = new Set();
      raw = ['morning', 'afternoon']
        .flatMap(s => activeSection.cats.flatMap(cat => schedule[s]?.[cat] || []))
        .filter(d => { if (seen.has(d.name)) return false; seen.add(d.name); return true; });
    } else {
      raw = activeSection.cats.flatMap(cat => (schedule[shift]?.[cat] || []));
    }

    // Sort by earliest start time (ascending); no-timing entries go last
    return [...raw].sort((a, b) => timingBounds(a.timing).start - timingBounds(b.timing).start);
  })();

  const isLeaveTab = tab === 'leave';

  return (
    <section className="content-section active">
      <SectionHeader title="Hospital Services" subtitle="Doctor OPD schedule — updated nightly" />

      {/* Tab navigation */}
      <div className="tab-navigation" style={{ marginBottom: '1.25rem' }}>
        {SECTIONS.map(sec => (
          <button key={sec.key} className={`tab-btn${tab === sec.key ? ' active' : ''}`}
            onClick={() => setTab(sec.key)}>
            {sec.icon} {sec.label}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {/* Shift toggle — not shown for Leave tab */}
        {!isLeaveTab && (
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            {['morning', 'afternoon'].map(s => (
              <button key={s} onClick={() => setShift(s)} style={{
                padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                border: 'none', background: shift === s ? 'var(--iitb-blue-primary)' : '#fff',
                color: shift === s ? '#fff' : 'var(--text-primary)',
              }}>
                {s === 'morning' ? '🌅 Morning' : '🌆 Afternoon'}
              </button>
            ))}
          </div>
        )}

        {lastUpdated && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Updated: {lastUpdated}
          </span>
        )}

        {isAdmin && (
          <button className="btn btn-primary" style={{ fontSize: '0.8rem', marginLeft: 'auto' }}
            onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : '🔄 Refresh from Sheet'}
          </button>
        )}
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Loading schedule…</p>}
      {err     && <p style={{ color: '#dc2626', textAlign: 'center', padding: '1rem' }}>{err}</p>}

      {schedule && (
        docs.length === 0
          ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No entries for this {isLeaveTab ? 'section' : 'shift'}.</p>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem' }}>
              {docs.map((doc, i) => (
                <DoctorCard key={i} doc={doc} isLeave={isLeaveTab} now={now} />
              ))}
            </div>
      )}
    </section>
  );
}
