import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is not set');
}

const notifyAuthChanged = () => {
  window.dispatchEvent(new Event('auth:changed'));
};

const SESSION_TOKEN_STORAGE_KEY = 'session_token';

const getSessionToken = () => localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);

const setSessionToken = (token) => {
  if (!token) {
    localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
};

const clearLocalAuth = () => {
  setSessionToken(null);
  localStorage.removeItem('session_user');
};

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  // Use allauth "app" (X-Session-Token) mode: no cookies, no CSRF.
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (!token) return config;

  config.headers = config.headers || {};
  config.headers['X-Session-Token'] = token;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const token = response?.data?.meta?.session_token;
    if (token) setSessionToken(token);
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    if (status === 410) {
      clearLocalAuth();
      notifyAuthChanged();
    }
    return Promise.reject(error);
  },
);

const setSessionUser = (user) => {
  if (!user) {
    localStorage.removeItem('session_user');
    return;
  }
  localStorage.setItem('session_user', JSON.stringify(user));
};

const getAllauthUser = (payload) => payload?.data?.user || null;

const getAllauthError = (error) => {
  const errors = error?.response?.data?.errors;
  if (Array.isArray(errors) && errors.length) {
    return errors[0]?.message || errors[0]?.code || 'Request failed';
  }
  return error?.response?.data?.detail || 'Request failed';
};

const with410Retry = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    const status = error?.response?.status;
    if (status !== 410) throw error;
    clearLocalAuth();
    notifyAuthChanged();
    return await fn();
  }
};

// Auth APIs
export const authAPI = {
  login: async (email, password) => {
    const response = await with410Retry(() =>
      api.post('/_allauth/app/v1/auth/login', { email, password }),
    );
    const user = getAllauthUser(response.data);
    setSessionUser(user);
    notifyAuthChanged();
    return user;
  },

  signup: async (email, password) => {
    const response = await with410Retry(() =>
      api.post('/_allauth/app/v1/auth/signup', { email, password }),
    );
    const user = getAllauthUser(response.data);
    setSessionUser(user);
    notifyAuthChanged();
    return user;
  },

  googleLogin: async (credential, clientId) => {
    const response = await with410Retry(() =>
      api.post('/_allauth/app/v1/auth/provider/token', {
        provider: 'google',
        process: 'login',
        token: {
          client_id: clientId,
          id_token: credential,
        },
      }),
    );
    const user = getAllauthUser(response.data);
    setSessionUser(user);
    notifyAuthChanged();
    return user;
  },

  me: async () => {
    try {
      const response = await with410Retry(() => api.get('/_allauth/app/v1/auth/session'));
      const user = getAllauthUser(response.data);
      setSessionUser(user);
      notifyAuthChanged();
      return user;
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        setSessionUser(null);
        notifyAuthChanged();
        return null;
      }
      setSessionUser(null);
      notifyAuthChanged();
      throw error;
    }
  },
  
  logout: () => {
    clearLocalAuth();
    notifyAuthChanged();
  },

  serverLogout: async () => {
    try {
      const response = await with410Retry(() => api.delete('/_allauth/app/v1/auth/session'));
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) return null; // already logged out
      throw error;
    } finally {
      clearLocalAuth();
      notifyAuthChanged();
    }
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('session_user');
  },

  getErrorMessage: getAllauthError,
};

// Core APIs
export const coreAPI = {
  getUserCount: async () => {
    const response = await api.get('/core/users/count/');
    return response.data;
  },
};

export const configAPI = {
  getPublicConfig: async () => {
    const response = await api.get('/config/public/');
    return response.data;
  },
};

// Tracker APIs
export const trackerAPI = {
  // Get month view (main Excel-like grid)
  getMonthView: async (year, month) => {
    const response = await api.get(`/tracker/month/${year}/${month}/`);
    return response.data;
  },

  // Get focused "today" view (optionally: ?date=YYYY-MM-DD)
  getTodayView: async (dateStr) => {
    const response = await api.get('/tracker/today/', {
      params: dateStr ? { date: dateStr } : undefined,
    });
    return response.data;
  },

  // List all trackers
  listTrackers: async () => {
    const response = await api.get('/tracker/trackers/');
    return response.data;
  },

  // Create custom tracker
  createTracker: async (trackerData) => {
    const response = await api.post('/tracker/trackers/create/', trackerData);
    return response.data;
  },

  // Update tracker
  updateTracker: async (id, trackerData) => {
    const response = await api.put(`/tracker/trackers/${id}/`, trackerData);
    return response.data;
  },

  // Delete tracker
  deleteTracker: async (id) => {
    const response = await api.delete(`/tracker/trackers/${id}/delete/`);
    return response.data;
  },
};

// Entry APIs
export const entryAPI = {
  // Create or update entry
  saveEntry: async (entryData) => {
    const response = await api.post('/tracker/entries/create/', entryData);
    return response.data;
  },

  // Delete entry
  deleteEntry: async (id) => {
    const response = await api.delete(`/tracker/entries/${id}/delete/`);
    return response.data;
  },
};

// Insights APIs
export const insightsAPI = {
  getLatest: async (reportType) => {
    const response = await api.get('/insights/', {
      params: { report_type: reportType, limit: 1 },
    });
    const first = response.data?.insights?.[0];
    return first || { content: null };
  },

  generate: async (reportType) => {
    const response = await api.post('/insights/generate/', { report_type: reportType });
    return response.data;
  },
};

export default api;
