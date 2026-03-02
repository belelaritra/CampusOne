import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import Tabs from '../components/Tabs.jsx';
import { marketplaceItems } from '../data/mockData.js';

const CATEGORIES = ['all', 'books', 'electronics', 'furniture', 'sports', 'clothing'];

export default function Marketplace() {
  const [items, setItems] = useState(marketplaceItems);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [form, setForm] = useState({ title: '', category: 'books', price: '', condition: 'good', contact: '' });

  function getSorted(arr) {
    const filtered = filter === 'all' ? arr : arr.filter(i => i.category === filter);
    return [...filtered].sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : b.id - a.id);
  }

  function submitListing(e) {
    e.preventDefault();
    const newItem = { id: Date.now(), ...form, price: Number(form.price), seller: 'You', date: new Date().toLocaleDateString() };
    setItems(prev => [newItem, ...prev]);
    setForm({ title: '', category: 'books', price: '', condition: 'good', contact: '' });
    alert('✅ Listing posted!');
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Marketplace" subtitle="Buy and sell items within campus" />
      <Tabs
        tabs={[{ id: 'browse', label: 'Browse' }, { id: 'sell', label: 'Sell Item' }]}
        renderContent={(tab) => {
          if (tab === 'browse') return (
            <>
              <div className="map-controls" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <select className="category-select" value={filter} onChange={e => setFilter(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
                </select>
                <select className="category-select" value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="newest">Newest First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1rem' }}>
                {getSorted(items).map(item => (
                  <div key={item.id} className="hostel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="tag">{item.category}</span>
                      <span className="tag">{item.condition}</span>
                    </div>
                    <h4>{item.title}</h4>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--iitb-blue-primary)', margin: '0.75rem 0' }}>₹{item.price.toLocaleString()}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Seller: {item.seller} | {item.date}</p>
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => alert(`Contact ${item.seller}: ${item.contact}`)}>Contact Seller</button>
                  </div>
                ))}
              </div>
            </>
          );

          return (
            <form onSubmit={submitListing} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 500 }}>
              <h4>Post a Listing</h4>
              <input className="search-input" placeholder="Item title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              <input className="search-input" type="number" placeholder="Price (₹)" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <select className="category-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="category-select" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>
                  {['like new', 'good', 'fair', 'poor'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input className="search-input" placeholder="Contact number" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} required />
              <button type="submit" className="btn btn-primary">Post Listing</button>
            </form>
          );
        }}
      />
    </section>
  );
}
