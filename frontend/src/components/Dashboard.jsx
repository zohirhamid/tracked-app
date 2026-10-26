import { useEffect, useRef, useState } from "react";
import { dateParts, durationHoursFromMinutes, durationMinutesFromHours, entryTone, flattenDays, formatEntry, summarizeTrackers } from "../../lib.mjs";
import { request } from "../api.js";
import { EntryDialog, TrackerDialog } from "./Dialogs.jsx";

const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const columnWidths = { binary: 88, number: 104, time: 104, duration: 92, rating: 84, prayer: 112, text: 320 };

function valuePayload(tracker, date, value) {
  const payload = { tracker_id: tracker.id, date };
  if (tracker.tracker_type === "prayer") {
    payload.prayer_values = value;
    return payload;
  }
  if (value === "") {
    payload.delete_entry = true;
    return payload;
  }
  if (tracker.tracker_type === "duration") {
    payload.duration_minutes = durationMinutesFromHours(value);
    return payload;
  }
  const field = { binary: "binary_value", number: "number_value", time: "time_value", duration: "duration_minutes", text: "text_value", rating: "rating_value" }[tracker.tracker_type];
  payload[field] = tracker.tracker_type === "binary" ? value === "true" : value;
  return payload;
}

function initialValue(tracker, entry) {
  if (tracker.tracker_type === "binary") return entry?.binary_value == null ? "" : String(entry.binary_value);
  if (tracker.tracker_type === "number") return entry?.number_value ?? "";
  if (tracker.tracker_type === "duration") return durationHoursFromMinutes(entry?.duration_minutes);
  if (tracker.tracker_type === "rating") return entry?.rating_value ?? "";
  if (tracker.tracker_type === "time") return entry?.time_value?.slice(0, 5) || "";
  return entry?.text_value || "";
}

function InlineEditor({ tracker, entry, date, onCancel, onSave, onError }) {
  const [value, setValue] = useState(() => tracker.tracker_type === "prayer" ? Object.fromEntries(prayers.map((name) => [name, entry?.prayer_values?.[name] === true])) : initialValue(tracker, entry));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const finished = useRef(false);

  function focusEditor() {
    const input = inputRef.current;
    if (!input) return;
    const tableWrap = input.closest(".tracker-table-wrap");
    const scrollLeft = tableWrap?.scrollLeft;
    input.focus({ preventScroll: true });
    if (["text", "number"].includes(input.type)) input.select();
    if (tableWrap && scrollLeft != null) tableWrap.scrollLeft = scrollLeft;
  }

  useEffect(() => {
    focusEditor();
  }, []);

  async function commit(nextValue = value) {
    if (saving || finished.current) return;
    setSaving(true);
    try {
      const result = await request("/tracker/entries/create/", { method: "POST", body: JSON.stringify(valuePayload(tracker, date, nextValue)) });
      finished.current = true;
      onSave(result);
    } catch (requestError) {
      setSaving(false);
      onError(requestError.message);
      focusEditor();
    }
  }

  function keyDown(event) {
    if (event.key === "Escape") { event.preventDefault(); finished.current = true; onCancel(); }
    if (event.key === "Enter") { event.preventDefault(); commit(); }
  }

  if (tracker.tracker_type === "prayer") return <div className={`inline-prayer-editor${saving ? " saving" : ""}`} onKeyDown={keyDown}>
    {prayers.map((prayer, index) => <label key={prayer} title={prayer}><input ref={index === 0 ? inputRef : undefined} type="checkbox" name={prayer} checked={value[prayer]} onChange={(event) => setValue((current) => ({ ...current, [prayer]: event.target.checked }))} />{prayer[0].toUpperCase()}</label>)}
    <button type="button" onClick={() => commit()} aria-label="Save prayer entry">✓</button>
  </div>;

  if (tracker.tracker_type === "binary") return <select ref={inputRef} className="inline-editor" value={value} onChange={(event) => { setValue(event.target.value); commit(event.target.value); }} onKeyDown={keyDown} disabled={saving}><option value="">—</option><option value="true">YES</option><option value="false">NO</option></select>;

  const type = tracker.tracker_type === "time" ? "time" : ["number", "duration", "rating"].includes(tracker.tracker_type) ? "number" : "text";
  return <input
    ref={inputRef} className="inline-editor" type={type} value={value} disabled={saving}
    min={tracker.tracker_type === "duration" ? 0 : tracker.tracker_type === "rating" ? tracker.min_value ?? undefined : undefined}
    max={tracker.tracker_type === "rating" ? tracker.max_value ?? undefined : undefined}
    step={["number", "duration"].includes(tracker.tracker_type) ? "any" : tracker.tracker_type === "rating" ? 1 : undefined}
    placeholder={tracker.tracker_type === "duration" ? "Hours" : undefined}
    onChange={(event) => setValue(event.target.value)} onKeyDown={keyDown} onBlur={() => commit()}
  />;
}

