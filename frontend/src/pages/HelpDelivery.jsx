import { useState } from 'react';
import { SectionHeader, StatusBadge } from '../components/ui.jsx';
import Tabs from '../components/Tabs.jsx';
import { requests } from '../data/mockData.js';

const REWARD_POINTS = 120;
const REWARDS = [
  { icon: '🍕', title: 'Free Meal Voucher', points: 100 },
  { icon: '☕', title: 'Coffee at SAC', points: 50 },
  { icon: '🎬', title: 'Movie Night Pass', points: 200 },
];

export default function HelpDelivery() {
  const [items, setItems] = useState(requests);
  const [form, setForm] = useState({ item: '', pickup: '', delivery: '', points: 25, urgency: 'normal' });

  function submitRequest(e) {
    e.preventDefault();
    if (!form.item || !form.pickup || !form.delivery) return alert('Please fill all fields');
    const newReq = { id: Date.now(), ...form, status: 'open' };
    setItems(prev => [newReq, ...prev]);
    setForm({ item: '', pickup: '', delivery: '', points: 25, urgency: 'normal' });
    alert('✅ Request posted!');
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Help & Delivery" subtitle="Request or fulfill campus errands for rewards" />

      <Tabs
        tabs={[
          { id: 'browse', label: 'Browse Requests' },
          { id: 'create', label: 'Create Request' },
          { id: 'rewards', label: 'Rewards' },
        ]}
        renderContent={(tab) => {
          if (tab === 'browse') return (
            <div className="requests-list">
              {items.map(req => (
                <div key={req.id} className="request-card">
                  <div className="request-header">
                    <h4>{req.item}</h4>
                    <span className={`status-badge ${req.urgency === 'urgent' ? 'error' : 'available'}`}>{req.urgency}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <span>📦 {req.pickup}</span>
                    <span>🏠 {req.delivery}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--iitb-blue-primary)' }}>🎁 {req.points} pts</span>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '1rem', width: '100%' }}
                    onClick={() => alert(`✅ You accepted: ${req.item}!\nYou'll earn ${req.points} reward points.`)}
                  >
                    Accept & Deliver
                  </button>
                </div>
              ))}
            </div>
          );

          if (tab === 'create') return (
            <form onSubmit={submitRequest} className="request-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 600 }}>
              <div className="form-group">
                <label>Item to Fetch</label>
                <input className="search-input" value={form.item} onChange={e => setForm(p => ({ ...p, item: e.target.value }))} placeholder="e.g. Stationery from Market Gate" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Pick-up Location</label>
                  <input className="search-input" value={form.pickup} onChange={e => setForm(p => ({ ...p, pickup: e.target.value }))} placeholder="e.g. Market Gate" />
                </div>
                <div className="form-group">
                  <label>Deliver To</label>
                  <input className="search-input" value={form.delivery} onChange={e => setForm(p => ({ ...p, delivery: e.target.value }))} placeholder="e.g. H8 Room 203" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Reward Points</label>
                  <select className="category-select" value={form.points} onChange={e => setForm(p => ({ ...p, points: Number(e.target.value) }))}>
                    {[25, 50, 75, 100].map(v => <option key={v} value={v}>{v} pts</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Urgency</label>
                  <select className="category-select" value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Post Request</button>
            </form>
          );

          return (
            <div>
              <div className="rewards-dashboard">
                <div className="rewards-card">
                  <h3>My Reward Points</h3>
                  <div className="points-display">{REWARD_POINTS}</div>
                  <p>Points from {Math.floor(REWARD_POINTS / 25)} completed requests</p>
                </div>
              </div>
              <div className="reward-options">
                {REWARDS.map(r => (
                  <div key={r.title} className="reward-option" onClick={() => alert(`Redeemed: ${r.title}!`)}>
                    <span>{r.icon} {r.title}</span>
                    <span>{r.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }}
      />
    </section>
  );
}
