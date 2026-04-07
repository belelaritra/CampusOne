import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import keycloak from '../keycloak';

/**
 * ProtectedRoute — guards all authenticated pages.
 *
 * If not authenticated, triggers keycloak.login() directly with redirectUri='/'
 * so Keycloak always returns to the app root — never to /login.
 * This eliminates the redirect loop caused by Keycloak returning to /login
 * while the auth code is still being exchanged.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(id);
  }, [loading]);

  // Not authenticated and Keycloak has no token — initiate login
  if (!loading && !user && !keycloak.authenticated) {
    keycloak.login({ redirectUri: window.location.origin + '/' });
    return null;
  }

  // Still initialising (keycloak.init processing auth code, or profile fetching)
  if (loading || (!user && keycloak.authenticated)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        fontFamily: 'Inter, sans-serif', color: 'var(--text-secondary, #666)',
        gap: '1rem',
      }}>
        {timedOut ? (
          <>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <p style={{ margin: 0 }}>
              Taking too long. Check that Keycloak is running and&nbsp;
              <a href="/" style={{ color: 'inherit', fontWeight: 700 }}>try again</a>.
            </p>
          </>
        ) : (
          <span>Loading…</span>
        )}
      </div>
    );
  }

  return children;
}
