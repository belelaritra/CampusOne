import { useEffect } from 'react';
import keycloak from '../keycloak';

export default function Register() {
  useEffect(() => {
    if (!keycloak.authenticated) {
      keycloak.register({ redirectUri: window.location.origin + '/' });
    }
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">
          <span className="auth-logo-icon">🎓</span>
          <h1>CampusOne</h1>
          <p>IIT Bombay Campus Portal</p>
        </div>
        <div style={{ marginTop: '2rem', color: 'var(--text-secondary)' }}>
          <p>Redirecting to registration…</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              className="btn btn-primary auth-submit"
              onClick={() => keycloak.register({ redirectUri: window.location.origin + '/' })}
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
