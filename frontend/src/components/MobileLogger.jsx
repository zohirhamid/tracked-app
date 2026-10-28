import { useEffect, useMemo, useState } from "react";
import { durationHoursFromMinutes, durationMinutesFromHours, entryTone, flattenDays, formatEntry } from "../../lib.mjs";
import { request } from "../api.js";

const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const moodFaces = [
  { face: "😣", label: "Rough" },
  { face: "😕", label: "Low" },
  { face: "😐", label: "Meh" },
  { face: "🙂", label: "Good" },
  { face: "😁", label: "Great" },
];

function localDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function entryFor(day, trackerId) {
  return day?.entries?.[trackerId] || day?.entries?.[String(trackerId)] || null;
}

function initialValue(tracker, entry) {
  if (tracker.tracker_type === "binary") return entry?.binary_value == null ? "" : String(entry.binary_value);
  if (tracker.tracker_type === "number") return entry?.number_value ?? "";
  if (tracker.tracker_type === "duration") return durationHoursFromMinutes(entry?.duration_minutes);
  if (tracker.tracker_type === "rating") return entry?.rating_value ?? "";
  if (tracker.tracker_type === "time") return entry?.time_value?.slice(0, 5) || "";
  if (tracker.tracker_type === "prayer") return Object.fromEntries(prayers.map((name) => [name, entry?.prayer_values?.[name] === true]));
  return entry?.text_value || "";
}

function entryPayload(tracker, date, value) {
  const payload = { tracker_id: tracker.id, date };
  if (tracker.tracker_type === "prayer") {
    payload.prayer_values = value;
    return payload;
  }
  if (value === "" || value == null) {
    payload.delete_entry = true;
    return payload;
  }
  if (tracker.tracker_type === "duration") payload.duration_minutes = durationMinutesFromHours(value);
  else if (tracker.tracker_type === "binary") payload.binary_value = value === "true";
  else payload[`${tracker.tracker_type}_value`] = value;
  return payload;
}

function ratingChoices(tracker) {
  const min = Number(tracker.min_value ?? 1);
  const max = Number(tracker.max_value ?? 5);
  return moodFaces.map((item, index) => ({
    ...item,
    value: Math.round(min + ((max - min) * index) / 4),
  }));
}

function TrackerControl({ tracker, value, onChange }) {
  if (tracker.tracker_type === "binary") return <div className="mobile-choice-grid two" role="group" aria-label={tracker.name}>
    <button type="button" className={value === "false" ? "selected" : ""} aria-pressed={value === "false"} onClick={() => onChange("false")}><span>×</span>No</button>
    <button type="button" className={value === "true" ? "selected" : ""} aria-pressed={value === "true"} onClick={() => onChange("true")}><span>✓</span>Yes</button>
  </div>;

  if (tracker.tracker_type === "rating") return <div className="mood-picker" role="radiogroup" aria-label={tracker.name}>
    {ratingChoices(tracker).map((choice) => <button
      type="button"
      key={`${choice.label}-${choice.value}`}
      className={Number(value) === choice.value ? "selected" : ""}
      role="radio"
      aria-checked={Number(value) === choice.value}
      onClick={() => onChange(String(choice.value))}
    ><span aria-hidden="true">{choice.face}</span><small>{choice.label}</small></button>)}
  </div>;

  if (tracker.tracker_type === "prayer") return <div className="prayer-picker" role="group" aria-label={tracker.name}>
    {prayers.map((prayer) => <button
      type="button"
      key={prayer}
      className={value?.[prayer] ? "selected" : ""}
      aria-pressed={Boolean(value?.[prayer])}
      onClick={() => onChange({ ...value, [prayer]: !value?.[prayer] })}
    ><span>{value?.[prayer] ? "✓" : "○"}</span>{prayer}</button>)}
  </div>;

  if (tracker.tracker_type === "text") return <textarea className="mobile-textarea" rows="4" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Add a note about your day…" />;

  const type = tracker.tracker_type === "time" ? "time" : "number";
  return <div className="mobile-input-wrap">
    <input
      type={type}
      value={value}
      min={tracker.tracker_type === "duration" ? 0 : undefined}
      step={["number", "duration"].includes(tracker.tracker_type) ? "any" : undefined}
      onChange={(event) => onChange(event.target.value)}
      placeholder={tracker.tracker_type === "duration" ? "0.0" : "Enter value"}
    />
    {tracker.tracker_type === "duration" ? <span>hours</span> : tracker.unit ? <span>{tracker.unit}</span> : null}
  </div>;
}

