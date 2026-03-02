import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { outlets, menuItems } from '../data/mockData.js';
import { useCart } from '../context/CartContext.jsx';

export default function FoodOrdering() {
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const { dispatch } = useCart();

  function addToCart(item) {
    dispatch({ type: 'ADD_ITEM', payload: { ...item, outletName: selectedOutlet.name } });
    alert(`✅ ${item.name} added to cart!`);
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Food Ordering" subtitle="Order from campus outlets and canteens" />

      {!selectedOutlet ? (
        <>
          <h3 style={{ color: 'var(--iitb-blue-primary)', marginBottom: '1.5rem' }}>Available Outlets</h3>
          <div className="outlets-grid">
            {outlets.map(outlet => (
              <div key={outlet.id} className="outlet-card" onClick={() => setSelectedOutlet(outlet)}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{outlet.icon}</div>
                <h4>{outlet.name}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{outlet.hours}</p>
                <span className="status-badge available" style={{ marginTop: '0.5rem' }}>🟢 {outlet.status}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button className="btn-back" onClick={() => setSelectedOutlet(null)}>← Back to Outlets</button>
          <h3 style={{ color: 'var(--iitb-blue-primary)', marginBottom: '1.5rem' }}>
            {selectedOutlet.icon} {selectedOutlet.name} — Menu
          </h3>
          <div className="menu-items">
            {(menuItems[selectedOutlet.id] || []).map((item, i) => (
              <div key={i} className="outlet-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4>{item.name}</h4>
                  <p style={{ color: 'var(--iitb-blue-primary)', fontWeight: 700, fontSize: '1.25rem' }}>₹{item.price}</p>
                </div>
                <button className="btn btn-primary" onClick={() => addToCart(item)}>Add to Cart</button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
