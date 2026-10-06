import { dateParts, entryTone, flattenDays, formatEntry } from "./lib.mjs";

const apiMeta = document.querySelector('meta[name="api-base-url"]');
const configuredApiBase = apiMeta?.content.trim().replace(/\/$/, "");
const isLocalFrontend = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE_URL = configuredApiBase || (
  isLocalFrontend
    ? `${window.location.protocol}//${window.location.hostname}:8000/api/v1`
    : "/api/v1"
);
const SESSION_TOKEN_KEY = "lifelog_session_token";

const elements = {
  app: document.querySelector("#app"),
  status: document.querySelector("#app-status"),
  monthHeading: document.querySelector("#month-heading"),
  indexYear: document.querySelector("#index-year"),
  previousMonth: document.querySelector("#previous-month"),
  nextMonth: document.querySelector("#next-month"),
  currentMonth: document.querySelector("#current-month"),
  columns: document.querySelector("#tracker-columns"),
  head: document.querySelector("#tracker-head"),
  body: document.querySelector("#tracker-body"),
  table: document.querySelector(".tracker-table"),
  summaryGrid: document.querySelector("#summary-grid"),
  trackedDays: document.querySelector("#tracked-days"),
  authView: document.querySelector("#auth-view"),
  authForm: document.querySelector("#auth-form"),
  authTitle: document.querySelector("#auth-title"),
  authCopy: document.querySelector("#auth-copy"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authError: document.querySelector("#auth-error"),
  authToggle: document.querySelector("#auth-toggle"),
  googleAuth: document.querySelector("#google-auth"),
  authDivider: document.querySelector("#auth-divider"),
  signOut: document.querySelector("#sign-out"),
  logEntry: document.querySelector("#log-entry"),
  manageTrackers: document.querySelector("#manage-trackers"),
  entryDialog: document.querySelector("#entry-dialog"),
  entryForm: document.querySelector("#entry-form"),
  entryDate: document.querySelector("#entry-date"),
  entryTracker: document.querySelector("#entry-tracker"),
  entryInput: document.querySelector("#entry-input"),
  entryError: document.querySelector("#entry-error"),
  clearEntry: document.querySelector("#clear-entry"),
  trackerDialog: document.querySelector("#tracker-dialog"),
  trackerList: document.querySelector("#tracker-list"),
  trackerError: document.querySelector("#tracker-error"),
  newTrackerForm: document.querySelector("#new-tracker-form"),
};

const today = new Date();
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let monthData = null;
let monthRequestId = 0;
let isSignUp = false;
let editingEntry = null;
let activeInlineEditor = null;

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function getSessionToken() {
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

function setSessionToken(token) {
  if (token) window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  else window.localStorage.removeItem(SESSION_TOKEN_KEY);
}

function errorMessage(payload, fallback = "Request failed") {
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    return payload.errors[0]?.message || payload.errors[0]?.code || fallback;
  }
  if (payload?.detail) return payload.detail;
  if (payload?.error) return payload.error;
  if (payload && typeof payload === "object") {
    const firstFieldError = Object.values(payload).flat().find((value) => typeof value === "string");
    if (firstFieldError) return firstFieldError;
  }
  if (typeof payload === "string" && payload) return payload;
  return fallback;
}

async function request(path, options = {}, retryOnExpiredToken = true) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  const token = getSessionToken();
  if (token) headers.set("X-Session-Token", token);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  const responseToken = payload?.meta?.session_token;
  if (responseToken) setSessionToken(responseToken);

  if (response.status === 410 && retryOnExpiredToken) {
    setSessionToken(null);
    return request(path, options, false);
  }
  if (!response.ok) {
    throw new ApiError(errorMessage(payload, response.statusText), response.status, payload);
  }
  return payload;
}

function setStatus(message = "", type = "") {
  elements.status.textContent = message;
  elements.status.className = `app-status${type ? ` ${type}` : ""}`;
}

