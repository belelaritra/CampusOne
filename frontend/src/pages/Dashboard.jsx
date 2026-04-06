import { useNavigate } from 'react-router-dom';
import { SectionHeader } from '../components/ui.jsx';
import { dashboardCards } from '../data/mockData.js';
import { useAuth } from '../context/AuthContext.jsx';

const HOSTEL_LABEL = {
  hostel_1:'Hostel 1', hostel_2:'Hostel 2', hostel_3:'Hostel 3',
  hostel_4:'Hostel 4', hostel_5:'Hostel 5', hostel_6:'Hostel 6',
  hostel_7:'Hostel 7', hostel_8:'Hostel 8', hostel_9:'Hostel 9',
  hostel_10:'Hostel 10', hostel_11:'Hostel 11', hostel_12:'Hostel 12',
  hostel_13:'Hostel 13', hostel_14:'Hostel 14', hostel_15:'Hostel 15',
  hostel_16:'Hostel 16', hostel_17:'Hostel 17', hostel_18:'Hostel 18',
  hostel_19:'Hostel 19', hostel_21:'Hostel 21', tansa_house:'Tansa House',
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