function DayCompletion({ day, trackers }) {
  const filled = trackers.filter((tracker) => entryFor(day, tracker.id)).length;
  const ratio = trackers.length ? filled / trackers.length : 0;
  return <span className="mobile-completion" aria-label={`${filled} of ${trackers.length} entries logged`}><i style={{ width: `${ratio * 100}%` }} /></span>;
}

function WeekOverview({ week, trackers, today, onChooseDay }) {
  return <section className="mobile-week-overview" aria-label="Weekly overview">
    {week.map((day) => {
      const dateValue = dateFromKey(day.date);
      const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(dateValue);
      const entries = trackers.map((tracker) => ({ tracker, entry: entryFor(day, tracker.id) })).filter((item) => item.entry);
      return <button type="button" className={day.date === today ? "today" : ""} key={day.date} onClick={() => onChooseDay(day.date)}>
        <span className="mobile-week-date"><strong>{String(day.day).padStart(2, "0")}</strong><small>{dayName}</small></span>
        <span className="mobile-week-values">
          {entries.length ? entries.slice(0, 3).map(({ tracker, entry }) => <span className={entryTone(entry, tracker)} key={tracker.id}><b>{tracker.name}</b>{formatEntry(entry, tracker)}</span>) : <em>Nothing logged</em>}
          {entries.length > 3 ? <em>+{entries.length - 3} more</em> : null}
        </span>
        <DayCompletion day={day} trackers={trackers} />
      </button>;
    })}
  </section>;
}

function MonthOverview({ weeks, trackers, today, onChooseDay }) {
  return <section className="mobile-month-overview" aria-label="Monthly overview">
    <div className="mobile-calendar-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="mobile-calendar-grid">
      {flattenDays(weeks).map((day) => {
        const filled = trackers.filter((tracker) => entryFor(day, tracker.id)).length;
        return <button
          type="button"
          key={day.date}
          className={`${day.outside_month ? "outside" : ""}${day.date === today ? " today" : ""}${filled ? " has-data" : ""}`}
          onClick={() => onChooseDay(day.date)}
        >
          <span>{day.day}</span>
          <i>{filled || ""}</i>
          <DayCompletion day={day} trackers={trackers} />
        </button>;
      })}
    </div>
    <div className="mobile-calendar-legend"><span><i />Entries logged</span><span>Tap a date to edit</span></div>
  </section>;
}