function setAuthenticated(isAuthenticated) {
  elements.authView.hidden = isAuthenticated;
  elements.app.hidden = !isAuthenticated;
  elements.logEntry.hidden = !isAuthenticated;
  elements.manageTrackers.hidden = !isAuthenticated;
  elements.signOut.hidden = !isAuthenticated;
}

function columnWidth(tracker) {
  return {
    binary: 88,
    number: 104,
    time: 104,
    duration: 92,
    rating: 84,
    prayer: 112,
    text: 320,
  }[tracker.tracker_type] || 104;
}

function inlineValuePayload(tracker, date, editor) {
  const payload = { tracker_id: tracker.id, date };
  if (tracker.tracker_type === "prayer") {
    payload.prayer_values = Object.fromEntries(
      [...editor.querySelectorAll('input[type="checkbox"]')]
        .map((input) => [input.name, input.checked]),
    );
    return payload;
  }

  const value = editor.value;
  if (value === "") {
    payload.delete_entry = true;
    return payload;
  }
  const field = {
    binary: "binary_value",
    number: "number_value",
    time: "time_value",
    duration: "duration_minutes",
    text: "text_value",
    rating: "rating_value",
  }[tracker.tracker_type];
  payload[field] = tracker.tracker_type === "binary" ? value === "true" : value;
  return payload;
}

function createInlineEditor(tracker, entry) {
  if (tracker.tracker_type === "prayer") {
    const editor = document.createElement("div");
    editor.className = "inline-prayer-editor";
    ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach((prayer) => {
      const label = document.createElement("label");
      label.title = prayer;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = prayer;
      checkbox.checked = entry?.prayer_values?.[prayer] === true;
      label.append(checkbox, document.createTextNode(prayer[0].toUpperCase()));
      editor.append(label);
    });
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "✓";
    save.setAttribute("aria-label", "Save prayer entry");
    editor.append(save);
    return editor;
  }

  if (tracker.tracker_type === "binary") {
    const select = document.createElement("select");
    select.className = "inline-editor";
    [["", "—"], ["true", "YES"], ["false", "NO"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    if (entry?.binary_value !== null && entry?.binary_value !== undefined) {
      select.value = String(entry.binary_value);
    }
    return select;
  }

  const input = document.createElement("input");
  input.className = "inline-editor";
  input.type = tracker.tracker_type === "time"
    ? "time"
    : ["number", "duration", "rating"].includes(tracker.tracker_type) ? "number" : "text";
  if (tracker.tracker_type === "number") {
    input.step = "any";
    input.value = entry?.number_value ?? "";
  } else if (tracker.tracker_type === "duration") {
    input.min = "0";
    input.step = "1";
    input.placeholder = "Minutes";
    input.value = entry?.duration_minutes ?? "";
  } else if (tracker.tracker_type === "rating") {
    input.min = tracker.min_value ?? "";
    input.max = tracker.max_value ?? "";
    input.step = "1";
    input.value = entry?.rating_value ?? "";
  } else if (tracker.tracker_type === "time") {
    input.value = entry?.time_value?.slice(0, 5) || "";
  } else {
    input.value = entry?.text_value || "";
  }
  return input;
}

function startInlineEdit(cell, date, tracker, entry) {
  if (activeInlineEditor?.cell === cell) return;
  if (activeInlineEditor) return;

  const editor = createInlineEditor(tracker, entry);
  let finished = false;
  activeInlineEditor = { cell, editor };
  cell.classList.add("editing");
  cell.replaceChildren(editor);

  const cancel = () => {
    if (finished) return;
    finished = true;
    activeInlineEditor = null;
    renderTable();
  };
  const commit = async () => {
    if (finished) return;
    finished = true;
    cell.classList.add("saving");
    try {
      await request("/tracker/entries/create/", {
        method: "POST",
        body: JSON.stringify(inlineValuePayload(tracker, date, editor)),
      });
      activeInlineEditor = null;
      await loadMonth();
    } catch (error) {
      finished = false;
      cell.classList.remove("saving");
      setStatus(error.message, "error");
      editor.focus?.();
    }
  };

  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  });

  if (tracker.tracker_type === "binary") {
    editor.addEventListener("change", commit);
  } else if (tracker.tracker_type === "prayer") {
    editor.querySelector("button").addEventListener("click", commit);
    editor.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!editor.contains(document.activeElement)) commit();
      }, 0);
    });
    editor.querySelector("input")?.focus();
  } else {
    editor.addEventListener("blur", commit, { once: true });
    editor.focus();
    if (editor.type === "text" || editor.type === "number") editor.select();
  }
}

