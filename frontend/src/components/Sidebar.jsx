import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/',           icon: '📊', label: 'Dashboard' },
  { to: '/hostels',    icon: '🏠', label: 'Hostels & Mess' },
  { to: '/food',       icon: '🍕', label: 'Food Ordering' },
  { to: '/map',        icon: '🗺️', label: 'Campus Map' },
  { to: '/help',       icon: '🤝', label: 'Help & Delivery' },
  { to: '/groups',     icon: '👥', label: 'Groups' },
  { to: '/courses',    icon: '📚', label: 'Courses & Chat' },
  { to: '/hospital',   icon: '🏥', label: 'Hospital' },
  { to: '/buggy',      icon: '🚌', label: 'Buggy Pass' },
  { to: '/lostfound',  icon: '🔍', label: 'Lost & Found' },
  { to: '/contacts',   icon: '📞', label: 'Contacts' },
  { to: '/marketplace',icon: '🛍️', label: 'Marketplace' },
  { to: '/events',     icon: '📅', label: 'Events' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">🎓</div>
          <div className="logo-text">
            <h1>CampusOne</h1>
            <p>IIT Bombay</p>
          </div>
        </div>
      </div>

      <nav className="nav-menu">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {/* Clickable profile card navigates to /profile */}
        <NavLink to="/profile" className="user-profile" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <div className="user-avatar" style={{
            background: 'var(--iitb-blue-primary, #003366)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', width: 36, height: 36, fontWeight: 700, fontSize: '1rem',
          }}>
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="user-info">
            <p className="user-name">{user?.username || 'User'}</p>
            <p className="user-roll">⭐ {user?.points ?? 0} pts</p>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.1rem', padding: '0.25rem 0.5rem',
            color: 'var(--text-secondary)', marginLeft: '0.25rem',
          }}
        >
          🚪
        </button>
      </div>
    </aside>
  );
}