export default function MobileLogger({ visibleMonth, setVisibleMonth, monthData, loading, status, loadMonth, onManageTrackers, onSignOut }) {
  const [view, setView] = useState("day");
  const [date, setDate] = useState(() => localDateKey(new Date()));
  const [draft, setDraft] = useState({});
  const [dirty, setDirty] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const trackers = monthData?.trackers || [];
  const day = useMemo(() => flattenDays(monthData?.weeks || []).find((item) => item.date === date), [monthData, date]);
  const activeWeek = useMemo(() => (monthData?.weeks || []).find((week) => week.some((item) => item.date === date)) || [], [monthData, date]);
  const selectedDate = dateFromKey(date);
  const isToday = date === localDateKey(new Date());

  useEffect(() => {
    if (!monthData) return;
    setDraft(Object.fromEntries(trackers.map((tracker) => [tracker.id, initialValue(tracker, entryFor(day, tracker.id))])));
    setDirty([]);
  }, [date, monthData]);

  function moveDay(amount) {
    const next = dateFromKey(date);
    next.setDate(next.getDate() + amount);
    const nextKey = localDateKey(next);
    setMessage("");
    setDate(nextKey);
    if (next.getFullYear() !== visibleMonth.getFullYear() || next.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  function moveMonth(amount) {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
    setMessage("");
    setDate(localDateKey(next));
    setVisibleMonth(next);
  }

  function movePeriod(amount) {
    if (view === "month") moveMonth(amount);
    else moveDay(amount * (view === "week" ? 7 : 1));
  }

  function chooseDay(nextDate) {
    const next = dateFromKey(nextDate);
    setDate(nextDate);
    setView("day");
    if (next.getFullYear() !== visibleMonth.getFullYear() || next.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  function update(trackerId, value) {
    setDraft((current) => ({ ...current, [trackerId]: value }));
    setDirty((current) => current.includes(trackerId) ? current : [...current, trackerId]);
    setMessage("");
  }

  async function save(event) {
    event.preventDefault();
    if (!dirty.length || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const changedTrackers = trackers.filter((tracker) => dirty.includes(tracker.id));
      await Promise.all(changedTrackers.map((tracker) => request("/tracker/entries/create/", {
        method: "POST",
        body: JSON.stringify(entryPayload(tracker, date, draft[tracker.id])),
      })));
      await loadMonth();
      setDirty([]);
      setMessage("Day saved");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const prettyDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate);
  const year = selectedDate.getFullYear();
  const weekLabel = activeWeek.length ? `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dateFromKey(activeWeek[0].date))} – ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dateFromKey(activeWeek[activeWeek.length - 1].date))}` : "This week";
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(visibleMonth);
  const heading = view === "month" ? monthLabel : view === "week" ? weekLabel : isToday ? "Today" : prettyDate;

  return <div className="mobile-logger-shell">
    <header className="mobile-logger-topbar">
      <a className="brand-title" href="/">LIFELOG</a>
      <div><button type="button" onClick={onManageTrackers}>TRACKERS</button><button type="button" onClick={onSignOut}>SIGN OUT</button></div>
    </header>

    <main className="mobile-logger-main">
      <nav className="mobile-view-tabs" aria-label="Mobile tracker view">
        <button type="button" className={view === "day" ? "active" : ""} aria-current={view === "day" ? "page" : undefined} onClick={() => setView("day")}>LOG</button>
        <button type="button" className={view === "week" ? "active" : ""} aria-current={view === "week" ? "page" : undefined} onClick={() => setView("week")}>WEEK</button>
        <button type="button" className={view === "month" ? "active" : ""} aria-current={view === "month" ? "page" : undefined} onClick={() => setView("month")}>MONTH</button>
      </nav>
      <section className="mobile-day-heading" aria-labelledby="mobile-day-title">
        <p className="index-tag">{view === "day" ? "DAILY LOG" : view === "week" ? "WEEKLY VIEW" : "MONTHLY VIEW"} · {year}</p>
        <div className="mobile-date-row">
          <button type="button" onClick={() => movePeriod(-1)} aria-label={`Previous ${view}`}>←</button>
          <div><h1 id="mobile-day-title">{heading}</h1>{view === "day" && isToday && <p>{prettyDate}</p>}</div>
          <button type="button" onClick={() => movePeriod(1)} aria-label={`Next ${view}`}>→</button>
        </div>
      </section>

      {loading && !monthData ? <p className="mobile-form-status">Loading your trackers…</p> : null}
      {!loading && !trackers.length ? <section className="mobile-empty-state"><span>＋</span><h2>Build your daily log</h2><p>Add a tracker for anything you want to notice each day.</p><button className="log-entry-button" type="button" onClick={onManageTrackers}>ADD A TRACKER</button></section> : null}

      {trackers.length > 0 && view === "week" && <WeekOverview week={activeWeek} trackers={trackers} today={monthData?.today} onChooseDay={chooseDay} />}
      {trackers.length > 0 && view === "month" && <MonthOverview weeks={monthData?.weeks || []} trackers={trackers} today={monthData?.today} onChooseDay={chooseDay} />}

      {trackers.length > 0 && view === "day" && <form className="mobile-day-form" onSubmit={save}>
        <div className="mobile-form-intro"><span>{trackers.length} prompts</span><p>Tap, type, and save when your day feels complete.</p></div>
        {trackers.map((tracker, index) => <fieldset className="mobile-tracker-field" key={tracker.id}>
          <legend><span>{String(index + 1).padStart(2, "0")}</span><strong>{tracker.name}</strong>{tracker.unit && tracker.tracker_type !== "number" ? <small>{tracker.unit}</small> : null}</legend>
          <TrackerControl tracker={tracker} value={draft[tracker.id] ?? (tracker.tracker_type === "prayer" ? {} : "")} onChange={(value) => update(tracker.id, value)} />
        </fieldset>)}

        <div className="mobile-save-dock">
          <p className={message && message !== "Day saved" ? "error" : ""} role="status">{message || status.message}</p>
          <button className="mobile-save-button" type="submit" disabled={!dirty.length || saving}>{saving ? "SAVING…" : dirty.length ? `SAVE DAY · ${dirty.length} CHANGED` : "DAY UP TO DATE"}</button>
        </div>
      </form>}
    </main>
  </div>;
}
