import { useEffect, useRef, useState } from "react";
import { durationHoursFromMinutes, durationMinutesFromHours } from "../../lib.mjs";
import { request } from "../api.js";

const trackerTypes = ["binary", "number", "time", "duration", "text", "rating", "prayer"];
const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const trackerTypeDetails = {
  binary: { label: "Yes / No", glyph: "Y/N", description: "A simple completed or not completed check." },
  number: { label: "Number", glyph: "123", description: "Any numeric value, with an optional unit." },
  time: { label: "Time", glyph: "12:", description: "A specific time of day." },
  duration: { label: "Duration", glyph: "HR", description: "A length of time recorded in decimal hours, such as 7.5." },
  text: { label: "Notes", glyph: "TXT", description: "Short notes or journal-style entries." },
  rating: { label: "Rating", glyph: "★", description: "A score within a range you choose." },
  prayer: { label: "Prayer", glyph: "5×", description: "Track the five daily prayers together." },
};

const colorRuleOptions = {
  number: [["gte", "At least"], ["lte", "At most"]],
  duration: [["gte", "At least"], ["lte", "At most"]],
  rating: [["gte", "At least"], ["lte", "At most"]],
  time: [["gte", "At or after"], ["lte", "At or before"]],
  text: [["contains", "Contains"], ["equals", "Exactly matches"]],
  prayer: [["gte", "At least"]],
};

function ColorRuleFields({ type, rule, onChange }) {
  if (type === "binary") return <p className="tracker-type-help color-rule-fixed">Cell colours: YES is good and NO is bad.</p>;
  const options = colorRuleOptions[type] || [];
  const operator = rule?.operator || "";
  const inputType = type === "time" ? "time" : ["number", "duration", "rating", "prayer"].includes(type) ? "number" : "text";
  const placeholder = type === "duration" ? "e.g. 8 hours" : type === "prayer" ? "1–5" : type === "text" ? "Text to match" : "Target";
  const setOperator = (nextOperator) => onChange(nextOperator ? { operator: nextOperator, value: type === "prayer" ? 5 : type === "time" ? "22:00" : "" } : {});
  return <fieldset className="tracker-color-rule">
    <legend>Cell colours <span className="field-hint">Optional</span></legend>
    <p>Choose what should count as good. Other logged values will be marked bad.</p>
    <div className="tracker-color-rule-fields">
      <label>Good when<select value={operator} onChange={(event) => setOperator(event.target.value)}><option value="">No custom rule</option>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {operator && <label>{type === "duration" ? "Hours" : type === "prayer" ? "Prayers" : "Target"}<input type={inputType} min={type === "duration" ? 0 : type === "prayer" ? 1 : undefined} max={type === "prayer" ? 5 : undefined} step={["number", "duration"].includes(type) ? "any" : undefined} value={rule?.value ?? ""} placeholder={placeholder} onChange={(event) => onChange({ operator, value: event.target.value })} required /></label>}
    </div>
  </fieldset>;
}

function useModal(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [open, onClose]);
  return ref;
}

function EntryValue({ tracker, entry }) {
  if (tracker.tracker_type === "binary") return <select name="value" defaultValue={entry?.binary_value == null ? "" : String(entry.binary_value)}><option value="">Not logged</option><option value="true">Yes</option><option value="false">No</option></select>;
  if (tracker.tracker_type === "text") return <textarea name="value" rows="4" defaultValue={entry?.text_value || ""} />;
  if (tracker.tracker_type === "prayer") return <div className="prayer-inputs">{prayers.map((prayer) => <label key={prayer}><input type="checkbox" name={prayer} defaultChecked={entry?.prayer_values?.[prayer] === true} />{prayer.toUpperCase()}</label>)}</div>;
  const props = { name: "value", type: tracker.tracker_type === "time" ? "time" : "number" };
  if (tracker.tracker_type === "number") Object.assign(props, { step: "any", defaultValue: entry?.number_value ?? "" });
  if (tracker.tracker_type === "duration") Object.assign(props, { min: 0, step: "any", placeholder: "Hours", defaultValue: durationHoursFromMinutes(entry?.duration_minutes) });
  if (tracker.tracker_type === "rating") Object.assign(props, { min: tracker.min_value ?? "", max: tracker.max_value ?? "", step: 1, defaultValue: entry?.rating_value ?? "" });
  if (tracker.tracker_type === "time") props.defaultValue = entry?.time_value?.slice(0, 5) || "";
  return <input {...props} />;
}

