export function flattenDays(weeks) {
  return (weeks || []).flatMap((week) => week || []);
}

export function buildTrackerGroups(trackers) {
  const groups = new Map();
  (trackers || []).forEach((tracker, index) => {
    const name = String(tracker.group_name || "").trim();
    const key = name ? name.toLocaleLowerCase() : "__ungrouped__";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: name || "Ungrouped",
        isUngrouped: !name,
        firstIndex: index,
        trackers: [],
      });
    }
    groups.get(key).trackers.push(tracker);
  });
  return [...groups.values()].sort((left, right) => left.firstIndex - right.firstIndex);
}

export function durationHoursFromMinutes(minutes) {
  if (minutes == null || minutes === "") return "";
  return Number((Number(minutes) / 60).toFixed(2));
}

export function durationMinutesFromHours(hours) {
  if (hours == null || hours === "") return "";
  return Math.round(Number(hours) * 60);
}

export function formatDurationHours(minutes) {
  const hours = durationHoursFromMinutes(minutes);
  if (hours === "") return "";
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(hours)}h`;
}

export function summarizeTrackers(trackers, days) {
  return (trackers || []).map((tracker) => {
    const entries = (days || [])
      .map((day) => day.entries?.[tracker.id] || day.entries?.[String(tracker.id)])
      .filter(Boolean);
    const summary = { tracker_id: tracker.id, count: entries.length, display: "—" };
    let values = [];

    if (tracker.tracker_type === "binary") {
      values = entries.map((entry) => entry.binary_value).filter((value) => value != null);
      if (values.length) summary.display = `${Math.round(values.filter(Boolean).length / values.length * 100)}%`;
    } else if (tracker.tracker_type === "number") {
      values = entries.map((entry) => Number(entry.number_value)).filter(Number.isFinite);
      if (values.length) summary.display = `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}${tracker.unit ? ` ${tracker.unit}` : ""}`;
    } else if (tracker.tracker_type === "duration") {
      values = entries.map((entry) => entry.duration_minutes).filter((value) => value != null);
      if (values.length) {
        const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
        summary.display = formatDurationHours(average);
      }
    } else if (tracker.tracker_type === "rating") {
      values = entries.map((entry) => entry.rating_value).filter((value) => value != null);
      if (values.length) summary.display = `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}${tracker.max_value ? `/${tracker.max_value}` : ""}`;
    } else if (tracker.tracker_type === "time") {
      values = entries.map((entry) => entry.time_value).filter(Boolean).map((value) => {
        const [hours, minutes] = value.split(":").map(Number);
        return hours * 60 + minutes;
      });
      if (values.length) {
        const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) % (24 * 60);
        summary.display = `${String(Math.floor(average / 60)).padStart(2, "0")}:${String(average % 60).padStart(2, "0")}`;
      }
    } else if (tracker.tracker_type === "prayer") {
      values = entries.flatMap((entry) => Object.values(entry.prayer_values || {})).filter((value) => value != null);
      if (values.length) summary.display = `${Math.round(values.filter(Boolean).length / values.length * 100)}%`;
    } else if (tracker.tracker_type === "text") {
      values = entries.map((entry) => entry.text_value).filter(Boolean);
      summary.display = `${values.length} ${values.length === 1 ? "note" : "notes"}`;
    }

    return summary;
  });
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
      return formatDurationHours(entry.duration_minutes);
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
  const rule = tracker.color_rule;
  if (rule?.operator && rule.value !== "" && rule.value != null) {
    let actual;
    if (tracker.tracker_type === "number") actual = Number(entry.number_value);
    if (tracker.tracker_type === "duration") actual = Number(entry.duration_minutes) / 60;
    if (tracker.tracker_type === "rating") actual = Number(entry.rating_value);
    if (tracker.tracker_type === "time") actual = entry.time_value?.slice(0, 5);
    if (tracker.tracker_type === "text") actual = entry.text_value;
    if (tracker.tracker_type === "prayer") actual = Object.values(entry.prayer_values || {}).filter(Boolean).length;
    if (actual !== undefined && actual !== null && !(typeof actual === "number" && !Number.isFinite(actual))) {
      const target = rule.value;
      let matches = false;
      if (rule.operator === "gte") matches = actual >= target;
      if (rule.operator === "lte") matches = actual <= target;
      if (rule.operator === "contains") matches = String(actual).toLocaleLowerCase().includes(String(target).toLocaleLowerCase());
      if (rule.operator === "equals") matches = String(actual).toLocaleLowerCase() === String(target).toLocaleLowerCase();
      return matches ? "good" : "bad";
    }
  }
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
