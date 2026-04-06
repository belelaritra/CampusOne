import { useNavigate } from 'react-router-dom';
import { SectionHeader } from '../components/ui.jsx';
import { dashboardCards } from '../data/mockData.js';
import { useAuth } from '../context/AuthContext.jsx';

const HOSTEL_LABEL = {
  H1:'Hostel 1',  H2:'Hostel 2',  H3:'Hostel 3',
  H4:'Hostel 4',  H5:'Hostel 5',  H6:'Hostel 6',
  H7:'Hostel 7',  H8:'Hostel 8',  H9:'Hostel 9',
  H10:'Hostel 10', H11:'Hostel 11', H12:'Hostel 12',
  H13:'Hostel 13', H14:'Hostel 14', H15:'Hostel 15',
  H16:'Hostel 16', H17:'Hostel 17', H18:'Hostel 18',
  H19:'Hostel 19', H21:'Hostel 21', Tansa:'Tansa House',
};

function ordinal(n) {
  if (!n) return null;
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]) + ' Year';
}

export default function Dashboard() {
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const hostelDisplay = HOSTEL_LABEL[user?.hostel] || user?.hostel || null;
  const hostelValue   = hostelDisplay
    ? (user?.room_number ? `${hostelDisplay} / Room ${user.room_number}` : hostelDisplay)
    : null;

  const stats = [
    { label: 'Hostel',   value: hostelValue,              icon: '🏠' },
    { label: 'Branch',   value: user?.course  || null,    icon: '📚' },
    { label: 'Year',     value: ordinal(user?.year_of_study), icon: '🎓' },
    { label: 'Roll No.', value: user?.roll_number || null, icon: '🪪' },
  ];

  return (
    <section className="content-section active">
      <SectionHeader
        title={`Welcome back, ${(user?.full_name || user?.username || 'there').split(' ')[0]}! 👋`}
        subtitle="IIT Bombay Campus Portal — Your unified student platform"
      />

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {stats.map(stat => (
          <div key={stat.label} className="hostel-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--iitb-blue-primary)' }}>
              {stat.value || <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 400 }}>Not set</span>}
            </div>
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
