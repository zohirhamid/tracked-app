import React, { useEffect, useRef, useState } from 'react';

const SettingsMenu = ({ onToggleTheme, onLogout, onOpenPlaceholder, onRearrangeColumns }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onMouseDown = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setIsOpen(false);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="settingsMenu" ref={containerRef}>
      <button
        type="button"
        className="settings-btn"
        aria-label="Settings menu"
        title="Settings"
        onClick={() => setIsOpen((v) => !v)}
      >
        ⚙
      </button>

      {isOpen ? (
        <div className="settings-dropdown" role="menu" aria-label="Settings">
          <button
            type="button"
            className="settings-item"
            role="menuitem"
            onClick={() => {
              onOpenPlaceholder?.('Settings');
              setIsOpen(false);
            }}
          >
            Settings
          </button>
          <button
            type="button"
            className="settings-item"
            role="menuitem"
            onClick={() => {
              onToggleTheme?.();
              setIsOpen(false);
            }}
          >
            Toggle theme
          </button>
          <button
            type="button"
            className="settings-item"
            role="menuitem"
            onClick={() => {
              onRearrangeColumns?.();
              setIsOpen(false);
            }}
          >
            Rearrange columns
          </button>

          <div className="settings-sep" />

          <button
            type="button"
            className="settings-item settings-item-muted"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onLogout?.();
            }}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default SettingsMenu;
