import { useState } from 'react';
import { SectionHeader } from '../components/ui.jsx';
import { useCart } from '../context/CartContext.jsx';
import { buggyTransactions } from '../data/mockData.js';

const ROUTES = [
  { from: 'Main Gate', to: 'Hostel Area', fare: 10 },
  { from: 'Library', to: 'Sports Ground', fare: 10 },
  { from: 'Main Building', to: 'IDC', fare: 15 },
  { from: 'Hostel Area', to: 'Market Gate', fare: 20 },
];

export default function BuggyPass() {
  const { balance, transactions, dispatch } = useCart();
  const [recharge, setRecharge] = useState('');
  const [txns, setTxns] = useState(buggyTransactions);

  function handleRecharge(e) {
    e.preventDefault();
    const amount = Number(recharge);
    if (!amount || amount < 10) return alert('Minimum recharge is ₹10');
    dispatch({ type: 'RECHARGE', amount });
    setTxns(prev => [{ type: 'Recharge', amount, date: new Date().toLocaleDateString(), balance: balance + amount }, ...prev]);
    setRecharge('');
    alert(`✅ ₹${amount} recharged!`);
  }

  return (
    <section className="content-section active">
      <SectionHeader title="Buggy Pass" subtitle="Digital campus buggy pass – recharge and ride" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Pass card */}
        <div style={{ background: 'var(--gradient-blue)', borderRadius: 'var(--radius-xl)', padding: '2rem', color: 'white' }}>
          <p style={{ opacity: 0.8, marginBottom: '0.5rem' }}>Campus Buggy Pass</p>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem' }}>₹{balance}</h2>
          <p style={{ opacity: 0.8, marginTop: '0.5rem' }}>Balance Available</p>
        </div>

        {/* Recharge */}
        <form onSubmit={handleRecharge} className="hostel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4>Recharge Pass</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[50, 100, 200, 500].map(amt => (
              <button key={amt} type="button" className="btn btn-secondary" onClick={() => setRecharge(String(amt))}>₹{amt}</button>
            ))}
          </div>
          <input className="search-input" type="number" value={recharge} onChange={e => setRecharge(e.target.value)} placeholder="Enter amount" />
          <button type="submit" className="btn btn-primary">Recharge Now</button>
        </form>
      </div>

      {/* Routes */}
      <h3 style={{ color: 'var(--iitb-blue-primary)', marginBottom: '1rem' }}>Available Routes</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {ROUTES.map(r => (
          <div key={r.from + r.to} className="hostel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🚌 {r.from} → {r.to}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong>₹{r.fare}</strong>
              <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => dispatch({ type: 'DEDUCT', amount: r.fare })}>Book</button>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <h3 style={{ color: 'var(--iitb-blue-primary)', marginBottom: '1rem' }}>Transaction History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {(transactions.length ? transactions : txns).map((t, i) => (
          <div key={i} className="hostel-card" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div><strong>{t.type}</strong><br /><span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.date}</span></div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: t.amount > 0 ? 'var(--success)' : 'var(--error)' }}>{t.amount > 0 ? '+' : ''}₹{t.amount}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bal: ₹{t.balance}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
