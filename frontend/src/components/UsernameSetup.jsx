import { useState } from "react";
import { request } from "../api.js";

export default function UsernameSetup({ onComplete }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      await request("/tracker/profile/username/", { method: "POST", body: JSON.stringify({ username: form.get("username") }) });
      await onComplete();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="topbar"><div className="brand-group"><span className="index-tag">ACCOUNT SETUP</span><span className="brand-title">LIFELOG</span></div></div>
    <main className="auth-view account-setup-view">
      <form className="auth-panel" onSubmit={submit} aria-busy={saving}>
        <p className="index-tag">ONE LAST STEP</p><h1>Choose a username</h1>
        <p className="form-copy">Pick the name you’ll use on LifeLog. You can use letters, numbers, and @/./+/-/_ characters.</p>
        <label>Username<input name="username" autoComplete="username" maxLength="150" autoFocus required disabled={saving} /></label>
        <p className="form-error" role="alert">{error}</p>
        <button className="log-entry-button form-submit" type="submit" disabled={saving}>CONTINUE</button>
      </form>
    </main>
  </>;
}
