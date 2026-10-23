export function flattenDays(weeks) {
  return (weeks || []).flatMap((week) => week || []);
}

export function updateMonthEntry(monthData, date, trackerId, entry, summary) {
  const day = flattenDays(monthData?.weeks).find((candidate) => candidate.date === date);
  if (!day) return false;

  day.entries ||= {};
  if (entry) day.entries[trackerId] = entry;
  else delete day.entries[trackerId];

  if (summary) {
    monthData.summaries ||= [];
    const index = monthData.summaries.findIndex((item) => item.tracker_id === trackerId);
    if (index === -1) monthData.summaries.push(summary);
    else monthData.summaries[index] = summary;
  }
  return true;
}

export function findSocialProvider(config, providerId) {
  const providers = config?.data?.socialaccount?.providers;
  if (!Array.isArray(providers)) return null;
  return providers.find((provider) => provider?.id === providerId) || null;
}

export function apiBaseUrl(configuredValue, location) {
  const localHosts = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "[::]",
    "[::1]",
    "::",
    "::1",
  ]);
  if (localHosts.has(location.hostname)) {
    // A deployment URL may be embedded in index.html, but a locally served
    // frontend must use the local Django server. Otherwise its CSRF cookie is
    // scoped to the remote API domain and cannot be read by the local page.
    const apiHost = ["[::]", "[::1]", "::", "::1", "0.0.0.0"].includes(location.hostname)
      ? "localhost"
      : location.hostname;
    return `${location.protocol}//${apiHost}:8000/api/v1`;
  }

  const configured = configuredValue?.trim().replace(/\/$/, "");
  return configured || "/api/v1";
}

export function canonicalDevelopmentUrl(location) {
  const aliases = new Set(["0.0.0.0", "[::]", "[::1]", "::", "::1"]);
  if (!aliases.has(location.hostname)) return null;

  const url = new URL(location.href);
  url.hostname = "localhost";
  return url.href;
}

export function dateParts(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatNumber(raw) {
  const number = Number(raw);
  if (!Number.isFinite(number)) return raw ?? "";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(number);
}

export function formatEntry(entry, tracker) {
  if (!entry) return "";
  switch (tracker.tracker_type) {
    case "binary":
      return entry.binary_value === null ? "" : entry.binary_value ? "YES" : "NO";
    case "number":
      return entry.number_value === null
        ? ""
        : `${formatNumber(entry.number_value)}${tracker.unit ? ` ${tracker.unit}` : ""}`;
    case "time":
      return entry.time_value ? entry.time_value.slice(0, 5) : "";
    case "duration": {
      if (entry.duration_minutes === null) return "";
      const hours = Math.floor(entry.duration_minutes / 60);
      const minutes = entry.duration_minutes % 60;
      return hours ? `${hours}h${minutes ? ` ${minutes}m` : ""}` : `${minutes}m`;
    }
    case "text":
      return entry.text_value || "";
    case "rating":
      return entry.rating_value === null
        ? ""
        : `${entry.rating_value}${tracker.max_value ? `/${tracker.max_value}` : ""}`;
    case "prayer": {
      const values = Object.values(entry.prayer_values || {}).filter((value) => value !== null);
      if (!values.length) return "";
      return `${values.filter(Boolean).length}/${values.length}`;
    }
    default:
      return "";
  }
}

export function entryTone(entry, tracker) {
  if (!entry) return "";
  if (tracker.tracker_type === "binary") return entry.binary_value ? "good" : "bad";
  if (tracker.tracker_type === "rating" && entry.rating_value !== null) {
    const min = tracker.min_value ?? 0;
    const max = tracker.max_value ?? 5;
    const progress = (entry.rating_value - min) / Math.max(max - min, 1);
    return progress >= 0.7 ? "good" : progress >= 0.45 ? "warn" : "bad";
  }
  if (tracker.tracker_type === "prayer") {
    const values = Object.values(entry.prayer_values || {}).filter((value) => value !== null);
    if (!values.length) return "";
    const progress = values.filter(Boolean).length / values.length;
    return progress >= 0.8 ? "good" : progress >= 0.5 ? "warn" : "bad";
  }
  return "";
}
