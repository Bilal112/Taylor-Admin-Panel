import axios, { type InternalAxiosRequestConfig, type AxiosError } from "axios";

// Auth now rides on an httpOnly cookie set by the backend (see AuthContext) —
// this axios instance no longer reads/writes a token itself. withCredentials
// is required so the browser actually sends/receives that cookie on
// cross-origin requests (frontend and backend are different origins).
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

// In-memory CSRF token, set once after login/refresh (see AuthContext) and
// echoed back on every state-changing request. Deliberately not read from
// localStorage/cookie here — see setCsrfToken's comment for why the module
// variable is enough. Read-only cookie access for CSRF (unlike the httpOnly
// auth cookie) would also work, but keeping a single source of truth in JS
// avoids a page needing to re-parse document.cookie on every request.
let csrfToken: string | null = null;
export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method || "get").toUpperCase();
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

// Redirect on 401 — session cookie missing/expired/invalid.
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      setCsrfToken(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

export default api;
