import axios from 'axios';

const TOKEN_KEY = 'homi_token';

/** localStorage can be unavailable (private mode / sandboxed preview frames),
 *  so we transparently fall back to an in-memory store. */
let memoryToken = null;
const storage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return memoryToken;
    }
  },
  set(token) {
    memoryToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* memory fallback already set */
    }
  },
  clear() {
    memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing else to clear */
    }
  },
};

export const tokenStore = {
  get: () => storage.get(),
  set: (token) => storage.set(token),
  clear: () => storage.clear(),
};

/** Same-origin by default: Vite proxies /api → :5000 in dev, Express serves the
 *  built SPA in production, so no hard-coded hosts anywhere. */
const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });

/** Endpoints where a 401 simply means "wrong credentials", not "session gone". */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/demo-login'];

let unauthorizedHandler = null;

/** Register a callback fired when a protected request is rejected with 401. */
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const message = error.response?.data?.message || error.message || 'Network request failed';

    // Expired / invalidated session → clear the token and let the app re-authenticate.
    // (Previously the token was dropped silently, so every later call failed with a
    // confusing "Not authorized — no token provided" in the UI.)
    if (status === 401 && !AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint))) {
      tokenStore.clear();
      unauthorizedHandler?.({ message, url });
    }

    return Promise.reject(Object.assign(new Error(message), { status }));
  }
);

/** ── Auth ─────────────────────────────────────────────────────────────── */
export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  demoLogin: (role) => api.post('/auth/demo-login', { role }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  demoAccounts: () => api.get('/auth/demo-accounts').then((r) => r.data),
  /** ADMIN — approval queue for self-registered residents & guards. */
  pendingUsers: (params) => api.get('/auth/pending-users', { params }).then((r) => r.data),
  setApproval: (userId, status) => api.patch(`/auth/users/${userId}/approval`, { status }).then((r) => r.data),
  setCommitteeMembership: (userId, isCommitteeMember) =>
    api.patch(`/auth/users/${userId}/committee`, { isCommitteeMember }).then((r) => r.data),
};

/** ── Society modules ──────────────────────────────────────────────────── */
export const flatApi = {
  list: (params) => api.get('/flats', { params }).then((r) => r.data),
  summary: () => api.get('/flats/directory/summary').then((r) => r.data),
  /** Public: flats with no registered account yet (used by New Registration). */
  available: () => api.get('/flats/available').then((r) => r.data),
  get: (flatId) => api.get(`/flats/${flatId}`).then((r) => r.data),
  update: (flatId, payload) => api.patch(`/flats/${flatId}`, payload).then((r) => r.data),
  create: (payload) => api.post('/flats', payload).then((r) => r.data),
};

export const visitorApi = {
  logs: (params) => api.get('/visitors/logs', { params }).then((r) => r.data),
  stats: () => api.get('/visitors/stats').then((r) => r.data),
  checkIn: (payload) => api.post('/visitors/check-in', payload).then((r) => r.data),
  decide: (id, status, guardNote) => api.patch(`/visitors/${id}/decision`, { status, guardNote }).then((r) => r.data),
  checkOut: (id) => api.patch(`/visitors/${id}/check-out`).then((r) => r.data),
  preApprove: (payload) => api.post('/visitors/pre-approve', payload).then((r) => r.data),
  validatePass: (code) => api.post('/visitors/validate-pass', { code }).then((r) => r.data),
  myPasses: () => api.get('/visitors/passes').then((r) => r.data),
  sos: (payload) => api.post('/visitors/sos', payload).then((r) => r.data),
};

export const maintenanceApi = {
  bills: (params) => api.get('/maintenance/bills', { params }).then((r) => r.data),
  stats: () => api.get('/maintenance/stats').then((r) => r.data),
  runCron: (month, year) => api.post('/maintenance/generate-cron-bills', { month, year }).then((r) => r.data),
  defaulters: () => api.get('/maintenance/defaulters').then((r) => r.data),
};

export const noticeApi = {
  list: () => api.get('/notices').then((r) => r.data),
  create: (payload) => api.post('/notices', payload).then((r) => r.data),
  remove: (id) => api.delete(`/notices/${id}`).then((r) => r.data),
  togglePin: (id) => api.patch(`/notices/${id}/pin`).then((r) => r.data),
};

export const meetingApi = {
  list: () => api.get('/meetings').then((r) => r.data),
  create: (payload) => api.post('/meetings', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/meetings/${id}`, payload).then((r) => r.data),
  cancel: (id) => api.patch(`/meetings/${id}/cancel`).then((r) => r.data),
};

export const complaintApi = {
  list: (params) => api.get('/complaints', { params }).then((r) => r.data),
  create: (payload) => api.post('/complaints', payload).then((r) => r.data),
  setStatus: (id, status, adminRemarks) => api.patch(`/complaints/${id}/status`, { status, adminRemarks }).then((r) => r.data),
};

export const paymentApi = {
  config: () => api.get('/payments/config').then((r) => r.data),
  createOrder: (billId) => api.post('/payments/create-order', { billId }).then((r) => r.data),
  verify: (payload) => api.post('/payments/verify', payload).then((r) => r.data),
  recordOffline: (payload) => api.post('/payments/record-offline', payload).then((r) => r.data),
};

export default api;
