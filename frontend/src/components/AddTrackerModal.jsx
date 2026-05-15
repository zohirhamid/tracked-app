import React, { useEffect, useMemo, useRef, useState } from 'react';

const TYPE_OPTIONS = [
  { ui: 'number', icon: '123', label: 'Number' },
  { ui: 'check', icon: '✓', label: 'Check' },
  { ui: 'mood', icon: '•••', label: 'Mood' },
  { ui: 'text', icon: 'Aa', label: 'Text' },
  { ui: 'time', icon: '⏱', label: 'Time' },
  { ui: 'prayer', icon: '☪', label: 'Prayer' },
  { ui: 'percent', icon: '%', label: 'Percent' },
];

const mapUiTypeToTracker = (uiType, unitInput) => {
  switch (uiType) {
    case 'check':
      return { tracker_type: 'binary', unit: null };
    case 'mood':
      return { tracker_type: 'rating', unit: null };
    case 'time':
      return { tracker_type: 'time', unit: null };
    case 'prayer':
      return { tracker_type: 'prayer', unit: null };
    case 'text':
      return { tracker_type: 'text', unit: unitInput || null };
    case 'percent':
      return { tracker_type: 'number', unit: unitInput || '%' };
    case 'number':
    default:
      return { tracker_type: 'number', unit: unitInput || null };
  }
};

const AddTrackerModal = ({ isOpen, onClose, onAdd }) => {
  const nameRef = useRef(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [uiType, setUiType] = useState('number');

  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleAdd = async () => {
    if (!canSubmit) return;
    const mapped = mapUiTypeToTracker(uiType, unit.trim());
    await onAdd({
      name: name.trim(),
      tracker_type: mapped.tracker_type,
      unit: mapped.unit,
      description: null,
    });
    setName('');
    setUnit('');
    setUiType('number');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${isOpen ? 'open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New column</h3>

        <div className="form-row">
          <label className="form-label">Name</label>
          <input
            ref={nameRef}
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="sleep, water, weight…"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
        </div>

        <div className="form-row">
          <label className="form-label">Type</label>
          <div className="type-options">
            {TYPE_OPTIONS.map((opt) => (
              <div
                key={opt.ui}
                className={`type-opt ${uiType === opt.ui ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setUiType(opt.ui)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setUiType(opt.ui);
                  }
                }}
              >
                <span className="icon">{opt.icon}</span>
                <span className="label">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">
            Unit{' '}
            <span style={{ opacity: 0.4, fontSize: '8px', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <input
            className="form-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="kg, hrs, ml…"
            autoComplete="off"
          />
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-add" onClick={handleAdd} disabled={!canSubmit}>Add</button>
        </div>
      </div>
    </div>
  );
};

export default AddTrackerModal;
