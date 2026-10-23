import { useEffect, useRef, useState } from "react";
import { dateParts, entryTone, flattenDays, formatEntry } from "../../lib.mjs";
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
  const field = { binary: "binary_value", number: "number_value", time: "time_value", duration: "duration_minutes", text: "text_value", rating: "rating_value" }[tracker.tracker_type];
  payload[field] = tracker.tracker_type === "binary" ? value === "true" : value;
  return payload;
}

function initialValue(tracker, entry) {
  if (tracker.tracker_type === "binary") return entry?.binary_value == null ? "" : String(entry.binary_value);
  if (tracker.tracker_type === "number") return entry?.number_value ?? "";
  if (tracker.tracker_type === "duration") return entry?.duration_minutes ?? "";
  if (tracker.tracker_type === "rating") return entry?.rating_value ?? "";
  if (tracker.tracker_type === "time") return entry?.time_value?.slice(0, 5) || "";
  return entry?.text_value || "";
}

function InlineEditor({ tracker, entry, date, onCancel, onSave, onError }) {
  const [value, setValue] = useState(() => tracker.tracker_type === "prayer" ? Object.fromEntries(prayers.map((name) => [name, entry?.prayer_values?.[name] === true])) : initialValue(tracker, entry));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const finished = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    if (["text", "number"].includes(inputRef.current?.type)) inputRef.current.select();
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
      inputRef.current?.focus();
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
    step={tracker.tracker_type === "number" ? "any" : ["duration", "rating"].includes(tracker.tracker_type) ? 1 : undefined}
    placeholder={tracker.tracker_type === "duration" ? "Minutes" : undefined}
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

function MonthTable({ data, loading, activeCell, setActiveCell, onSaved, onError }) {
  const trackers = data?.trackers || [];
  const days = flattenDays(data?.weeks);
  const width = Math.max(110 + trackers.reduce((sum, tracker) => sum + (columnWidths[tracker.tracker_type] || 104), 0), 600);
  return <div className="tracker-table-wrap">
    <table className={`tracker-table${loading ? " is-loading" : ""}`} style={{ width }}>
      <colgroup><col className="col-date" style={{ width: 110 }} />{trackers.map((tracker) => <col key={tracker.id} data-type={tracker.tracker_type} style={{ width: columnWidths[tracker.tracker_type] || 104 }} />)}</colgroup>
      <thead><tr><th scope="col">DATE</th>{trackers.map((tracker) => <th key={tracker.id} scope="col" title={`${tracker.name} · ${tracker.tracker_type}`}>{tracker.name}</th>)}</tr></thead>
      <tbody>{days.map((day) => {
        const rowDate = dateParts(day.date);
        const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(rowDate).toUpperCase();
        return <tr key={day.date} className={day.date === data.today ? "today-row" : ""}>
          <th scope="row" aria-current={day.date === data.today ? "date" : undefined}>{weekday}  {String(day.day).padStart(2, "0")}</th>
          {trackers.map((tracker) => <TrackerCell key={tracker.id} day={day} tracker={tracker} entry={day.entries?.[tracker.id] || day.entries?.[String(tracker.id)] || null} activeCell={activeCell} setActiveCell={setActiveCell} onSaved={onSaved} onError={onError} />)}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function Summary({ data }) {
  const trackers = new Map((data?.trackers || []).map((tracker) => [tracker.id, tracker]));
  const trackedDates = flattenDays(data?.weeks).filter((day) => Object.keys(day.entries || {}).length).length;
  return <section className="summary-section" aria-labelledby="summary-heading">
    <div className="summary-title-row"><h2 id="summary-heading">Monthly averages</h2><span className="index-tag">{trackedDates}/{data?.total_days || 0} DAYS TRACKED</span></div>
    <div className="summary-grid">{(data?.summaries || []).map((summary) => {
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
  const today = new Date();
  const monthText = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(visibleMonth);
  const monthValue = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;

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
      if (result.entry) day.entries[trackerId] = result.entry;
      else delete day.entries[trackerId];
      const summaryIndex = next.summaries.findIndex((item) => item.tracker_id === trackerId);
      if (result.summary && summaryIndex === -1) next.summaries.push(result.summary);
      else if (result.summary) next.summaries[summaryIndex] = result.summary;
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
      <div className="month-toolbar"><h1 id="month-section-label"><time dateTime={monthValue}>{monthText}</time></h1><div className="month-controls" aria-label="Choose month">
        <button className="month-arrow" id="previous-month" type="button" aria-label="Previous month" disabled={loading} onClick={() => setVisibleMonth(monthData ? new Date(monthData.prev_year, monthData.prev_month - 1, 1) : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>‹</button>
        <button className="today-button" type="button" onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Current</button>
        <button className="month-arrow" id="next-month" type="button" aria-label="Next month" disabled={loading} onClick={() => setVisibleMonth(monthData ? new Date(monthData.next_year, monthData.next_month - 1, 1) : new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>›</button>
      </div></div>
      <p className={`app-status${displayStatus ? ` ${localStatus ? "error" : status.type}` : ""}`} role="status" aria-live="polite">{displayStatus}</p>
      <MonthTable data={monthData} loading={loading} activeCell={activeCell} setActiveCell={setActiveCell} onSaved={applyInlineSave} onError={setLocalStatus} />
      <Summary data={monthData} />
    </section></div></main>
    <EntryDialog state={entryDialog} trackers={monthData?.trackers || []} onClose={() => setEntryDialog(null)} onSaved={loadMonth} />
    <TrackerDialog open={trackerDialog} onClose={() => setTrackerDialog(false)} onMonthRefresh={loadMonth} />
  </>;
}
