import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(id);
  }, [loading]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'Inter, sans-serif', color: 'var(--text-secondary, #666)',
        gap: '1rem',
      }}>
        {timedOut ? (
          <>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <p style={{ margin: 0 }}>Taking too long. Check your connection and&nbsp;
              <a href="/login" style={{ color: 'inherit', fontWeight: 700 }}>try logging in again</a>.
            </p>
          </>
        ) : (
          <span>Loading…</span>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
