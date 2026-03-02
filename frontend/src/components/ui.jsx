/** Generic card wrapper matching existing .hostel-card / .outlet-card styles */
export function Card({ children, className = '', onClick, style }) {
  return (
    <div
      className={`hostel-card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </div>
  );
}

/** Colored status badge */
export function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{status}</span>;
}

/** Clickable tag pill */
export function Tag({ label, onClick }) {
  return (
    <span className="tag" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {label}
    </span>
  );
}

/** Section header */
export function SectionHeader({ title, subtitle }) {
  return (
    <header className="section-header">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
