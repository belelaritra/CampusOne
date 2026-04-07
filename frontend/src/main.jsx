import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/global.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import keycloak from './keycloak.js';

/**
 * Initialise Keycloak BEFORE mounting React.
 *
 * onLoad: 'check-sso'  — silently checks for an existing SSO session without
 *   forcing a redirect. If the user has no session, keycloak.authenticated
 *   will be false and the app renders normally (ProtectedRoute redirects to /login).
 *
 * silentCheckSsoRedirectUri — Keycloak loads this tiny page in a hidden iframe
 *   to detect an existing SSO session without a full page redirect.
 *
 * pkceMethod: 'S256' — required for public clients; prevents auth code interception.
 */
keycloak
  .init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
  })
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <AppProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </AppProvider>
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>
    );
  })
  .catch((err) => {
    console.error('Keycloak init failed:', err);
    // Render a fallback so the user sees something useful
    ReactDOM.createRoot(document.getElementById('root')).render(
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'Inter, sans-serif', flexDirection: 'column',
        gap: '1rem', color: '#333',
      }}>
        <h2>Unable to connect to authentication service</h2>
        <p>Make sure Keycloak is running at <code>http://localhost:8080</code></p>
        <button onClick={() => window.location.reload()}
          style={{ padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  });
