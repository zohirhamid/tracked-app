import React, { useEffect, useMemo, useState } from 'react';
import { trackerAPI } from '../services/api';

const TrackerManager = ({ isOpen, onClose, trackers, onUpdate }) => {
  const initial = useMemo(() => {
    const list = Array.isArray(trackers) ? [...trackers] : [];
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }, [trackers]);

  const [localTrackers, setLocalTrackers] = useState(initial);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLocalTrackers(initial);
  }, [isOpen, initial]);

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setLocalTrackers((prev) => {
      const next = [...prev];
      const draggedItem = next[draggedIndex];
      next.splice(draggedIndex, 1);
      next.splice(index, 0, draggedItem);
      return next;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < localTrackers.length; i += 1) {
        const tracker = localTrackers[i];
        const nextOrder = i + 1;
        if (tracker.display_order !== nextOrder) {
          await trackerAPI.updateTracker(tracker.id, { ...tracker, display_order: nextOrder });
        }
      }
      await onUpdate?.();
      onClose?.();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save tracker order:', error);
      alert('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Rearrange columns</h3>

        <div className="tm-subtitle">Drag to reorder. Click save when done.</div>

        <div className="tm-list" role="list" aria-label="Columns">
          {localTrackers.map((tracker, index) => (
            <div
              key={tracker.id}
              className={`tm-item ${draggedIndex === index ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              role="listitem"
              title="Drag to reorder"
            >
              <span className="tm-handle" aria-hidden="true">⋮⋮</span>
              <div className="tm-meta">
                <div className="tm-name">{tracker.name}</div>
                <div className="tm-type">{tracker.tracker_type}{tracker.unit ? ` · ${tracker.unit}` : ''}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" type="button" onClick={() => onClose?.()}>Cancel</button>
          <button className="btn-add" type="button" onClick={saveOrder} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackerManager;

