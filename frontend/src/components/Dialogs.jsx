import { useEffect, useRef, useState } from "react";
import { request } from "../api.js";

const trackerTypes = ["binary", "number", "time", "duration", "text", "rating", "prayer"];
const prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

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
  if (tracker.tracker_type === "duration") Object.assign(props, { min: 0, step: 1, placeholder: "Minutes", defaultValue: entry?.duration_minutes ?? "" });
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
      payload[field] = tracker.tracker_type === "binary" ? value === "true" : value;
      if (value === "" && tracker.tracker_type !== "text") payload.delete_entry = true;
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
      <label>{tracker.tracker_type === "prayer" ? "Prayers" : "Value"}<EntryValue key={`${tracker.id}-${state.date}`} tracker={tracker} entry={state.entry} /></label>
      <p className="form-error" role="alert">{error}</p>
      <div className="dialog-actions">{state.entry && <button className="secondary-button" type="button" onClick={clearEntry} disabled={saving}>CLEAR</button>}<button className="log-entry-button" type="submit" disabled={saving}>SAVE ENTRY</button></div>
    </form>
  </dialog>;
}

function TrackerRow({ tracker, onRefresh, onDelete, setError }) {
  const [values, setValues] = useState(tracker);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(event) {
    event?.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await request(`/tracker/trackers/${tracker.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          tracker_type: values.tracker_type,
          unit: values.unit || null,
          display_order: Number(values.display_order) || 0,
          is_active: values.is_active,
          min_value: values.min_value === "" || values.min_value == null ? null : Number(values.min_value),
          max_value: values.max_value === "" || values.max_value == null ? null : Number(values.max_value),
        }),
      });
      setSaved(true);
      await onRefresh(false);
      window.setTimeout(() => setSaved(false), 1200);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const change = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  return <form className={`tracker-manager-row${saving ? " saving" : ""}${saved ? " saved" : ""}`} onSubmit={save}>
    <input value={values.name} onChange={(event) => change("name", event.target.value)} onBlur={save} aria-label="Tracker name" />
    <select value={values.tracker_type} onChange={(event) => { change("tracker_type", event.target.value); }} onBlur={save} aria-label="Tracker type">{trackerTypes.map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}</select>
    <input value={values.unit || ""} onChange={(event) => change("unit", event.target.value)} onBlur={save} placeholder="Unit" aria-label="Unit" />
    <input type="number" value={values.display_order} onChange={(event) => change("display_order", event.target.value)} onBlur={save} title="Display order" aria-label="Display order" />
    <input type="number" value={values.min_value ?? ""} onChange={(event) => change("min_value", event.target.value)} onBlur={save} placeholder="Min" title="Rating minimum" aria-label="Rating minimum" />
    <input type="number" value={values.max_value ?? ""} onChange={(event) => change("max_value", event.target.value)} onBlur={save} placeholder="Max" title="Rating maximum" aria-label="Rating maximum" />
    <label className="active-toggle"><input type="checkbox" checked={values.is_active} onChange={(event) => change("is_active", event.target.checked)} onBlur={save} />ACTIVE</label>
    <button className="secondary-button" type="submit" disabled={saving}>{saving ? "SAVING" : saved ? "SAVED" : "SAVE"}</button>
    <button className="text-button destructive" type="button" onClick={() => onDelete(tracker)}>DELETE</button>
  </form>;
}

export function TrackerDialog({ open, onClose, onMonthRefresh }) {
  const [trackers, setTrackers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const dialogRef = useModal(open, onClose);

  async function load(refreshMonth = false) {
    setLoading(true);
    try {
      const data = await request("/tracker/trackers/");
      setTrackers(Array.isArray(data) ? data : data.results || []);
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
    try {
      await request("/tracker/trackers/create/", { method: "POST", body: JSON.stringify({
        name: form.get("name"), tracker_type: form.get("tracker_type"), unit: form.get("unit") || null,
        min_value: form.get("min_value") === "" ? null : Number(form.get("min_value")),
        max_value: form.get("max_value") === "" ? null : Number(form.get("max_value")),
        display_order: trackers.length, is_active: true,
      }) });
      formElement.reset();
      await load(true);
    } catch (requestError) {
      setError(requestError.message);
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
  return <>
    <dialog className="app-dialog tracker-dialog" ref={dialogRef} onCancel={onClose}>
      <div className="dialog-form">
        <div className="dialog-heading"><div><p className="index-tag">SETTINGS</p><h2>Trackers</h2></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button></div>
        <div className="tracker-list">
          <div className="tracker-manager-head">{["NAME", "TYPE", "UNIT", "ORDER", "MIN", "MAX", "ACTIVE", "", ""].map((text, index) => <span key={`${text}-${index}`}>{text}</span>)}</div>
          {trackers.map((tracker) => <TrackerRow key={tracker.id} tracker={tracker} onRefresh={async () => { await load(); await onMonthRefresh(); }} onDelete={setDeleteTarget} setError={setError} />)}
          {loading && !trackers.length && <p className="app-status loading">Loading trackers…</p>}
        </div>
        <form className="new-tracker-form" onSubmit={create}>
          <h3>Add tracker</h3>
          <label>Name<input name="name" maxLength="100" required /></label>
          <label>Type<select name="tracker_type">{trackerTypes.map((type) => <option key={type} value={type}>{type === "binary" ? "Yes / No" : type === "text" ? "Text / Notes" : type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
          <label>Unit<input name="unit" maxLength="20" /></label><label>Rating min<input name="min_value" type="number" /></label><label>Rating max<input name="max_value" type="number" /></label>
          <button className="log-entry-button" type="submit">ADD TRACKER</button>
        </form>
        <p className="form-error" role="alert">{error}</p>
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
