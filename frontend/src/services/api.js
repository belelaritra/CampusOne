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
// Lost & Found API
// ---------------------------------------------------------------------------
function _lfPayload(data) {
  // If an image File is present, use multipart; otherwise send JSON
  if (data.image instanceof File) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) fd.append(k, JSON.stringify(v));   // tags → JSON string
      else fd.append(k, v);
    });
    return { payload: fd, multipart: true };
  }
  return { payload: data, multipart: false };
}

export const getLFItems = (params = {}) =>
  api.get('/lf/items/', { params }).then(r => r.data);

export const getLFItem = (id) =>
  api.get(`/lf/items/${id}/`).then(r => r.data);

export const createLFItem = (data) => {
  const { payload, multipart } = _lfPayload(data);
  const cfg = multipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  return api.post('/lf/items/', payload, cfg).then(r => r.data);
};

export const editLFItem = (id, data) => {
  const { payload, multipart } = _lfPayload(data);
  const cfg = multipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  return api.patch(`/lf/items/${id}/`, payload, cfg).then(r => r.data);
};

export const deleteLFItem     = (id)          => api.delete(`/lf/items/${id}/`).then(r => r.data);
export const claimLFItem      = (id, message) => api.post(`/lf/items/${id}/claim/`, { message }).then(r => r.data);
export const closeLFItem      = (id)          => api.post(`/lf/items/${id}/close/`).then(r => r.data);
export const handoverLFItem   = (id)          => api.post(`/lf/items/${id}/handover/`).then(r => r.data);
export const getLFSuggestions = (id)          => api.get(`/lf/items/${id}/suggestions/`).then(r => r.data);
export const getMyLFItems     = ()            => api.get('/lf/items/my_items/').then(r => r.data);
export const getLFTopTags     = ()            => api.get('/lf/items/top_tags/').then(r => r.data);
export const getMyClaims      = ()            => api.get('/lf/my-claims/').then(r => r.data);
export const getLFCategories  = ()            => api.get('/lf/categories/').then(r => r.data);
export const getLFAnalytics   = ()            => api.get('/lf/analytics/').then(r => r.data);

export const getLFNotifications  = ()   => api.get('/lf/notifications/').then(r => r.data);
export const markLFNotifRead     = (id) => api.post(`/lf/notifications/${id}/read/`).then(r => r.data);
export const markAllLFNotifsRead = ()   => api.post('/lf/notifications/mark_all_read/').then(r => r.data);

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

// ---------------------------------------------------------------------------
// Food Ordering — User APIs
// ---------------------------------------------------------------------------
export const getFoodOutlets     = ()           => api.get('/food/outlets/').then(r => r.data);
export const getOutletMenu      = (id, params) => api.get(`/food/outlets/${id}/menu/`, { params }).then(r => r.data);
export const placeFoodOrder     = (data)       => api.post('/food/orders/', data).then(r => r.data);
export const getPendingFoodOrders = ()         => api.get('/food/orders/pending/').then(r => r.data);
export const getFoodOrderHistory  = ()         => api.get('/food/orders/history/').then(r => r.data);
export const trackFoodOrder     = (id)         => api.get(`/food/orders/${id}/`).then(r => r.data);
export const cancelFoodOrder    = (id)         => api.post(`/food/orders/${id}/cancel/`).then(r => r.data);
export const submitFoodReview   = (id, data)   => api.post(`/food/orders/${id}/review/`, data).then(r => r.data);

// Food Ordering — Outlet Admin APIs
export const getAdminFoodOrders   = ()          => api.get('/food/admin/orders/').then(r => r.data);
export const acceptFoodOrder      = (id)        => api.post(`/food/admin/orders/${id}/accept/`).then(r => r.data);
export const cancelFoodOrderAdmin = (id)        => api.post(`/food/admin/orders/${id}/cancel/`).then(r => r.data);
export const updateFoodOrderStatus = (id, st)   => api.patch(`/food/admin/orders/${id}/status/`, { status: st }).then(r => r.data);
export const getAdminMenu         = ()          => api.get('/food/admin/menu/').then(r => r.data);

// addMenuItem / updateMenuItem: use FormData when an image_upload File is present
function _menuItemPayload(data) {
  if (data.image_upload instanceof File) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, v);
    });
    return { payload: fd, headers: { 'Content-Type': 'multipart/form-data' } };
  }
  return { payload: data, headers: {} };
}

export const addMenuItem = (data) => {
  const { payload, headers } = _menuItemPayload(data);
  return api.post('/food/admin/menu/', payload, { headers }).then(r => r.data);
};
export const updateMenuItem = (id, data) => {
  const { payload, headers } = _menuItemPayload(data);
  return api.patch(`/food/admin/menu/${id}/`, payload, { headers }).then(r => r.data);
};
export const deleteMenuItem = (id) => api.delete(`/food/admin/menu/${id}/`).then(r => r.data);

// Food Ordering — Analytics APIs
export const getHostelAnalytics   = () => api.get('/food/analytics/hostel-wise/').then(r => r.data);
export const getTopFoodItems      = () => api.get('/food/analytics/top-food-items/').then(r => r.data);
export const getTimeWiseAnalytics = () => api.get('/food/analytics/time-wise/').then(r => r.data);
export const getDailySalesAnalytics = () => api.get('/food/analytics/daily-sales/').then(r => r.data);

export default api;
