import { useState, useEffect } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getDoctorSchedule, refreshDoctorSchedule } from '../services/api.js';

// ─── static data (unchanged) ─────────────────────────────────────────────────

const VACCINATIONS = [
  { name: 'COVID-19 Booster', date: 'Every 6 months',  venue: 'Hospital OPD' },
  { name: 'Influenza',        date: 'Oct-Nov annually', venue: 'Hospital OPD' },
  { name: 'Hepatitis B',      date: 'On request',       venue: 'Hospital OPD' },
  { name: 'Typhoid',          date: 'On request',       venue: 'Hospital OPD' },
];

const OPD_TIMINGS = [
  { dept: 'General Medicine', days: 'Mon–Sat',        timing: '9 AM – 1 PM, 5 PM – 8 PM' },
  { dept: 'Dental',           days: 'Mon–Sat',        timing: '9 AM – 5 PM' },
  { dept: 'Orthopedic',       days: 'Tue, Thu, Sat',  timing: '9 AM – 12 PM' },
  { dept: 'Gynecology',       days: 'Mon, Wed, Fri',  timing: '10 AM – 1 PM' },
  { dept: 'Ophthalmology',    days: 'Fri',            timing: '2 PM – 5 PM' },
  { dept: 'Psychiatry',       days: 'Wed, Fri',       timing: '3 PM – 6 PM' },
];

const CATEGORY_META = {
  main_opd:            { label: 'Main OPD',            icon: '🏥', color: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
  general_opd:         { label: 'General OPD',         icon: '👨‍⚕️', color: '#dcfce7', border: '#86efac', text: '#15803d' },
  visiting_specialist: { label: 'Visiting Specialist', icon: '🩺', color: '#fef3c7', border: '#fde68a', text: '#92400e' },
  on_leave:            { label: "Dr's on Leave",        icon: '🏖️', color: '#fee2e2', border: '#fca5a5', text: '#b91c1c' },
};

const TABS = ['Doctors', 'Vaccination', 'OPD Timings'];

// ─── helpers ──────────────────────────────────────────────────────────────────

function pill(color, label) {
  const map = {
    blue:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    green:  { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
    yellow: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    red:    { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
    gray:   { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' },
  };
  const s = map[color] || map.gray;
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem',
      borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

// ─── Doctor card ─────────────────────────────────────────────────────────────

function DoctorCard({ doc, catKey }) {
  const isLeave = catKey === 'on_leave';
  return (
    <div className="request-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--iitb-blue-primary)' }}>
        {isLeave ? '🏖️' : '👨‍⚕️'} {doc.name}
      </div>
      {isLeave ? (
        <div style={{ fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600 }}>
          On leave till: {doc.room}
        </div>
      ) : (
        <>
          {doc.room && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              🚪 Room: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doc.room}</span>
            </div>
          )}
          {doc.timing && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              🕐 {doc.timing}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({ catKey, docs }) {
  if (!docs || docs.length === 0) return null;
  const meta = CATEGORY_META[catKey] || { label: catKey, icon: '👩‍⚕️', color: '#f3f4f6', border: '#e5e7eb', text: '#374151' };
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        background: meta.color, color: meta.text, border: `1px solid ${meta.border}`,
        borderRadius: 8, padding: '0.35rem 0.9rem', fontSize: '0.82rem',
        fontWeight: 700, marginBottom: '0.75rem',
      }}>
        {meta.icon} {meta.label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem' }}>
        {docs.map((doc, i) => <DoctorCard key={i} doc={doc} catKey={catKey} />)}
      </div>
    </div>
  );
}

// ─── Doctors tab ─────────────────────────────────────────────────────────────

function DoctorsTab({ isAdmin }) {
  const [schedule,    setSchedule]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState('');
  const [shift,       setShift]       = useState('morning');
  const [refreshing,  setRefreshing]  = useState(false);

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

  if (loading) return <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Loading schedule…</p>;
  if (err)     return <p style={{ color: '#dc2626', textAlign: 'center', padding: '2rem' }}>{err}</p>;
  if (!schedule) return null;

  const shiftData = schedule[shift] || {};
  const lastUpdated = schedule.last_updated
    ? new Date(schedule.last_updated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {/* Shift toggle */}
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

      {/* Category sections */}
      {Object.entries(shiftData).map(([catKey, docs]) => (
        <CategorySection key={catKey} catKey={catKey} docs={docs} />
      ))}
    </div>
  );
}

// ─── Page root ───────────────────────────────────────────────────────────────

export default function Hospital() {
  const { user } = useAuth();
  const isAdmin  = user?.is_staff || false;
  const [tab, setTab] = useState('Doctors');

  return (
    <section className="content-section active">
      <SectionHeader title="Hospital Services" subtitle="Doctor schedule, vaccination, and OPD timings" />

      {/* Tab nav */}
      <div className="tab-navigation" style={{ marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'Doctors'      && '👨‍⚕️ Doctors'}
            {t === 'Vaccination'  && '💉 Vaccination'}
            {t === 'OPD Timings' && '🕐 OPD Timings'}
          </button>
        ))}
      </div>

      {tab === 'Doctors' && <DoctorsTab isAdmin={isAdmin} />}

      {tab === 'Vaccination' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {VACCINATIONS.map(v => (
            <div key={v.name} className="hostel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4>💉 {v.name}</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>📅 {v.date} | 📍 {v.venue}</p>
              </div>
              <button className="btn btn-primary" onClick={() => alert(`Registered for ${v.name}!`)}>Register</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'OPD Timings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {OPD_TIMINGS.map(o => (
            <div key={o.dept} className="hostel-card" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h4>🏥 {o.dept}</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{o.days}</p>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--iitb-blue-primary)' }}>{o.timing}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
