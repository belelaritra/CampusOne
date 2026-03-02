import { useNavigate } from 'react-router-dom';
import { SectionHeader } from '../components/ui.jsx';
import { dashboardCards } from '../data/mockData.js';
import { useApp } from '../context/AppContext.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();

  return (
    <section className="content-section active">
      <SectionHeader
        title={`Welcome back, ${user.name.split(' ')[0]}! 👋`}
        subtitle="IIT Bombay Campus Portal — Your unified student platform"
      />

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Hostel', value: user.hostel, icon: '🏠' },
          { label: 'Branch', value: user.branch, icon: '📚' },
          { label: 'Year', value: user.year, icon: '🎓' },
          { label: 'Roll No.', value: user.roll, icon: '🪪' },
        ].map(stat => (
          <div key={stat.label} className="hostel-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--iitb-blue-primary)' }}>{stat.value}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--iitb-blue-primary)', marginBottom: '1.5rem' }}>Quick Access</h3>
      <div className="dashboard-grid">
        {dashboardCards.map(card => (
          <div
            key={card.id}
            className="dashboard-card"
            onClick={() => navigate(card.path)}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-icon" style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{card.icon}</div>
            <h3 className="card-title">{card.title}</h3>
            <p className="card-desc">{card.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