function renderTable() {
  const trackers = monthData?.trackers || [];
  const days = flattenDays(monthData?.weeks);
  const columns = document.createDocumentFragment();
  const header = document.createDocumentFragment();
  let tableWidth = 110;

  const dateColumn = document.createElement("col");
  dateColumn.className = "col-date";
  dateColumn.style.width = "110px";
  columns.append(dateColumn);
  const dateHeader = document.createElement("th");
  dateHeader.scope = "col";
  dateHeader.textContent = "DATE";
  header.append(dateHeader);

  trackers.forEach((tracker) => {
    const width = columnWidth(tracker);
    const column = document.createElement("col");
    column.style.width = `${width}px`;
    column.dataset.type = tracker.tracker_type;
    columns.append(column);
    tableWidth += width;

    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = tracker.name;
    cell.title = `${tracker.name} · ${tracker.tracker_type}`;
    header.append(cell);
  });

  elements.columns.replaceChildren(columns);
  elements.head.replaceChildren(header);
  elements.table.style.width = `${Math.max(tableWidth, 600)}px`;

  const rows = document.createDocumentFragment();
  days.forEach((day) => {
    const rowDate = dateParts(day.date);
    const row = document.createElement("tr");
    const dateCell = document.createElement("th");
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" })
      .format(rowDate)
      .toUpperCase();
    dateCell.scope = "row";
    dateCell.textContent = `${weekday}  ${String(day.day).padStart(2, "0")}`;
    if (day.date === monthData.today) {
      row.classList.add("today-row");
      dateCell.setAttribute("aria-current", "date");
    }
    row.append(dateCell);

    trackers.forEach((tracker) => {
      const entry = day.entries?.[tracker.id] || day.entries?.[String(tracker.id)] || null;
      const cell = document.createElement("td");
      const value = formatEntry(entry, tracker);
      cell.textContent = value;
      cell.tabIndex = 0;
      cell.dataset.date = day.date;
      cell.dataset.trackerId = tracker.id;
      cell.dataset.type = tracker.tracker_type;
      cell.setAttribute("aria-label", `${tracker.name}, ${day.date}${value ? `: ${value}` : ", empty"}`);
      const tone = entryTone(entry, tracker);
      if (tone) cell.classList.add(tone);
      if (tracker.tracker_type === "text") cell.classList.add("note");
      const open = () => startInlineEdit(cell, day.date, tracker, entry);
      cell.addEventListener("click", (event) => {
        if (event.target === cell) open();
      });
      cell.addEventListener("keydown", (event) => {
        if (event.target === cell && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          open();
        }
      });
      row.append(cell);
    });
    rows.append(row);
  });
  elements.body.replaceChildren(rows);
}

function renderSummaries() {
  const trackersById = new Map((monthData?.trackers || []).map((tracker) => [tracker.id, tracker]));
  const summaries = monthData?.summaries || [];
  const cards = document.createDocumentFragment();
  summaries.forEach((summary) => {
    const tracker = trackersById.get(summary.tracker_id);
    if (!tracker) return;
    const card = document.createElement("article");
    card.className = "summary-card";
    const label = document.createElement("p");
    label.className = "stat-label";
    label.textContent = tracker.name;
    const value = document.createElement("p");
    value.className = "stat-value";
    value.textContent = summary.display;
    const count = document.createElement("p");
    count.className = "summary-count";
    count.textContent = `${summary.count} ${summary.count === 1 ? "entry" : "entries"}`;
    card.append(label, value, count);
    cards.append(card);
  });
  elements.summaryGrid.replaceChildren(cards);
  const trackedDates = flattenDays(monthData?.weeks).filter((day) => Object.keys(day.entries || {}).length).length;
  elements.trackedDays.textContent = `${trackedDates}/${monthData?.total_days || 0} DAYS TRACKED`;
}

