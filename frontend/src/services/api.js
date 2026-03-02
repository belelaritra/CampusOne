import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({ baseURL: BASE_URL, headers: { 'Content-Type': 'application/json' } });

// Intercept to attach auth token when ready
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Hostels ---
export const getHostels = () => api.get('/hostels/').then(r => r.data);
export const getMessMenu = (hostelId) => api.get(`/hostels/${hostelId}/menu/`).then(r => r.data);

// --- Food ---
export const getOutlets = () => api.get('/outlets/').then(r => r.data);
export const getMenu = (outletId) => api.get(`/outlets/${outletId}/menu/`).then(r => r.data);
export const createOrder = (payload) => api.post('/orders/', payload).then(r => r.data);
export const getOrders = () => api.get('/orders/').then(r => r.data);

// --- Help & Delivery ---
export const getRequests = () => api.get('/requests/').then(r => r.data);
export const createRequest = (payload) => api.post('/requests/', payload).then(r => r.data);

// --- Groups ---
export const getGroups = () => api.get('/groups/').then(r => r.data);
export const joinGroup = (id) => api.post(`/groups/${id}/join/`).then(r => r.data);

// --- Hospital ---
export const getDoctors = () => api.get('/doctors/').then(r => r.data);

// --- Lost & Found ---
export const getLostFound = () => api.get('/lostfound/').then(r => r.data);
export const reportItem = (payload) => api.post('/lostfound/', payload).then(r => r.data);

// --- Marketplace ---
export const getListings = () => api.get('/marketplace/').then(r => r.data);
export const createListing = (payload) => api.post('/marketplace/', payload).then(r => r.data);

// --- Events ---
export const getEvents = () => api.get('/events/').then(r => r.data);

// --- Contacts ---
export const getStudents = () => api.get('/contacts/students/').then(r => r.data);
export const getFaculty = () => api.get('/contacts/faculty/').then(r => r.data);
export const getDepartments = () => api.get('/contacts/departments/').then(r => r.data);

export default api;
