import { useEffect, useRef, useState } from "react";

export default function HeaderMenu({ onSettings, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const firstItemRef = useRef(null);
  const aboutRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    firstItemRef.current?.focus();
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const dialog = aboutRef.current;
    if (!dialog) return;
    if (aboutOpen && !dialog.open) dialog.showModal();
    if (!aboutOpen && dialog.open) dialog.close();
  }, [aboutOpen]);

  function choose(action) {
    setOpen(false);
    action();
  }

  return <>
    <div className="topbar-menu" ref={rootRef}>
      <button
        className="topbar-menu-trigger"
        type="button"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open menu"
        onClick={() => setOpen((current) => !current)}
      ><span>MENU</span><i aria-hidden="true"><b /><b /><b /></i></button>
      {open && <div className="topbar-dropdown" role="menu" aria-label="Account menu">
        <p className="topbar-dropdown-label">LIFELOG / MENU</p>
        <button ref={firstItemRef} className="topbar-menu-item" type="button" role="menuitem" onClick={() => choose(onSettings)}>
          <span>01</span><strong>Settings</strong><small>Trackers and display</small><i aria-hidden="true">→</i>
        </button>
        <button className="topbar-menu-item" type="button" role="menuitem" onClick={() => choose(() => setAboutOpen(true))}>
          <span>02</span><strong>About</strong><small>About LIFELOG</small><i aria-hidden="true">→</i>
        </button>
        <button className="topbar-menu-signout" type="button" role="menuitem" onClick={() => choose(onSignOut)}>Sign out <span aria-hidden="true">↗</span></button>
      </div>}
    </div>

    <dialog className="app-dialog about-dialog" ref={aboutRef} onCancel={() => setAboutOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setAboutOpen(false); }}>
      <article className="about-panel">
        <header><div><p className="index-tag">ABOUT / LIFELOG</p><h2>A clearer view of your days.</h2></div><button className="dialog-close" type="button" onClick={() => setAboutOpen(false)} aria-label="Close about">×</button></header>
        <p className="about-lead">LIFELOG is a focused daily tracker: a spreadsheet when you want the whole picture, and a simple form when you just need to log today.</p>
        <div className="about-principles">
          <div><span>01</span><strong>Notice patterns</strong><p>Keep the signals that matter together without turning life into noise.</p></div>
          <div><span>02</span><strong>Stay flexible</strong><p>Add, group, pause, or refine trackers as your priorities change.</p></div>
        </div>
        <footer><span>LIFELOG</span><small>BUILT FOR CONSISTENCY, NOT PERFECTION.</small></footer>
      </article>
    </dialog>
  </>;
}
