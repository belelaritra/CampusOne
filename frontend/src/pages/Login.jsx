import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import keycloak from '../keycloak';

export default function Login() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Guard: don't call login if Keycloak already has a token (auth code
    // exchange just completed but profile fetch is still in progress),
    // or if the user object is already set, or still loading.
    if (!loading && !user && !keycloak.authenticated) {
      keycloak.login({
        // Redirect to app root after login — never back to /login
        redirectUri: window.location.origin + '/',
      });
    }
  }, [user, loading]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">
          <span className="auth-logo-icon">🎓</span>
          <h1>CampusOne</h1>
          <p>IIT Bombay Campus Portal</p>
        </div>
        <div style={{ marginTop: '2rem', color: 'var(--text-secondary)' }}>
          <p>Redirecting to secure login…</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              className="btn btn-primary auth-submit"
              onClick={() => keycloak.login({ redirectUri: window.location.origin + '/' })}
            >
              Sign In with CampusOne
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
