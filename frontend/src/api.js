import { apiBaseUrl } from "../lib.mjs";

const apiMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = apiBaseUrl(apiMeta?.content, window.location);
const API_IS_SAME_ORIGIN = new URL(API_BASE_URL, window.location.href).origin === window.location.origin;
const SESSION_TOKEN_KEY = "lifelog_session_token";
let crossOriginCsrfToken = "";
let csrfTokenRequest = null;

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function csrfToken() {
  if (API_IS_SAME_ORIGIN) {
    const cookie = document.cookie.split("; ").find((item) => item.startsWith("csrftoken="));
    if (cookie) return decodeURIComponent(cookie.split("=").slice(1).join("="));
  }
  return crossOriginCsrfToken;
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function errorMessage(payload, fallback = "Request failed") {
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    return payload.errors[0]?.message || payload.errors[0]?.code || fallback;
  }
  if (payload?.detail) return payload.detail;
  if (payload?.error) return payload.error;
  if (payload && typeof payload === "object") {
    const first = Object.values(payload).flat().find((value) => typeof value === "string");
    if (first) return first;
  }
  return typeof payload === "string" && payload ? payload : fallback;
}

export async function ensureCsrfToken() {
  const existingToken = csrfToken();
  if (existingToken) return existingToken;

  if (!csrfTokenRequest) {
    csrfTokenRequest = fetch(apiUrl("/auth/csrf/"), {
      headers: { Accept: "application/json" },
      credentials: "include",
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) {
        throw new ApiError(errorMessage(payload, response.statusText), response.status, payload);
      }
      if (!payload?.csrf_token) throw new ApiError("CSRF token was not returned", 500, payload);
      crossOriginCsrfToken = payload.csrf_token;
      return crossOriginCsrfToken;
    }).finally(() => {
      csrfTokenRequest = null;
    });
  }

  return csrfTokenRequest;
}

export function clearSessionToken() {
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
  crossOriginCsrfToken = "";
}

export async function request(path, options = {}, retryOnExpiredToken = true) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
  if (token) headers.set("X-Session-Token", token);
  const method = (options.method || "GET").toUpperCase();
  const isUnsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  const csrf = isUnsafe && !token && !path.startsWith("/_allauth/app/")
    ? await ensureCsrfToken()
    : csrfToken();
  if (csrf && isUnsafe) {
    headers.set("X-CSRFToken", csrf);
  }
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(apiUrl(path), { ...options, headers, credentials: "include" });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (payload?.meta?.session_token) window.localStorage.setItem(SESSION_TOKEN_KEY, payload.meta.session_token);
  if (response.status === 410 && retryOnExpiredToken) {
    clearSessionToken();
    return request(path, options, false);
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status) && !path.startsWith("/_allauth/")) {
      clearSessionToken();
      window.dispatchEvent(new Event("lifelog:unauthenticated"));
    }
    throw new ApiError(errorMessage(payload, response.statusText), response.status, payload);
  }
  return payload;
}
