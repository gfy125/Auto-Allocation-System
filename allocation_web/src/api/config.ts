const BACKEND_PORT = (import.meta as any).env?.VITE_BACKEND_PORT ? Number((import.meta as any).env.VITE_BACKEND_PORT) : 3001;
const ENV_BASE_URL = (import.meta as any).env?.VITE_BACKEND_BASE_URL || `http://localhost:${BACKEND_PORT}`;
const LS_BASE_URL_KEY = 'backendBaseUrl';
let RUNTIME_BASE_URL = ENV_BASE_URL;
try {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(LS_BASE_URL_KEY) : null;
  if (stored && /^https?:\/\//i.test(stored)) {
    RUNTIME_BASE_URL = stored;
  }
} catch (_) {
  // ignore
}

export const API_CONFIG = {
  BASE_URL: RUNTIME_BASE_URL,
  ENDPOINTS: {
    GROUPS: '/api/groups',
    PROJECTS: '/api/projects',
    AUTH: '/api/auth',
    ALLOCATION: '/api/allocation'
  },
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json'
  }
} as const;

// Common configuration for API requests
export const createApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