function renderMonthHeading() {
  const monthText = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" })
    .format(visibleMonth);
  const monthValue = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  elements.monthHeading.textContent = monthText;
  elements.monthHeading.dateTime = monthValue;
  elements.indexYear.textContent = `(INDEX) ${visibleMonth.getFullYear()}`;
}

async function loadMonth() {
  const requestId = ++monthRequestId;
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth() + 1;
  renderMonthHeading();
  setStatus("Loading month…", "loading");
  elements.table.classList.add("is-loading");
  elements.previousMonth.disabled = true;
  elements.nextMonth.disabled = true;

  try {
    const data = await request(`/tracker/month/${year}/${month}/`);
    if (requestId !== monthRequestId) return;
    monthData = data;
    renderTable();
    renderSummaries();
    setStatus(data.trackers.length ? "" : "No active trackers yet. Add one to begin.", data.trackers.length ? "" : "empty");
  } catch (error) {
    if (requestId !== monthRequestId) return;
    if (error.status === 401 || error.status === 403) {
      setSessionToken(null);
      setAuthenticated(false);
      return;
    }
    setStatus(`${error.message}. Select a month to retry.`, "error");
  } finally {
    if (requestId === monthRequestId) {
      elements.previousMonth.disabled = false;
      elements.nextMonth.disabled = false;
      elements.table.classList.remove("is-loading");
    }
  }
}

function selectedTracker() {
  return monthData?.trackers.find((tracker) => tracker.id === Number(elements.entryTracker.value));
}

function makeInput(type, entry, tracker) {
  const label = document.createElement("label");
  label.textContent = type === "prayer" ? "Prayers" : "Value";

  if (type === "binary") {
    const select = document.createElement("select");
    select.id = "entry-value";
    [["", "Not logged"], ["true", "Yes"], ["false", "No"]].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    });
    if (entry?.binary_value !== null && entry?.binary_value !== undefined) select.value = String(entry.binary_value);
    label.append(select);
  } else if (type === "text") {
    const textarea = document.createElement("textarea");
    textarea.id = "entry-value";
    textarea.rows = 4;
    textarea.value = entry?.text_value || "";
    label.append(textarea);
  } else if (type === "prayer") {
    const group = document.createElement("div");
    group.className = "prayer-inputs";
    ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach((prayer) => {
      const prayerLabel = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = prayer;
      input.checked = entry?.prayer_values?.[prayer] === true;
      prayerLabel.append(input, document.createTextNode(prayer.toUpperCase()));
      group.append(prayerLabel);
    });
    label.append(group);
  } else {
    const input = document.createElement("input");
    input.id = "entry-value";
    input.type = type === "time" ? "time" : "number";
    if (type === "number") {
      input.step = "any";
      input.value = entry?.number_value ?? "";
    } else if (type === "duration") {
      input.min = "0";
      input.step = "1";
      input.placeholder = "Minutes";
      input.value = entry?.duration_minutes ?? "";
    } else if (type === "rating") {
      input.min = tracker.min_value ?? "";
      input.max = tracker.max_value ?? "";
      input.step = "1";
      input.value = entry?.rating_value ?? "";
    } else if (type === "time") {
      input.value = entry?.time_value?.slice(0, 5) || "";
    }
    label.append(input);
  }
  return label;
}

function renderEntryInput() {
  const tracker = selectedTracker();
  elements.entryInput.replaceChildren();
  if (tracker) elements.entryInput.append(makeInput(tracker.tracker_type, editingEntry, tracker));
}

