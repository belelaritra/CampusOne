import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { groups } from '../data/mockData.js';

const CATEGORIES = ['all', 'technical', 'cultural', 'sports'];

export default function Groups() {
  const [filter, setFilter] = useState('all');
  const [joined, setJoined] = useState({});

  const filtered = filter === 'all' ? groups : groups.filter(g => g.category === filter);

  return (
    <section className="content-section active">
      <SectionHeader title="Groups & Clubs" subtitle="Discover communities and join them" />

      <div className="map-controls" style={{ marginBottom: '1.5rem' }}>
        <select className="category-select" value={filter} onChange={e => setFilter(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      <div className="groups-grid">
        {filtered.map(g => (
          <div key={g.id} className="group-card">
            <span className="tag">{g.category}</span>
            <h4>{g.name}</h4>
            <p>{g.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <span>👥 {g.members} members</span>
              <span>🌐 {g.privacy}</span>
            </div>
            <button
              className={`btn ${joined[g.id] ? 'btn-secondary' : 'btn-primary'}`}
              style={{ marginTop: '1rem', width: '100%' }}
              onClick={() => setJoined(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
            >
              {joined[g.id] ? '✅ Joined' : 'Join Group'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
