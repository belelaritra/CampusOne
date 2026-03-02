import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { events } from '../data/mockData.js';

const CAT_COLORS = { technical: '#003D82', cultural: '#8B5CF6', sports: '#10B981', academic: '#F59E0B', social: '#EC4899' };
const CATEGORIES = ['all', 'technical', 'cultural', 'sports', 'academic', 'social'];

export default function Events() {
  const [filter, setFilter] = useState('all');
  const [subscribed, setSubscribed] = useState({});

  const filtered = filter === 'all' ? events : events.filter(e => e.category === filter);

  return (
    <section className="content-section active">
      <SectionHeader title="Events & Activities" subtitle="Campus events, workshops, and activities" />

      <div className="map-controls" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`tab-btn${filter === c ? ' active' : ''}`}
            onClick={() => setFilter(c)}
            style={{ fontSize: '0.85rem' }}
          >
            {c === 'all' ? 'All Events' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: '1.5rem' }}>
        {filtered.map(ev => (
          <div key={ev.id} className="hostel-card" style={{ borderLeft: `4px solid ${CAT_COLORS[ev.category] || '#003D82'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span className="tag" style={{ background: `${CAT_COLORS[ev.category]}15`, color: CAT_COLORS[ev.category] }}>{ev.category}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{ev.date}</span>
            </div>
            <h4>{ev.name}</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>{ev.description}</p>
            <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span>🕐 {ev.time}</span>
              <span>📍 {ev.location}</span>
              <span>🏛 {ev.organizer}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                className={`btn ${subscribed[ev.id] ? 'btn-secondary' : 'btn-primary'}`}
                style={{ flex: 1 }}
                onClick={() => setSubscribed(prev => ({ ...prev, [ev.id]: !prev[ev.id] }))}
              >
                {subscribed[ev.id] ? '✅ Subscribed' : '🔔 Subscribe'}
              </button>
              <button className="btn btn-secondary" onClick={() => alert(`Added ${ev.name} to calendar!`)}>+ Calendar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
