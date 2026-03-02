import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

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
  const { user } = useApp();

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
        <div className="user-profile">
          <div className="user-avatar">👤</div>
          <div className="user-info">
            <p className="user-name">{user.name}</p>
            <p className="user-roll">{user.roll}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
