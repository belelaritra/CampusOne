import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach access token from module-level ref
// ---------------------------------------------------------------------------

// We store a reference that AuthContext can update after login/refresh
let _getAccessToken = () => null;
export function setTokenGetter(fn) { _getAccessToken = fn; }

api.interceptors.request.use(config => {
  const token = _getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — 401 → attempt silent refresh → retry once
// ---------------------------------------------------------------------------

let _refreshFn = null;
export function setRefreshFn(fn) { _refreshFn = fn; }

let _isRefreshing = false;
let _failedQueue = [];

function processQueue(error, token = null) {
  _failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  _failedQueue = [];
}

api.interceptors.response.use(
  res => res,
  async err => {
    const originalReq = err.config;
    if (err.response?.status === 401 && !originalReq._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then(token => {
          originalReq.headers.Authorization = `Bearer ${token}`;
          return api(originalReq);
        });
      }

      originalReq._retry = true;
      _isRefreshing = true;

      try {
        if (!_refreshFn) throw new Error('No refresh function registered');
        const newToken = await _refreshFn();
        processQueue(null, newToken);
        originalReq.headers.Authorization = `Bearer ${newToken}`;
        return api(originalReq);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        // Redirect to login
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export const register        = (data) => api.post('/auth/register/', data).then(r => r.data);
export const login           = (data) => api.post('/auth/login/', data).then(r => r.data);
export const logout          = (data) => api.post('/auth/logout/', data).then(r => r.data);
export const getMe           = ()     => api.get('/auth/me/').then(r => r.data);
export const changePassword  = (data) => api.post('/auth/change-password/', data).then(r => r.data);
export const forgotPassword  = (data) => api.post('/auth/forgot-password/', data).then(r => r.data);
export const resetPassword   = (data) => api.post('/auth/reset-password/', data).then(r => r.data);

// ---------------------------------------------------------------------------
// Help & Delivery API
// ---------------------------------------------------------------------------
export const getHelpRequests = (lat, lng) => {
  const qs = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : '';
  return api.get(`/help/${qs}`).then(r => r.data);
};
export const createHelpRequest = (data)         => api.post('/help/', data).then(r => r.data);
export const acceptRequest     = (id, lat, lng) =>
  api.post(`/help/${id}/accept/`, { latitude: lat, longitude: lng }).then(r => r.data);
export const completeRequest   = (id)  => api.post(`/help/${id}/complete/`).then(r => r.data);
export const editRequest       = (id, data) => api.patch(`/help/${id}/`, data).then(r => r.data);
export const deleteRequest     = (id)  => api.delete(`/help/${id}/`).then(r => r.data);
export const getMyRequests     = ()    => api.get('/help/mine/').then(r => r.data);
export const getHistory        = ()    => api.get('/help/history/').then(r => r.data);
export const getAdminRequests  = ()    => api.get('/help/admin_list/').then(r => r.data);
export const updateProfile     = (data) => api.patch('/auth/me/', data).then(r => r.data);

// ---------------------------------------------------------------------------
// Legacy Campus API (unchanged)
// ---------------------------------------------------------------------------
export const getHostels    = () => api.get('/hostels/').then(r => r.data);
export const getOutlets    = () => api.get('/outlets/').then(r => r.data);
export const createOrder   = (payload) => api.post('/orders/', payload).then(r => r.data);
export const getOrders     = () => api.get('/orders/').then(r => r.data);
export const getDoctors    = () => api.get('/doctors/').then(r => r.data);
export const getLostFound  = () => api.get('/lostfound/').then(r => r.data);
export const reportItem    = (payload) => api.post('/lostfound/', payload).then(r => r.data);
export const getListings   = () => api.get('/marketplace/').then(r => r.data);
export const createListing = (payload) => api.post('/marketplace/', payload).then(r => r.data);
export const getEvents     = () => api.get('/events/').then(r => r.data);

export default api;
