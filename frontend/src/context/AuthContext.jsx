/**
 * AuthContext — Keycloak-backed authentication context.
 *
 * Keycloak is already initialised in main.jsx before this mounts.
 * This context:
 *   - Fetches the Django-side user profile (/api/auth/me/) after KC auth
 *   - Exposes login / logout / updateUser helpers consumed by UI components
 *   - Proactively refreshes the Keycloak token before it expires
 *
 * Token management (attach to requests, 401 retry) lives entirely in api.js.
 * No token state is kept here — api.js reads keycloak.token directly.
 */
import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from 'react';
import keycloak from '../keycloak';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Django-side profile (photo, roll_number, hostel, points, etc.)
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef              = useRef(null);

  useEffect(() => {
    if (keycloak.authenticated) {
      // Fetch the enriched Django profile (photo, campus fields, role flags)
      api.get('/auth/me/')
        .then(res => setUser(res.data))
        .catch(() => {
          // Profile fetch failed — leave user null; ProtectedRoute handles redirect.
          // Do NOT call keycloak.login() here — causes an infinite OPTIONS/redirect loop.
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // Proactively refresh the token 60 s before it expires.
    // keycloak.updateToken(minValidity) refreshes only if the token
    // expires within minValidity seconds — no-ops otherwise.
    timerRef.current = setInterval(() => {
      keycloak.updateToken(60).catch(() => {
        // Refresh failed (session expired on Keycloak side) — redirect to login
        clearInterval(timerRef.current);
        keycloak.login();
      });
    }, 30_000); // check every 30 s

    // Keycloak hook — fires if the token expires between interval ticks
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.login());
    };

    return () => clearInterval(timerRef.current);
  }, []);

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /** Redirect to Keycloak's login page. */
  const login = useCallback(() => {
    keycloak.login();
  }, []);

  /** Logout from both the app and Keycloak SSO. */
  const logout = useCallback(() => {
    setUser(null);
    keycloak.logout({ redirectUri: window.location.origin + '/login' });
  }, []);

  /**
   * Force-refresh the Keycloak access token and return the new value.
   * Used by api.js interceptor on 401 responses.
   */
  const refreshAccessToken = useCallback(async () => {
    await keycloak.updateToken(30);
    return keycloak.token;
  }, []);

  /** Merge partial updates into the local user object (after profile PATCH). */
  const updateUser = useCallback((updated) => {
    setUser(prev => ({ ...prev, ...updated }));
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      // accessToken is intentionally a live getter, not state.
      // Components that need it (e.g. App.jsx legacy wiring) get the current
      // Keycloak token value at call time. api.js reads keycloak.token directly.
      get accessToken() { return keycloak.token ?? null; },
      login,
      logout,
      refreshAccessToken,
      updateUser,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
