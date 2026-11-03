import { useEffect, useRef, useState } from "react";
import { request } from "../api.js";

export function PrivacyNoticeContent() {
  return <div className="privacy-notice-content">
    <p className="privacy-updated">Last updated 2 November 2026</p>
    <section>
      <h3>What LIFELOG keeps</h3>
      <p>Your account email and username, the trackers you create, and the entries you record. If you choose Google sign-in, Google also supplies basic profile and account identifiers needed to sign you in.</p>
    </section>
    <section>
      <h3>How it is used</h3>
      <p>This data is used to authenticate you, operate your private tracker, and protect the service. LIFELOG does not sell your personal data or use your entries for advertising.</p>
    </section>
    <section>
      <h3>Storage and sharing</h3>
      <p>Data is shared only with infrastructure and authentication providers needed to run LIFELOG, or where disclosure is legally required. Authentication credentials may be stored in secure cookies or browser storage.</p>
    </section>
    <section>
      <h3>Retention and your choices</h3>
      <p>Your account data is kept while your account exists. You can download a JSON copy or permanently delete your account from the Privacy &amp; data panel. Deleted data may remain temporarily in routine service backups until those backups expire.</p>
    </section>
  </div>;
}

function useDialog(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);
  return ref;
}

export function PrivacyNoticeDialog({ open, onClose }) {
  const dialogRef = useDialog(open, onClose);
  return <dialog className="app-dialog privacy-dialog" ref={dialogRef} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <article className="privacy-panel">
      <header><div><p className="index-tag">PRIVACY / LIFELOG</p><h2>Your log belongs to you.</h2></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close privacy notice">×</button></header>
      <PrivacyNoticeContent />
    </article>
  </dialog>;
}

export function AccountDataDialog({ open, onClose, onAccountDeleted }) {
  const dialogRef = useDialog(open, onClose);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setConfirmation("");
    setBusy("");
    setMessage("");
  }, [open]);

  async function downloadExport() {
    setBusy("export");
    setMessage("");
    try {
      const data = await request("/tracker/profile/export/");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lifelog-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Your export has been downloaded.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (confirmation !== "DELETE") return;
    setBusy("delete");
    setMessage("");
    try {
      await request("/tracker/profile/account/", {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
      });
      onAccountDeleted();
    } catch (error) {
      setMessage(error.message);
      setBusy("");
    }
  }

  return <dialog className="app-dialog account-data-dialog" ref={dialogRef} onCancel={busy ? undefined : onClose}>
    <article className="privacy-panel account-data-panel">
      <header><div><p className="index-tag">ACCOUNT / PRIVACY &amp; DATA</p><h2>Control your data.</h2></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close privacy and data" disabled={Boolean(busy)}>×</button></header>
      <PrivacyNoticeContent />
      <section className="data-export-panel">
        <div><h3>Download your data</h3><p>Get your profile, tracker definitions, dates, and entries as a portable JSON file. Passwords, sessions, and authentication tokens are never included.</p></div>
        <button className="secondary-button" type="button" onClick={downloadExport} disabled={Boolean(busy)}>{busy === "export" ? "PREPARING…" : "DOWNLOAD JSON"}</button>
      </section>
      <form className="danger-zone" onSubmit={deleteAccount}>
        <div><p className="index-tag">DANGER ZONE</p><h3>Delete account</h3><p>This permanently removes your account, trackers, and entries. This action cannot be undone.</p></div>
        <label>Type <strong>DELETE</strong> to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={Boolean(busy)} /></label>
        <button className="destructive-button" type="submit" disabled={confirmation !== "DELETE" || Boolean(busy)}>{busy === "delete" ? "DELETING…" : "DELETE MY ACCOUNT"}</button>
      </form>
      <p className="account-data-message" role="status" aria-live="polite">{message}</p>
    </article>
  </dialog>;
}
