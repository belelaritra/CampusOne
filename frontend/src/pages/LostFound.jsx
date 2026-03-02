import { useState } from 'react';
import { SectionHeader, Tag } from '../components/ui.jsx';
import { lostFoundItems } from '../data/mockData.js';

const CATEGORIES = ['all', 'electronics', 'books', 'ids', 'accessories'];

export default function LostFound() {
  const [items, setItems] = useState(lostFoundItems);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState({ type: 'lost', name: '', category: 'electronics', location: '', contact: '', tags: '' });

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.tags.some(t => t.includes(search.toLowerCase()));
    const matchCat = filter === 'all' || item.category === filter;
    const matchType = typeFilter === 'all' || item.type === typeFilter;
    return matchSearch && matchCat && matchType;
  });

  function submitReport(e) {
    e.preventDefault();
    const newItem = { id: Date.now(), ...form, date: new Date().toLocaleDateString(), tags: form.tags.split(',').map(t => t.trim()) };
    setItems(prev => [newItem, ...prev]);
    setForm({ type: 'lost', name: '', category: 'electronics', location: '', contact: '', tags: '' });
    alert('✅ Item reported!');
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Lost & Found" subtitle="Report lost items or claim found ones" />

      <div className="map-controls" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input className="search-input" placeholder="Search by name or tag…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="category-select" value={filter} onChange={e => setFilter(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
        <select className="category-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Lost & Found</option>
          <option value="lost">Lost Only</option>
          <option value="found">Found Only</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(item => (
            <div key={item.id} className="hostel-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h4>{item.name}</h4>
                <span className={`status-badge ${item.type === 'lost' ? 'error' : 'available'}`}>{item.type}</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>📍 {item.location} | 📅 {item.date}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                {item.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
              <button className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.875rem' }} onClick={() => alert(`Contact: ${item.contact}`)}>Contact</button>
            </div>
          ))}
        </div>

        {/* Report form */}
        <form onSubmit={submitReport} className="hostel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignSelf: 'start' }}>
          <h4>Report Item</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['lost', 'found'].map(t => (
              <button key={t} type="button" className={`btn ${form.type === t ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setForm(p => ({ ...p, type: t }))}>
                {t === 'lost' ? '😢 Lost' : '🎉 Found'}
              </button>
            ))}
          </div>
          {['name', 'location', 'contact'].map(field => (
            <input key={field} className="search-input" placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
          ))}
          <select className="category-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
            {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="search-input" placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
          <button type="submit" className="btn btn-primary">Submit Report</button>
        </form>
      </div>
    </section>
  );
}