function openEntryDialog(date, trackerId = null, entry = null) {
  if (!monthData?.trackers.length) {
    openTrackerDialog();
    return;
  }
  editingEntry = entry;
  elements.entryError.textContent = "";
  elements.entryDate.value = date;
  elements.entryDate.disabled = Boolean(entry);
  elements.entryTracker.replaceChildren();
  monthData.trackers.forEach((tracker) => {
    const option = document.createElement("option");
    option.value = tracker.id;
    option.textContent = tracker.name;
    elements.entryTracker.append(option);
  });
  elements.entryTracker.value = String(trackerId || monthData.trackers[0].id);
  elements.entryTracker.disabled = Boolean(entry);
  elements.clearEntry.hidden = !entry;
  renderEntryInput();
  elements.entryDialog.showModal();
}

function entryPayload() {
  const tracker = selectedTracker();
  const payload = { tracker_id: tracker.id, date: elements.entryDate.value };
  if (tracker.tracker_type === "prayer") {
    payload.prayer_values = Object.fromEntries(
      [...elements.entryInput.querySelectorAll('input[type="checkbox"]')]
        .map((input) => [input.name, input.checked]),
    );
    return payload;
  }
  const input = elements.entryInput.querySelector("#entry-value");
  const value = input?.value ?? "";
  const field = {
    binary: "binary_value",
    number: "number_value",
    time: "time_value",
    duration: "duration_minutes",
    text: "text_value",
    rating: "rating_value",
  }[tracker.tracker_type];
  payload[field] = tracker.tracker_type === "binary" ? value === "true" : value;
  if (value === "" && tracker.tracker_type !== "text") payload.delete_entry = true;
  return payload;
}

async function saveEntry(event) {
  event.preventDefault();
  elements.entryError.textContent = "";
  try {
    await request("/tracker/entries/create/", {
      method: "POST",
      body: JSON.stringify(entryPayload()),
    });
    elements.entryDialog.close();
    await loadMonth();
  } catch (error) {
    elements.entryError.textContent = error.message;
  }
}

async function clearEntry() {
  const tracker = selectedTracker();
  elements.entryError.textContent = "";
  try {
    if (editingEntry?.id) {
      await request(`/tracker/entries/${editingEntry.id}/delete/`, { method: "DELETE" });
    } else {
      await request("/tracker/entries/create/", {
        method: "POST",
        body: JSON.stringify({
          tracker_id: tracker.id,
          date: elements.entryDate.value,
          delete_entry: true,
        }),
      });
    }
    elements.entryDialog.close();
    await loadMonth();
  } catch (error) {
    elements.entryError.textContent = error.message;
  }
}

function trackerTypeSelect(tracker) {
  const select = document.createElement("select");
  ["binary", "number", "time", "duration", "text", "rating", "prayer"].forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type.toUpperCase();
    select.append(option);
  });
  select.value = tracker.tracker_type;
  return select;
}

function trackerField(value, type = "text") {
  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  return input;
}