function TrackerCell({ day, tracker, entry, activeCell, setActiveCell, onSaved, onError }) {
  const editing = activeCell === `${day.date}:${tracker.id}`;
  const value = formatEntry(entry, tracker);
  if (editing) return <td className="editing" data-type={tracker.tracker_type}>
    <InlineEditor tracker={tracker} entry={entry} date={day.date} onCancel={() => setActiveCell(null)} onSave={(result) => { setActiveCell(null); onSaved(day.date, tracker.id, result); }} onError={onError} />
  </td>;
  const open = () => setActiveCell(`${day.date}:${tracker.id}`);
  const tone = entryTone(entry, tracker);
  return <td
    tabIndex="0" data-date={day.date} data-tracker-id={tracker.id} data-type={tracker.tracker_type}
    className={`${tone}${tracker.tracker_type === "text" ? `${tone ? " " : ""}note` : ""}`}
    aria-label={`${tracker.name}, ${day.date}${value ? `: ${value}` : ", empty"}`}
    onClick={open} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }}
  >{value}</td>;
}

function TrackerTable({ data, days, loading, activeCell, setActiveCell, onSaved, onError }) {
  const trackers = data?.trackers || [];
  const width = Math.max(110 + trackers.reduce((sum, tracker) => sum + (columnWidths[tracker.tracker_type] || 104), 0), 600);
  return <div className="tracker-table-wrap">
    <table className={`tracker-table${loading ? " is-loading" : ""}`} style={{ width }}>
      <colgroup><col className="col-date" style={{ width: 110 }} />{trackers.map((tracker) => <col key={tracker.id} data-type={tracker.tracker_type} style={{ width: columnWidths[tracker.tracker_type] || 104 }} />)}</colgroup>
      <thead><tr><th scope="col">DATE</th>{trackers.map((tracker) => <th key={tracker.id} scope="col" title={`${tracker.name} · ${tracker.tracker_type}`}>{tracker.name}</th>)}</tr></thead>
      <tbody>{days.map((day) => {
        const rowDate = dateParts(day.date);
        const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(rowDate).toUpperCase();
        return <tr key={day.date} className={`${day.date === data.today ? "today-row" : ""}${day.outside_month ? " outside-month" : ""}`}>
          <th scope="row" aria-current={day.date === data.today ? "date" : undefined}>{weekday}  {String(day.day).padStart(2, "0")}</th>
          {trackers.map((tracker) => <TrackerCell key={tracker.id} day={day} tracker={tracker} entry={day.entries?.[tracker.id] || day.entries?.[String(tracker.id)] || null} activeCell={activeCell} setActiveCell={setActiveCell} onSaved={onSaved} onError={onError} />)}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function Summary({ data, days, viewMode }) {
  const trackers = new Map((data?.trackers || []).map((tracker) => [tracker.id, tracker]));
  const trackedDates = days.filter((day) => Object.keys(day.entries || {}).length).length;
  const summaries = viewMode === "week" ? summarizeTrackers(data?.trackers, days) : data?.summaries || [];
  return <section className="summary-section" aria-labelledby="summary-heading">
    <div className="summary-title-row"><h2 id="summary-heading">{viewMode === "week" ? "Weekly" : "Monthly"} averages</h2><span className="index-tag">{trackedDates}/{viewMode === "week" ? days.length : data?.total_days || 0} DAYS TRACKED</span></div>
    <div className="summary-grid">{summaries.map((summary) => {
      const tracker = trackers.get(summary.tracker_id);
      return tracker ? <article className="summary-card" key={summary.tracker_id}><p className="stat-label">{tracker.name}</p><p className="stat-value">{summary.display}</p><p className="summary-count">{summary.count} {summary.count === 1 ? "entry" : "entries"}</p></article> : null;
    })}</div>
  </section>;
}

export default function Dashboard({ visibleMonth, setVisibleMonth, monthData, setMonthData, loading, status, loadMonth, onSignOut }) {
  const [entryDialog, setEntryDialog] = useState(null);
  const [trackerDialog, setTrackerDialog] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [localStatus, setLocalStatus] = useState("");
  const [viewMode, setViewMode] = useState("month");
  const [weekIndex, setWeekIndex] = useState(0);
  const today = new Date();
  const monthText = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(visibleMonth);
  const monthValue = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const weeks = monthData?.weeks || [];
  const monthDays = flattenDays(weeks).filter((day) => !day.outside_month);
  const loadedMonthKey = monthDays[0]?.date.slice(0, 7);
  const activeWeek = weeks[Math.min(weekIndex, Math.max(weeks.length - 1, 0))] || [];
  const visibleDays = viewMode === "week" ? activeWeek : monthDays;

  useEffect(() => {
    if (!monthData?.weeks?.length) return;
    const todayIndex = monthData.weeks.findIndex((week) => week.some((day) => day.date === monthData.today));
    setWeekIndex(todayIndex >= 0 ? todayIndex : 0);
    setActiveCell(null);
  }, [loadedMonthKey]);

  const weekText = (() => {
    if (!activeWeek.length) return monthText;
    const start = dateParts(activeWeek[0].date);
    const end = dateParts(activeWeek[activeWeek.length - 1].date);
    const startText = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(start);
    const endText = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(end);
    return `${startText} – ${endText}`;
  })();

  function selectMonth(monthNumber) {
    if (monthNumber === visibleMonth.getMonth() + 1) return;
    setActiveCell(null);
    setVisibleMonth(new Date(visibleMonth.getFullYear(), monthNumber - 1, 1));
  }

  function openNewEntry() {
    if (!monthData?.trackers.length) { setTrackerDialog(true); return; }
    const current = visibleMonth.getFullYear() === today.getFullYear() && visibleMonth.getMonth() === today.getMonth();
    const date = current ? [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-") : `${monthValue}-01`;
    setEntryDialog({ date, trackerId: monthData.trackers[0].id, entry: null });
  }

  function applyInlineSave(date, trackerId, result) {
    setMonthData((current) => {
      const next = structuredClone(current);
      const day = flattenDays(next.weeks).find((candidate) => candidate.date === date);
      if (!day) return current;
      day.entries ||= {};
      if (result.entry) day.entries[trackerId] = result.entry;
      else delete day.entries[trackerId];
      if (date.startsWith(monthValue)) {
        const summaryIndex = next.summaries.findIndex((item) => item.tracker_id === trackerId);
        if (result.summary && summaryIndex === -1) next.summaries.push(result.summary);
        else if (result.summary) next.summaries[summaryIndex] = result.summary;
      }
      return next;
    });
    setLocalStatus("");
  }

  const displayStatus = localStatus || status.message;
  return <>
    <div className="topbar">
      <div className="brand-group"><span className="index-tag" id="index-year">(INDEX) {visibleMonth.getFullYear()}</span><a className="brand-title" href="/">LIFELOG</a></div>
      <div className="topbar-actions"><button className="secondary-button" type="button" onClick={() => setTrackerDialog(true)}>TRACKERS</button><button className="log-entry-button" type="button" onClick={openNewEntry}>+ LOG ENTRY</button><button className="secondary-button" type="button" onClick={onSignOut}>SIGN OUT</button></div>
    </div>
    <main id="app"><div className="dashboard-content"><section className="month-section" aria-labelledby="month-section-label">
      <div className="month-toolbar"><div className="period-heading"><h1 id="month-section-label"><time dateTime={viewMode === "week" ? activeWeek[0]?.date : monthValue}>{viewMode === "week" ? weekText : monthText}</time></h1><div className="view-switch" role="group" aria-label="Calendar view"><button type="button" className={viewMode === "month" ? "active" : ""} aria-pressed={viewMode === "month"} onClick={() => setViewMode("month")}>MONTH</button><button type="button" className={viewMode === "week" ? "active" : ""} aria-pressed={viewMode === "week"} onClick={() => setViewMode("week")}>WEEK</button></div></div></div>
      <p className={`app-status${displayStatus ? ` ${localStatus ? "error" : status.type}` : ""}`} role="status" aria-live="polite">{displayStatus}</p>
      <TrackerTable data={monthData} days={visibleDays} loading={loading} activeCell={activeCell} setActiveCell={setActiveCell} onSaved={applyInlineSave} onError={setLocalStatus} />
      <nav className="month-tab-strip" aria-label={`Months in ${visibleMonth.getFullYear()}`}>
        <div className="month-tab-rail">
          <span className="month-tab-year" aria-hidden="true">{visibleMonth.getFullYear()}</span>
          <div className="month-tabs" role="tablist" aria-label="Choose month">
            {(monthData?.months || []).map((month) => {
              const selected = month.number === visibleMonth.getMonth() + 1;
              const current = visibleMonth.getFullYear() === today.getFullYear() && month.number === today.getMonth() + 1;
              return <button
                key={month.number}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-current={current ? "date" : undefined}
                className={`${selected ? "active" : ""}${current ? `${selected ? " " : ""}current-month` : ""}`}
                disabled={loading}
                onClick={() => selectMonth(month.number)}
              >{month.name.toUpperCase()}</button>;
            })}
          </div>
        </div>
      </nav>
      <Summary data={monthData} days={visibleDays} viewMode={viewMode} />
    </section></div></main>
    <EntryDialog state={entryDialog} trackers={monthData?.trackers || []} onClose={() => setEntryDialog(null)} onSaved={loadMonth} />
    <TrackerDialog open={trackerDialog} onClose={() => setTrackerDialog(false)} onMonthRefresh={loadMonth} />
  </>;
}
