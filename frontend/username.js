import { apiBaseUrl, canonicalDevelopmentUrl } from "./lib.mjs";

const canonicalUrl = canonicalDevelopmentUrl(window.location);
if (canonicalUrl) window.location.replace(canonicalUrl);

const apiMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = apiBaseUrl(apiMeta?.content, window.location);
const SESSION_TOKEN_KEY = "lifelog_session_token";
const form = document.querySelector("#username-form");
const input = document.querySelector("#username");
const error = document.querySelector("#username-error");
const submit = form.querySelector('[type="submit"]');

function errorMessage(payload, fallback = "Request failed") {
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    const firstError = payload.errors[0];
    return firstError?.message || firstError?.code || fallback;
  }
  if (payload?.username) return payload.username[0];
  if (payload?.detail) return payload.detail;
  return fallback;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
  if (token) headers.set("X-Session-Token", token);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const payload = await response.json();
  if (!response.ok) {
    const requestError = new Error(errorMessage(payload, response.statusText));
    requestError.status = response.status;
    throw requestError;
  }
  return payload;
}

async function verifySession() {
  form.setAttribute("aria-busy", "true");
  submit.disabled = true;
  try {
    const session = await request("/_allauth/app/v1/auth/session", { method: "GET" });
    if (!session?.data?.user) throw Object.assign(new Error("Not authenticated"), { status: 401 });
    const profile = await request("/tracker/profile/username/", { method: "GET" });
    if (profile.is_complete) {
      window.location.replace("index.html");
      return;
    }
  } catch (requestError) {
    window.location.replace("index.html");
  } finally {
    form.setAttribute("aria-busy", "false");
    submit.disabled = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  submit.disabled = true;
  try {
    await request("/tracker/profile/username/", {
      method: "POST",
      body: JSON.stringify({ username: input.value }),
    });
    window.location.replace("index.html");
  } catch (requestError) {
    if ([401, 403, 410].includes(requestError.status)) {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      window.location.replace("index.html");
      return;
    }
    error.textContent = requestError.message;
  } finally {
    submit.disabled = false;
  }
});

if (!canonicalUrl) verifySession();