function renderTrackerManager(trackers) {
  const fragment = document.createDocumentFragment();
  const headings = document.createElement("div");
  headings.className = "tracker-manager-head";
  ["NAME", "TYPE", "UNIT", "ORDER", "MIN", "MAX", "ACTIVE", "", ""].forEach((text) => {
    const label = document.createElement("span");
    label.textContent = text;
    headings.append(label);
  });
  trackers.forEach((tracker) => {
    const row = document.createElement("form");
    row.className = "tracker-manager-row";
    row.dataset.id = tracker.id;
    const name = trackerField(tracker.name);
    name.name = "name";
    const type = trackerTypeSelect(tracker);
    type.name = "tracker_type";
    const unit = trackerField(tracker.unit || "");
    unit.name = "unit";
    unit.placeholder = "Unit";
    const order = trackerField(tracker.display_order, "number");
    order.name = "display_order";
    order.title = "Display order";
    const min = trackerField(tracker.min_value, "number");
    min.name = "min_value";
    min.placeholder = "Min";
    min.title = "Rating minimum";
    const max = trackerField(tracker.max_value, "number");
    max.name = "max_value";
    max.placeholder = "Max";
    max.title = "Rating maximum";
    const activeLabel = document.createElement("label");
    activeLabel.className = "active-toggle";
    const active = document.createElement("input");
    active.type = "checkbox";
    active.name = "is_active";
    active.checked = tracker.is_active;
    activeLabel.append(active, document.createTextNode("ACTIVE"));
    const save = document.createElement("button");
    save.className = "secondary-button";
    save.type = "submit";
    save.textContent = "SAVE";
    const remove = document.createElement("button");
    remove.className = "text-button destructive";
    remove.type = "button";
    remove.textContent = "DELETE";

    row.append(name, type, unit, order, min, max, activeLabel, save, remove);
    let saving = false;
    let saveAgain = false;
    const saveTracker = async () => {
      if (saving) {
        saveAgain = true;
        return;
      }
      saving = true;
      row.classList.add("saving");
      save.disabled = true;
      save.textContent = "SAVING";
      elements.trackerError.textContent = "";
      try {
        await request(`/tracker/trackers/${tracker.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.value,
            tracker_type: type.value,
            unit: unit.value || null,
            display_order: Number(order.value) || 0,
            is_active: active.checked,
            min_value: min.value === "" ? null : Number(min.value),
            max_value: max.value === "" ? null : Number(max.value),
          }),
        });
        await loadMonth();
        row.classList.add("saved");
        save.textContent = "SAVED";
        window.setTimeout(() => {
          row.classList.remove("saved");
          if (!saving) save.textContent = "SAVE";
        }, 1200);
      } catch (error) {
        elements.trackerError.textContent = error.message;
        save.textContent = "RETRY";
      } finally {
        saving = false;
        row.classList.remove("saving");
        save.disabled = false;
        if (saveAgain) {
          saveAgain = false;
          saveTracker();
        }
      }
    };
    row.addEventListener("submit", (event) => {
      event.preventDefault();
      saveTracker();
    });
    [name, unit, order, min, max].forEach((field) => field.addEventListener("blur", saveTracker));
    type.addEventListener("change", saveTracker);
    active.addEventListener("change", saveTracker);
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Delete ${name.value}? Its entries will also be removed.`)) return;
      try {
        await request(`/tracker/trackers/${tracker.id}/delete/`, { method: "DELETE" });
        await loadTrackerManager();
        await loadMonth();
      } catch (error) {
        elements.trackerError.textContent = error.message;
      }
    });
    fragment.append(row);
  });
  elements.trackerList.replaceChildren(headings, fragment);
}

async function loadTrackerManager() {
  const trackers = await request("/tracker/trackers/");
  renderTrackerManager(Array.isArray(trackers) ? trackers : trackers.results || []);
}

async function openTrackerDialog() {
  elements.trackerError.textContent = "";
  elements.trackerDialog.showModal();
  try {
    await loadTrackerManager();
  } catch (error) {
    elements.trackerError.textContent = error.message;
  }
}

async function createTracker(event) {
  event.preventDefault();
  elements.trackerError.textContent = "";
  try {
    await request("/tracker/trackers/create/", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#new-tracker-name").value,
        tracker_type: document.querySelector("#new-tracker-type").value,
        unit: document.querySelector("#new-tracker-unit").value || null,
        min_value: document.querySelector("#new-tracker-min").value === ""
          ? null
          : Number(document.querySelector("#new-tracker-min").value),
        max_value: document.querySelector("#new-tracker-max").value === ""
          ? null
          : Number(document.querySelector("#new-tracker-max").value),
        display_order: elements.trackerList.children.length,
        is_active: true,
      }),
    });
    elements.newTrackerForm.reset();
    await loadTrackerManager();
    await loadMonth();
  } catch (error) {
    elements.trackerError.textContent = error.message;
  }
}

function updateAuthMode() {
  elements.authTitle.textContent = isSignUp ? "Create account" : "Sign in";
  elements.authCopy.textContent = isSignUp
    ? "Create a private account for your trackers."
    : "Sign in to load your trackers.";
  elements.authPassword.autocomplete = isSignUp ? "new-password" : "current-password";
  elements.authForm.querySelector('[type="submit"]').textContent = isSignUp ? "CREATE ACCOUNT" : "SIGN IN";
  elements.authToggle.textContent = isSignUp ? "Already have an account? Sign in" : "Create an account";
  elements.authError.textContent = "";
}