export function EntryDialog({ state, trackers, onClose, onSaved }) {
  const [trackerId, setTrackerId] = useState(state?.trackerId || trackers[0]?.id || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useModal(Boolean(state), onClose);
  const tracker = trackers.find((item) => item.id === Number(trackerId));

  useEffect(() => {
    setTrackerId(state?.trackerId || trackers[0]?.id || "");
    setError("");
  }, [state, trackers]);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { tracker_id: tracker.id, date: state.date };
    if (tracker.tracker_type === "prayer") {
      payload.prayer_values = Object.fromEntries(prayers.map((prayer) => [prayer, form.get(prayer) === "on"]));
    } else {
      const value = form.get("value") ?? "";
      const field = { binary: "binary_value", number: "number_value", time: "time_value", duration: "duration_minutes", text: "text_value", rating: "rating_value" }[tracker.tracker_type];
      if (value === "" && tracker.tracker_type !== "text") payload.delete_entry = true;
      else if (tracker.tracker_type === "duration") payload[field] = durationMinutesFromHours(value);
      else payload[field] = tracker.tracker_type === "binary" ? value === "true" : value;
    }
    setSaving(true);
    setError("");
    try {
      await request("/tracker/entries/create/", { method: "POST", body: JSON.stringify(payload) });
      onClose();
      await onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearEntry() {
    setSaving(true);
    setError("");
    try {
      if (state.entry?.id) await request(`/tracker/entries/${state.entry.id}/delete/`, { method: "DELETE" });
      else await request("/tracker/entries/create/", { method: "POST", body: JSON.stringify({ tracker_id: tracker.id, date: state.date, delete_entry: true }) });
      onClose();
      await onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (!state || !tracker) return null;
  return <dialog className="app-dialog" ref={dialogRef} onCancel={onClose}>
    <form className="dialog-form" onSubmit={submit}>
      <div className="dialog-heading"><div><p className="index-tag">ENTRY</p><h2>Log entry</h2></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button></div>
      <label>Date<input name="date" type="date" defaultValue={state.date} disabled={Boolean(state.entry)} required /></label>
      <label>Tracker<select value={trackerId} onChange={(event) => setTrackerId(event.target.value)} disabled={Boolean(state.entry)} required>{trackers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>{tracker.tracker_type === "prayer" ? "Prayers" : tracker.tracker_type === "duration" ? "Hours" : "Value"}<EntryValue key={`${tracker.id}-${state.date}`} tracker={tracker} entry={state.entry} /></label>
      <p className="form-error" role="alert">{error}</p>
      <div className="dialog-actions">{state.entry && <button className="secondary-button" type="button" onClick={clearEntry} disabled={saving}>CLEAR</button>}<button className="log-entry-button" type="submit" disabled={saving}>SAVE ENTRY</button></div>
    </form>
  </dialog>;
}

function GroupNameField({ value, onChange, groupNames, name }) {
  return <label className="tracker-group-field">Column group <span className="field-hint">Optional</span>
    <input name={name} list="tracker-group-options" value={value} onChange={onChange} maxLength="80" placeholder="e.g. Diet, Exercise, Sleep" />
    <small>Trackers with the same group name appear together under one heading.</small>
    <datalist id="tracker-group-options">{groupNames.map((groupName) => <option value={groupName} key={groupName} />)}</datalist>
  </label>;
}

function TrackerEditor({ tracker, groupNames, onSaved, onDelete, setError }) {
  const [values, setValues] = useState(tracker);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues(tracker);
  }, [tracker]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await request(`/tracker/trackers/${tracker.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          group_name: values.group_name?.trim() || "",
          tracker_type: values.tracker_type,
          unit: values.tracker_type === "number" ? values.unit || null : values.tracker_type === "duration" ? "h" : null,
          display_order: Number(values.display_order) || 0,
          is_active: values.is_active,
          min_value: values.tracker_type !== "rating" || values.min_value === "" || values.min_value == null ? null : Number(values.min_value),
          max_value: values.tracker_type !== "rating" || values.max_value === "" || values.max_value == null ? null : Number(values.max_value),
          color_rule: values.tracker_type === "binary" ? {} : values.color_rule || {},
        }),
      });
      setSaved(true);
      await onSaved(tracker.id);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const change = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const details = trackerTypeDetails[values.tracker_type];
  return <form className={`tracker-editor${saving ? " saving" : ""}`} onSubmit={save}>
    <div className="tracker-editor-heading">
      <div><p className="index-tag">EDIT TRACKER</p><h3>{tracker.name}</h3></div>
      <span className={`tracker-state${values.is_active ? " active" : ""}`}>{values.is_active ? "Active" : "Paused"}</span>
    </div>
    <div className="tracker-field-grid">
      <label className="tracker-name-field">Name<input value={values.name} onChange={(event) => change("name", event.target.value)} maxLength="100" required autoFocus /></label>
      <label>Position<input type="number" min="0" value={values.display_order} onChange={(event) => change("display_order", event.target.value)} /></label>
      <GroupNameField value={values.group_name || ""} onChange={(event) => change("group_name", event.target.value)} groupNames={groupNames} />
    </div>
    <fieldset className="tracker-type-fieldset">
      <legend>Format</legend>
      <div className="tracker-type-grid">{trackerTypes.map((type) => <label className={`tracker-type-option${values.tracker_type === type ? " selected" : ""}`} key={type}>
        <input type="radio" name="tracker_type" value={type} checked={values.tracker_type === type} onChange={() => change("tracker_type", type)} />
        <span className="tracker-type-glyph">{trackerTypeDetails[type].glyph}</span><span>{trackerTypeDetails[type].label}</span>
      </label>)}</div>
      <p className="tracker-type-help">{details.description}</p>
    </fieldset>
    {values.tracker_type === "number" && <label>Unit <span className="field-hint">Optional</span><input value={values.unit || ""} onChange={(event) => change("unit", event.target.value)} maxLength="20" placeholder="e.g. km, pages, glasses" /></label>}
    {values.tracker_type === "rating" && <div className="tracker-field-grid">
      <label>Minimum<input type="number" value={values.min_value ?? ""} onChange={(event) => change("min_value", event.target.value)} placeholder="1" /></label>
      <label>Maximum<input type="number" value={values.max_value ?? ""} onChange={(event) => change("max_value", event.target.value)} placeholder="5" /></label>
    </div>}
    <ColorRuleFields type={values.tracker_type} rule={values.color_rule} onChange={(rule) => change("color_rule", rule)} />
    <label className="tracker-visibility-toggle">
      <span><strong>Show in tracker grid</strong><small>Paused trackers keep their history but disappear from the month view.</small></span>
      <input type="checkbox" checked={values.is_active} onChange={(event) => change("is_active", event.target.checked)} />
    </label>
    <div className="tracker-editor-actions">
      <button className="text-button destructive" type="button" onClick={() => onDelete(tracker)}>DELETE TRACKER</button>
      <button className="log-entry-button" type="submit" disabled={saving}>{saving ? "SAVING…" : saved ? "SAVED ✓" : "SAVE CHANGES"}</button>
    </div>
  </form>;
}

function NewTrackerForm({ groupNames, onCreate, onCancel, creating }) {
  const [type, setType] = useState("binary");
  const [colorRule, setColorRule] = useState({});
  const [groupName, setGroupName] = useState("");
  const details = trackerTypeDetails[type];
  return <form className="tracker-editor new-tracker-editor" onSubmit={onCreate}>
    <div className="tracker-editor-heading"><div><p className="index-tag">NEW TRACKER</p><h3>What do you want to track?</h3></div></div>
    <label>Name<input name="name" maxLength="100" placeholder="e.g. Read, Mood, Water" required autoFocus /></label>
    <GroupNameField name="group_name" value={groupName} onChange={(event) => setGroupName(event.target.value)} groupNames={groupNames} />
    <fieldset className="tracker-type-fieldset">
      <legend>Format</legend>
      <div className="tracker-type-grid">{trackerTypes.map((value) => <label className={`tracker-type-option${type === value ? " selected" : ""}`} key={value}>
        <input type="radio" name="tracker_type" value={value} checked={type === value} onChange={() => { setType(value); setColorRule({}); }} />
        <span className="tracker-type-glyph">{trackerTypeDetails[value].glyph}</span><span>{trackerTypeDetails[value].label}</span>
      </label>)}</div>
      <p className="tracker-type-help">{details.description}</p>
    </fieldset>
    {type === "number" && <label>Unit <span className="field-hint">Optional</span><input name="unit" maxLength="20" placeholder="e.g. km, pages, glasses" /></label>}
    {type === "rating" && <div className="tracker-field-grid"><label>Minimum<input name="min_value" type="number" placeholder="1" /></label><label>Maximum<input name="max_value" type="number" placeholder="5" /></label></div>}
    <ColorRuleFields type={type} rule={colorRule} onChange={setColorRule} />
    <input type="hidden" name="color_rule" value={JSON.stringify(colorRule)} />
    <div className="tracker-editor-actions"><button className="secondary-button" type="button" onClick={onCancel}>CANCEL</button><button className="log-entry-button" type="submit" disabled={creating}>{creating ? "ADDING…" : "ADD TRACKER"}</button></div>
  </form>;
}

export function TrackerDialog({ open, onClose, onMonthRefresh }) {
  const [trackers, setTrackers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const dialogRef = useModal(open, onClose);

  async function load(refreshMonth = false) {
    setLoading(true);
    try {
      const data = await request("/tracker/trackers/");
      const nextTrackers = Array.isArray(data) ? data : data.results || [];
      setTrackers(nextTrackers);
      setSelectedId((current) => nextTrackers.some((tracker) => tracker.id === current) ? current : nextTrackers[0]?.id ?? null);
      if (refreshMonth) await onMonthRefresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) load(); }, [open]);

  async function create(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setCreating(true);
    try {
      const created = await request("/tracker/trackers/create/", { method: "POST", body: JSON.stringify({
        name: form.get("name"), tracker_type: form.get("tracker_type"), unit: form.get("tracker_type") === "duration" ? "h" : form.get("unit") || null,
        group_name: form.get("group_name")?.trim() || "",
        min_value: !form.get("min_value") ? null : Number(form.get("min_value")),
        max_value: !form.get("max_value") ? null : Number(form.get("max_value")),
        color_rule: JSON.parse(form.get("color_rule") || "{}"),
        display_order: trackers.length, is_active: true,
      }) });
      await load(true);
      setSelectedId(created.id);
      setShowNew(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  async function remove() {
    try {
      await request(`/tracker/trackers/${deleteTarget.id}/delete/`, { method: "DELETE" });
      setDeleteTarget(null);
      await load(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (!open) return null;
  const selectedTracker = trackers.find((tracker) => tracker.id === selectedId);
  const groupNames = [...new Set(trackers.map((tracker) => tracker.group_name).filter(Boolean))];
  return <>
    <dialog className="app-dialog tracker-dialog" ref={dialogRef} onCancel={onClose} aria-labelledby="tracker-dialog-title">
      <div className="tracker-dialog-shell">
        <div className="tracker-dialog-heading"><div><p className="index-tag">SETTINGS</p><h2 id="tracker-dialog-title">Your trackers</h2><p>Choose what appears in your monthly grid.</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button></div>
        <div className="tracker-manager-layout">
          <aside className="tracker-sidebar">
            <button className="add-tracker-button" type="button" onClick={() => setShowNew(true)}><span>+</span> NEW TRACKER</button>
            <div className="tracker-list" role="listbox" aria-label="Trackers">
              {trackers.map((tracker) => <button type="button" role="option" aria-selected={!showNew && tracker.id === selectedId} className={`tracker-list-item${!showNew && tracker.id === selectedId ? " selected" : ""}`} key={tracker.id} onClick={() => { setSelectedId(tracker.id); setShowNew(false); setError(""); }}>
                <span className="tracker-list-glyph">{trackerTypeDetails[tracker.tracker_type]?.glyph}</span>
                <span className="tracker-list-copy"><strong>{tracker.name}</strong><small>{tracker.group_name ? `${tracker.group_name} · ` : ""}{trackerTypeDetails[tracker.tracker_type]?.label}{tracker.tracker_type === "duration" ? " · h" : tracker.unit ? ` · ${tracker.unit}` : ""}</small></span>
                {!tracker.is_active && <span className="tracker-paused-dot" title="Paused">○</span>}
              </button>)}
              {loading && !trackers.length && <p className="tracker-empty-state">Loading trackers…</p>}
              {!loading && !trackers.length && <p className="tracker-empty-state">No trackers yet.<br />Add one to build your grid.</p>}
            </div>
          </aside>
          <section className="tracker-detail-panel">
            {showNew ? <NewTrackerForm groupNames={groupNames} onCreate={create} onCancel={() => setShowNew(false)} creating={creating} /> : selectedTracker ? <TrackerEditor key={selectedTracker.id} tracker={selectedTracker} groupNames={groupNames} onSaved={async (id) => { await load(); setSelectedId(id); await onMonthRefresh(); }} onDelete={setDeleteTarget} setError={setError} /> : <div className="tracker-detail-empty"><span>+</span><h3>Build your tracker grid</h3><p>Add a tracker to start logging what matters to you.</p><button className="log-entry-button" type="button" onClick={() => setShowNew(true)}>ADD YOUR FIRST TRACKER</button></div>}
            {error && <p className="form-error tracker-dialog-error" role="alert">{error}</p>}
          </section>
        </div>
      </div>
    </dialog>
    {deleteTarget && <ConfirmDelete tracker={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={remove} />}
  </>;
}

function ConfirmDelete({ tracker, onCancel, onConfirm }) {
  const dialogRef = useModal(true, onCancel);
  return <dialog className="app-dialog confirmation-dialog" ref={dialogRef} onCancel={onCancel} aria-labelledby="delete-tracker-title" aria-describedby="delete-tracker-copy">
    <div className="dialog-form confirmation-panel">
      <div className="confirmation-mark" aria-hidden="true">!</div><div><p className="index-tag">DESTRUCTIVE ACTION</p><h2 id="delete-tracker-title">Delete tracker?</h2></div>
      <p className="confirmation-copy" id="delete-tracker-copy"><strong>{tracker.name}</strong> and all of its entries will be permanently removed. This cannot be undone.</p>
      <div className="dialog-actions confirmation-actions"><button className="secondary-button" type="button" onClick={onCancel} autoFocus>CANCEL</button><button className="destructive-button" type="button" onClick={onConfirm}>DELETE TRACKER</button></div>
    </div>
  </dialog>;
}
