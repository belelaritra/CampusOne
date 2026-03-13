import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading]         = useState(true);

  // On mount, try to restore session from stored refresh token
  useEffect(() => {
    const savedRefresh = localStorage.getItem('refresh_token');
    if (savedRefresh) {
      api.post('/auth/refresh/', { refresh: savedRefresh })
        .then(res => {
          const newAccess = res.data.access;
          setAccessToken(newAccess);
          // Fetch user profile
          return api.get('/auth/me/', {
            headers: { Authorization: `Bearer ${newAccess}` },
          });
        })
        .then(res => setUser(res.data))
        .catch(() => {
          // Refresh token invalid/expired — clear storage
          localStorage.removeItem('refresh_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await api.post('/auth/login/', credentials);
    const { user: u, access, refresh } = res.data;
    setUser(u);
    setAccessToken(access);
    localStorage.setItem('refresh_token', refresh);
    return u;
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    try {
      if (refresh && accessToken) {
        await api.post('/auth/logout/', { refresh }, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } catch (_) { /* ignore */ }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('refresh_token');
  }, [accessToken]);

  const refreshAccessToken = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) throw new Error('No refresh token');
    const res = await api.post('/auth/refresh/', { refresh });
    const newAccess = res.data.access;
    // SimpleJWT rotates refresh too
    if (res.data.refresh) localStorage.setItem('refresh_token', res.data.refresh);
    setAccessToken(newAccess);
    return newAccess;
  }, []);

  const updateUser = useCallback((updated) => {
    setUser(prev => ({ ...prev, ...updated }));
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, refreshAccessToken, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
