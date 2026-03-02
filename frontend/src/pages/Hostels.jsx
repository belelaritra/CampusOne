import { useState } from 'react';
import { SectionHeader, Card } from '../components/ui.jsx';
import Tabs from '../components/Tabs.jsx';
import { hostels, messMenus } from '../data/mockData.js';

const MEALS = [
  { key: 'breakfast', label: '🌅 Breakfast', time: '7:30 AM – 9:30 AM' },
  { key: 'lunch',     label: '🌞 Lunch',     time: '12:00 PM – 2:00 PM' },
  { key: 'snacks',    label: '☕ Snacks',    time: '4:30 PM – 5:30 PM' },
  { key: 'dinner',    label: '🌙 Dinner',    time: '8:00 PM – 10:00 PM' },
];

export default function Hostels() {
  const [selected, setSelected] = useState(null);

  return (
    <section className="content-section active">
      <SectionHeader title="Hostels & Mess" subtitle="View hostel occupancy and today's mess menu" />

      <Tabs
        tabs={[{ id: 'hostels', label: 'Hostels' }, { id: 'menu', label: 'Mess Menu' }]}
        renderContent={(tab) => {
          if (tab === 'hostels') {
            return (
              <div className="hostel-grid">
                {hostels.map(h => (
                  <div
                    key={h.id}
                    className="hostel-card"
                    onClick={() => setSelected(h)}
                    style={{ cursor: 'pointer', border: selected?.id === h.id ? '2px solid var(--iitb-blue-light)' : '' }}
                  >
                    <h4>🏠 {h.name}</h4>
                    <p>Capacity: <strong>{h.capacity}</strong></p>
                    <p>Current: <strong>{h.occupancy}</strong></p>
                    <div style={{ marginTop: '0.75rem', background: 'var(--blue-bg)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                      <div style={{ background: 'var(--gradient-blue)', height: '100%', width: `${(h.occupancy / h.capacity) * 100}%`, borderRadius: 8 }} />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {Math.round((h.occupancy / h.capacity) * 100)}% occupied
                    </p>
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', fontSize: '0.875rem' }} onClick={(e) => { e.stopPropagation(); setSelected(h); }}>
                      View Mess Menu
                    </button>
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div className="mess-timeline">
              {selected && <h3>{selected.name} — Mess Menu</h3>}
              {!selected && <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Select a hostel to see its mess menu, or view today's general menu below.</p>}
              {MEALS.map(meal => (
                <div key={meal.key} className="meal-section">
                  <div className="meal-time">{meal.label} ({meal.time})</div>
                  <div className="meal-items">
                    {messMenus[meal.key].map(item => (
                      <span key={item} className="meal-item">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }}
      />
    </section>
  );
}
