export function flattenDays(weeks) {
  return (weeks || []).flatMap((week) => week || []);
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
