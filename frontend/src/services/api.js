/**
 * Axios instance pre-configured for the CampusOne backend.
 *
 * Token lifecycle (Keycloak):
 *   - Request interceptor: reads keycloak.token directly — always fresh.
 *   - Response interceptor: on 401, tries keycloak.updateToken(30) once,
 *     queues concurrent failing requests, then retries with the new token.
 *     If refresh fails, redirects to Keycloak login.
 */
import axios from 'axios';
import keycloak from '../keycloak.js';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach live Keycloak access token
// ---------------------------------------------------------------------------

api.interceptors.request.use(config => {
  const token = keycloak.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — 401 → silent token refresh → retry once
// ---------------------------------------------------------------------------

let _isRefreshing = false;
let _failedQueue  = [];

function _processQueue(error, token = null) {
  _failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  _failedQueue = [];
}

api.interceptors.response.use(
  res => res,
  async err => {
    const originalReq = err.config;

    if (err.response?.status === 401 && !originalReq._retry) {
      if (_isRefreshing) {
        // Queue this request until the in-flight refresh settles
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
        // updateToken(30) refreshes only if token expires in < 30 s
        await keycloak.updateToken(30);
        const newToken = keycloak.token;
        _processQueue(null, newToken);
        originalReq.headers.Authorization = `Bearer ${newToken}`;
        return api(originalReq);
      } catch (refreshErr) {
        _processQueue(refreshErr, null);
        // Refresh token also expired — send user back to Keycloak login
        keycloak.login();
        return Promise.reject(refreshErr);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

// ---------------------------------------------------------------------------
// Auth API — only /me/ remains; Keycloak owns login/logout/register/passwords
// ---------------------------------------------------------------------------
export const getMe        = ()     => api.get('/auth/me/').then(r => r.data);
export const updateProfile= (data) => api.patch('/auth/me/', data).then(r => r.data);

// ---------------------------------------------------------------------------
// Help & Delivery API
// ---------------------------------------------------------------------------
export const getHelpRequests   = (lat, lng) => {
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

// ---------------------------------------------------------------------------
// Lost & Found API
// ---------------------------------------------------------------------------
function _lfPayload(data) {
  if (data.image instanceof File) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
      else fd.append(k, v);
    });
    return { payload: fd, multipart: true };
  }
  return { payload: data, multipart: false };
}

export const getLFItems  = (params = {}) => api.get('/lf/items/', { params }).then(r => r.data);
export const getLFItem   = (id)          => api.get(`/lf/items/${id}/`).then(r => r.data);

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

export const deleteLFItem        = (id)           => api.delete(`/lf/items/${id}/`).then(r => r.data);
export const interactLFItem      = (id, message)  => api.post(`/lf/items/${id}/interact/`, { message }).then(r => r.data);
export const resolveLFItem       = (id)           => api.post(`/lf/items/${id}/resolve/`).then(r => r.data);
export const revertLFItem        = (id)           => api.post(`/lf/items/${id}/revert/`).then(r => r.data);
export const getLFSuggestions    = (id)           => api.get(`/lf/items/${id}/suggestions/`).then(r => r.data);
export const getMyLFItems        = ()             => api.get('/lf/items/my_items/').then(r => r.data);
export const getPendingLFItems   = ()             => api.get('/lf/items/pending_items/').then(r => r.data);
export const getHistoryLFItems   = ()             => api.get('/lf/items/history_items/').then(r => r.data);
export const getLFTopTags        = ()             => api.get('/lf/items/top_tags/').then(r => r.data);
export const getMyClaims         = ()             => api.get('/lf/my-claims/').then(r => r.data);
export const getLFCategories     = ()             => api.get('/lf/categories/').then(r => r.data);
export const getLFAnalytics          = () => api.get('/lf/analytics/').then(r => r.data);
export const getLFTopLostLocations   = () => api.get('/lf/analytics/top-lost-locations/').then(r => r.data);
export const getLFTopLostCategories  = () => api.get('/lf/analytics/top-lost-categories/').then(r => r.data);
export const getLFNotifications  = ()    => api.get('/lf/notifications/').then(r => r.data);
export const markLFNotifRead     = (id)  => api.post(`/lf/notifications/${id}/read/`).then(r => r.data);
export const markAllLFNotifsRead = ()    => api.post('/lf/notifications/mark_all_read/').then(r => r.data);

// ---------------------------------------------------------------------------
// Mess Module API
// ---------------------------------------------------------------------------
export const getMessSettings    = (hostel)       => api.get('/mess/settings/', { params: { hostel } }).then(r => r.data);
export const updateMessSettings = (data)         => api.patch('/mess/settings/', data).then(r => r.data);
export const getMessMenu        = (hostel, date) => api.get('/mess/menu/', { params: { hostel, date } }).then(r => r.data);
export const upsertMessMenu     = (data)         => api.post('/mess/menu/', data).then(r => r.data);
export const getGuestCoupons    = (params = {})  => api.get('/mess/coupons/', { params }).then(r => r.data);
export const buyGuestCoupons    = (data)         => api.post('/mess/coupons/', data).then(r => r.data);
export const getRebates         = (params = {})  => api.get('/mess/rebates/', { params }).then(r => r.data);
export const submitRebate       = (data)         => api.post('/mess/rebates/', data).then(r => r.data);
export const reviewRebate       = (id, data)     => api.post(`/mess/rebates/${id}/review/`, data).then(r => r.data);
export const getMessSMA         = (params = {})  => api.get('/mess/sma/', { params }).then(r => r.data);
export const getMessAnalytics   = ()             => api.get('/mess/analytics/').then(r => r.data);

// ---------------------------------------------------------------------------
// Admin Master Console API (staff only)
// ---------------------------------------------------------------------------
export const getConsoleStats     = ()             => api.get('/console/stats/').then(r => r.data);
export const getConsoleUsers     = (params = {})  => api.get('/console/users/', { params }).then(r => r.data);
export const getConsoleUser      = (id)           => api.get(`/console/users/${id}/`).then(r => r.data);
export const updateConsoleUser   = (id, data)     => api.patch(`/console/users/${id}/`, data).then(r => r.data);
export const getConsoleMenus     = (params = {})  => api.get('/console/menus/', { params }).then(r => r.data);
export const deleteConsoleMenu   = (id)           => api.delete(`/console/menus/${id}/`).then(r => r.data);
export const getConsoleCoupons   = (params = {})  => api.get('/console/coupons/', { params }).then(r => r.data);
export const deleteConsoleCoupon = (id)           => api.delete(`/console/coupons/${id}/`).then(r => r.data);
export const getConsoleRebates   = (params = {})  => api.get('/console/rebates/', { params }).then(r => r.data);
export const reviewConsoleRebate = (id, data)     => api.post(`/console/rebates/${id}/review/`, data).then(r => r.data);
export const deleteConsoleRebate = (id)           => api.delete(`/console/rebates/${id}/`).then(r => r.data);
export const getConsoleSettings  = ()             => api.get('/console/settings/').then(r => r.data);
export const updateConsoleSetting= (id, data)     => api.patch(`/console/settings/${id}/`, data).then(r => r.data);

// Console — Outlets
export const getConsoleOutlets    = ()           => api.get('/console/outlets/').then(r => r.data);
export const createConsoleOutlet  = (data)       => api.post('/console/outlets/', data).then(r => r.data);
export const updateConsoleOutlet  = (id, data)   => api.patch(`/console/outlets/${id}/`, data).then(r => r.data);
export const deleteConsoleOutlet  = (id)         => api.delete(`/console/outlets/${id}/`).then(r => r.data);

// Console — Outlet Admins
export const getConsoleOutletAdmins   = ()       => api.get('/console/outlet-admins/').then(r => r.data);
export const createConsoleOutletAdmin = (data)   => api.post('/console/outlet-admins/', data).then(r => r.data);
export const deleteConsoleOutletAdmin = (id)     => api.delete(`/console/outlet-admins/${id}/`).then(r => r.data);

// Console — Hostels
export const getConsoleHostels    = ()           => api.get('/console/hostels/').then(r => r.data);
export const createConsoleHostel  = (data)       => api.post('/console/hostels/', data).then(r => r.data);
export const updateConsoleHostel  = (id, data)   => api.patch(`/console/hostels/${id}/`, data).then(r => r.data);
export const deleteConsoleHostel  = (id)         => api.delete(`/console/hostels/${id}/`).then(r => r.data);

// Console — Food Orders (read-only view)
export const getConsoleFoodOrders = (params = {}) => api.get('/console/orders/', { params }).then(r => r.data);

// ---------------------------------------------------------------------------
// Contacts Module API
// ---------------------------------------------------------------------------
export const getFaculty           = (params = {}) => api.get('/contacts/faculty/',          { params }).then(r => r.data);
export const createFaculty        = (data)        => api.post('/contacts/faculty/', data,   { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const updateFaculty        = (id, data)    => api.patch(`/contacts/faculty/${id}/`,  data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const deleteFaculty        = (id)          => api.delete(`/contacts/faculty/${id}/`).then(r => r.data);
export const toggleFacultyAvail   = (id)          => api.patch(`/contacts/faculty/${id}/toggle-availability/`).then(r => r.data);
export const getDepartments       = (params = {}) => api.get('/contacts/departments/',       { params }).then(r => r.data);
export const createDepartment     = (data)        => api.post('/contacts/departments/', data).then(r => r.data);
export const updateDepartment     = (id, data)    => api.patch(`/contacts/departments/${id}/`, data).then(r => r.data);
export const deleteDepartment     = (id)          => api.delete(`/contacts/departments/${id}/`).then(r => r.data);
export const getEmergencyContacts  = (params = {}) => api.get('/contacts/emergency/',         { params }).then(r => r.data);
export const createEmergencyContact= (data)        => api.post('/contacts/emergency/', data).then(r => r.data);
export const updateEmergencyContact= (id, data)    => api.patch(`/contacts/emergency/${id}/`, data).then(r => r.data);
export const deleteEmergencyContact= (id)          => api.delete(`/contacts/emergency/${id}/`).then(r => r.data);

// ---------------------------------------------------------------------------
// Doctor Schedule API
// ---------------------------------------------------------------------------
export const getDoctorSchedule    = ()  => api.get('/doctors/schedule/').then(r => r.data);
export const refreshDoctorSchedule= ()  => api.post('/doctors/schedule/').then(r => r.data);

// ---------------------------------------------------------------------------
// Legacy Campus API
// ---------------------------------------------------------------------------
export const getHostels    = ()         => api.get('/hostels/').then(r => r.data);
export const getOutlets    = ()         => api.get('/outlets/').then(r => r.data);
export const createOrder   = (payload) => api.post('/orders/', payload).then(r => r.data);
export const getOrders     = ()         => api.get('/orders/').then(r => r.data);
export const getDoctors    = ()         => api.get('/doctors/').then(r => r.data);
export const getLostFound  = ()         => api.get('/lostfound/').then(r => r.data);
export const reportItem    = (payload) => api.post('/lostfound/', payload).then(r => r.data);
export const getListings   = ()         => api.get('/marketplace/').then(r => r.data);
export const createListing = (payload) => api.post('/marketplace/', payload).then(r => r.data);
export const getEvents     = ()         => api.get('/events/').then(r => r.data);

// ---------------------------------------------------------------------------
// Food Ordering — User APIs
// ---------------------------------------------------------------------------
export const getFoodOutlets      = ()           => api.get('/food/outlets/').then(r => r.data);
export const getOutletMenu       = (id, params) => api.get(`/food/outlets/${id}/menu/`, { params }).then(r => r.data);
export const placeFoodOrder      = (data)       => api.post('/food/orders/', data).then(r => r.data);
export const getPendingFoodOrders= ()           => api.get('/food/orders/pending/').then(r => r.data);
export const getFoodOrderHistory = ()           => api.get('/food/orders/history/').then(r => r.data);
export const trackFoodOrder      = (id)         => api.get(`/food/orders/${id}/`).then(r => r.data);
export const cancelFoodOrder     = (id)         => api.post(`/food/orders/${id}/cancel/`).then(r => r.data);
export const submitFoodReview    = (id, data)   => api.post(`/food/orders/${id}/review/`, data).then(r => r.data);

// Food Ordering — Outlet Admin APIs
export const getAdminFoodOrders    = ()         => api.get('/food/admin/orders/').then(r => r.data);
export const acceptFoodOrder       = (id)       => api.post(`/food/admin/orders/${id}/accept/`).then(r => r.data);
export const cancelFoodOrderAdmin  = (id)       => api.post(`/food/admin/orders/${id}/cancel/`).then(r => r.data);
export const updateFoodOrderStatus = (id, st)   => api.patch(`/food/admin/orders/${id}/status/`, { status: st }).then(r => r.data);
export const getAdminMenu          = ()         => api.get('/food/admin/menu/').then(r => r.data);

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
export const getHostelAnalytics    = () => api.get('/food/analytics/hostel-wise/').then(r => r.data);
export const getTopFoodItems       = () => api.get('/food/analytics/top-food-items/').then(r => r.data);
export const getTimeWiseAnalytics  = () => api.get('/food/analytics/time-wise/').then(r => r.data);
export const getDailySalesAnalytics= () => api.get('/food/analytics/daily-sales/').then(r => r.data);

export default api;