async function submitAuth(event) {
  event.preventDefault();
  elements.authError.textContent = "";
  const submit = elements.authForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const path = isSignUp ? "/_allauth/app/v1/auth/signup" : "/_allauth/app/v1/auth/login";
    await request(path, {
      method: "POST",
      body: JSON.stringify({ email: elements.authEmail.value, password: elements.authPassword.value }),
    });
    setAuthenticated(true);
    await loadMonth();
  } catch (error) {
    elements.authError.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

async function signOut() {
  try {
    await request("/_allauth/app/v1/auth/session", { method: "DELETE" });
  } catch (error) {
    if (![401, 410].includes(error.status)) setStatus(error.message, "error");
  } finally {
    setSessionToken(null);
    monthData = null;
    setAuthenticated(false);
  }
}

async function setupGoogleSignIn() {
  try {
    const config = await request("/config/public/");
    const clientId = config?.google_client_id;
    if (!clientId) return;

    const loadGoogle = new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      const script = existing || document.createElement("script");
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      if (!existing) {
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.append(script);
      }
    });
    await loadGoogle;

    elements.googleAuth.hidden = false;
    elements.authDivider.hidden = false;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        if (!credential) return;
        elements.authError.textContent = "";
        try {
          await request("/_allauth/app/v1/auth/provider/token", {
            method: "POST",
            body: JSON.stringify({
              provider: "google",
              process: "login",
              token: { client_id: clientId, id_token: credential },
            }),
          });
          setAuthenticated(true);
          await loadMonth();
        } catch (error) {
          elements.authError.textContent = error.message;
        }
      },
    });
    window.google.accounts.id.renderButton(elements.googleAuth, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 380,
    });
  } catch (_error) {
    // Google is optional; email/password authentication remains available.
  }
}

async function bootstrap() {
  setAuthenticated(false);
  try {
    const session = await request("/_allauth/app/v1/auth/session");
    if (!session?.data?.user) throw new ApiError("Not authenticated", 401, session);
    setAuthenticated(true);
    await loadMonth();
  } catch (error) {
    if (![401, 403, 410].includes(error.status)) elements.authError.textContent = error.message;
    setAuthenticated(false);
  }
}

elements.previousMonth.addEventListener("click", () => {
  visibleMonth = monthData
    ? new Date(monthData.prev_year, monthData.prev_month - 1, 1)
    : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  loadMonth();
});
elements.nextMonth.addEventListener("click", () => {
  visibleMonth = monthData
    ? new Date(monthData.next_year, monthData.next_month - 1, 1)
    : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  loadMonth();
});
elements.currentMonth.addEventListener("click", () => {
  visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  loadMonth();
});
elements.logEntry.addEventListener("click", () => {
  const currentMonthVisible = visibleMonth.getFullYear() === today.getFullYear()
    && visibleMonth.getMonth() === today.getMonth();
  const date = currentMonthVisible
    ? [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-")
    : [visibleMonth.getFullYear(), String(visibleMonth.getMonth() + 1).padStart(2, "0"), "01"].join("-");
  openEntryDialog(date);
});
elements.manageTrackers.addEventListener("click", openTrackerDialog);
elements.entryTracker.addEventListener("change", () => {
  editingEntry = null;
  elements.clearEntry.hidden = true;
  renderEntryInput();
});
elements.entryForm.addEventListener("submit", saveEntry);
elements.clearEntry.addEventListener("click", clearEntry);
elements.newTrackerForm.addEventListener("submit", createTracker);
elements.authForm.addEventListener("submit", submitAuth);
elements.authToggle.addEventListener("click", () => {
  isSignUp = !isSignUp;
  updateAuthMode();
});
elements.signOut.addEventListener("click", signOut);
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close());
});

renderMonthHeading();
updateAuthMode();
setupGoogleSignIn();
bootstrap();
