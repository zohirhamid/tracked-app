import React, { useEffect, useMemo, useState } from 'react';
import { entryAPI, trackerAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import AddTrackerModal from './AddTrackerModal';
import PlaceholderModal from './PlaceholderModal';
import SettingsMenu from './SettingsMenu';
import TrackerManager from './TrackerManager';
import '../styles/tracker.css';

const TextCell = ({ type, value, placeholder, onCommit }) => {
  const [local, setLocal] = useState(value || '');

  useEffect(() => {
    setLocal(value || '');
  }, [value]);

  return (
    <input
      className="cell-input"
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local)}
    />
  );
};

const LifeTrackerDesktop = () => {
  const { logout } = useAuth();
  const { isDark, toggle } = useTheme();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [trackers, setTrackers] = useState([]);
  const [monthData, setMonthData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [placeholderModalTitle, setPlaceholderModalTitle] = useState(null);
  const [showManagerModal, setShowManagerModal] = useState(false);

  const cssVars = useMemo(() => {
    if (isDark) {
      return {
        '--bg': '#111611',
        '--surface': '#181e18',
        '--border': '#232d23',
        '--border-strong': '#354535',
        '--text': '#e8f0e8',
        '--text-muted': '#6a8a6a',
        '--text-faint': '#2a3a2a',
        '--accent': '#4caf4c',
        '--accent-soft': '#1a271a',
        '--row-hover': '#161d16',
        '--today-bg': '#172217',
        '--today-border': '#4caf4c',
        '--cell-focus': '#1e321e',
        '--header-bg': '#141a14',
        '--col-width': '110px',
        '--row-h': '36px',
        '--today-h': '52px',
        '--font': "'DM Mono', 'Fira Code', 'Courier New', monospace",
        '--font-ui': "'DM Sans', system-ui, sans-serif",
      };
    }

    return {
      '--bg': '#f9faf9',
      '--surface': '#ffffff',
      '--border': '#e2e8e2',
      '--border-strong': '#c4d0c4',
      '--text': '#1a1f1a',
      '--text-muted': '#7a8f7a',
      '--text-faint': '#b8c8b8',
      '--accent': '#2d6a2d',
      '--accent-soft': '#eef5ee',
      '--row-hover': '#f4f8f4',
      '--today-bg': '#e6f2e6',
      '--today-border': '#3a8a3a',
      '--cell-focus': '#dff0df',
      '--header-bg': '#f2f7f2',
      '--col-width': '110px',
      '--row-h': '36px',
      '--today-h': '52px',
      '--font': "'DM Mono', 'Fira Code', 'Courier New', monospace",
      '--font-ui': "'DM Sans', system-ui, sans-serif",
    };
  }, [isDark]);

  const loadMonthData = async () => {
    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const data = await trackerAPI.getMonthView(year, month);
      setMonthData(data);
      setTrackers(data.trackers || []);
    } catch (error) {
      console.error('Failed to load month data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const getMonthName = (date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getDayName = (day) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      day === today.getDate()
      && currentDate.getMonth() === today.getMonth()
      && currentDate.getFullYear() === today.getFullYear()
    );
  };

  const getCellValueFromEntry = (tracker, entry) => {
    if (!entry) return '';
    switch (tracker.tracker_type) {
      case 'binary':
        return entry.binary_value !== undefined ? entry.binary_value.toString() : '';
      case 'number':
        return entry.number_value !== null && entry.number_value !== undefined ? entry.number_value.toString() : '';
      case 'rating':
        return entry.rating_value !== null && entry.rating_value !== undefined ? entry.rating_value.toString() : '';
      case 'duration':
        return entry.duration_minutes !== null && entry.duration_minutes !== undefined ? entry.duration_minutes.toString() : '';
      case 'time':
        return entry.time_value || '';
      case 'prayer':
        return entry.prayer_values || '';
      case 'text':
        return entry.text_value || '';
      default:
        return '';
    }
  };

  const handleAddTracker = async (data) => {
    try {
      await trackerAPI.createTracker(data);
      await loadMonthData();
    } catch (error) {
      console.error('Failed to add tracker:', error);
      alert('Failed to add tracker: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteTracker = async (trackerId) => {
    if (!confirm('Are you sure you want to delete this tracker?')) return;
    try {
      await trackerAPI.deleteTracker(trackerId);
      await loadMonthData();
    } catch (error) {
      console.error('Failed to delete tracker:', error);
    }
  };

  const updateCellValue = async (trackerId, day, value) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    try {
      const tracker = trackers.find((t) => t.id === trackerId);
      if (!tracker) return;

      const entryData = { tracker_id: trackerId, date: dateStr };
      if (!value || value === '') {
        entryData.delete_entry = true;
      } else {
        switch (tracker.tracker_type) {
          case 'binary':
            entryData.binary_value = String(value).toLowerCase() === 'true' || value === '1' || String(value).toLowerCase() === 'yes';
            break;
          case 'number':
            entryData.number_value = parseFloat(value);
            break;
          case 'rating':
            entryData.rating_value = parseInt(value, 10);
            break;
          case 'duration':
            entryData.duration_minutes = parseInt(value, 10);
            break;
          case 'time':
            entryData.time_value = value;
            break;
          case 'prayer':
            entryData.prayer_values = value;
            break;
          case 'text':
            entryData.text_value = value;
            break;
        }
      }

      await entryAPI.saveEntry(entryData);
      await loadMonthData();
    } catch (error) {
      console.error('Failed to update entry:', error);
    }
  };

  const renderCell = (tracker, dayData, day) => {
    const entry = dayData?.entries?.[tracker.id];
    const value = getCellValueFromEntry(tracker, entry);

    if (tracker.tracker_type === 'binary') {
      const checked = value === 'true' || value === true;
      return (
        <div className="cell-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => updateCellValue(tracker.id, day, e.target.checked ? 'true' : '')}
          />
        </div>
      );
    }

    if (tracker.tracker_type === 'rating') {
      const current = value ? parseInt(value, 10) : 0;
      return (
        <div className="cell-mood">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`mood-dot ${current >= n ? 'on' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => updateCellValue(tracker.id, day, String(n))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  updateCellValue(tracker.id, day, String(n));
                }
              }}
            />
          ))}
        </div>
      );
    }

    if (tracker.tracker_type === 'prayer') {
      const prayerOptions = [
        { key: 'fajr', short: 'F', label: 'Fajr' },
        { key: 'dhuhr', short: 'D', label: 'Dhuhr' },
        { key: 'asr', short: 'A', label: 'Asr' },
        { key: 'maghrib', short: 'M', label: 'Maghrib' },
        { key: 'isha', short: 'I', label: 'Isha' },
      ];

      const normalize = (val) => {
        if (!val) return {};
        if (typeof val === 'object') return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return parsed && typeof parsed === 'object' ? parsed : {};
          } catch {
            return {};
          }
        }
        return {};
      };

      const prayerValues = normalize(value);

      const togglePrayer = (key) => {
        const current = prayerValues[key];
        let next;
        if (current === true) next = false;
        else if (current === false) next = null;
        else next = true;

        const updated = { ...prayerValues, [key]: next };
        const allEmpty = prayerOptions.every((opt) => updated[opt.key] === null || updated[opt.key] === undefined);
        updateCellValue(tracker.id, day, allEmpty ? '' : updated);
      };

      const renderState = (state) => {
        if (state === true) return <span className="prayer-state on">✓</span>;
        if (state === false) return <span className="prayer-state off">×</span>;
        return <span className="prayer-state empty">·</span>;
      };

      return (
        <div className="cell-prayer" role="group" aria-label={`${tracker.name} prayers`}>
          {prayerOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className="prayer-btn"
              title={opt.label}
              onClick={() => togglePrayer(opt.key)}
            >
              <span className="prayer-short">{opt.short}</span>
              {renderState(prayerValues[opt.key])}
            </button>
          ))}
        </div>
      );
    }

    const isNumber = tracker.tracker_type === 'number' || tracker.tracker_type === 'duration';
    const inputType = tracker.tracker_type === 'time' ? 'time' : (isNumber ? 'number' : 'text');
    const placeholder = tracker.tracker_type === 'time' ? 'hh:mm' : '';

    return (
      <TextCell
        type={inputType}
        value={value}
        placeholder={placeholder}
        onCommit={(next) => updateCellValue(tracker.id, day, next)}
      />
    );
  };

  if (isLoading && !monthData) {
    return (
      <div className="tracker-root" style={cssVars}>
        <div style={{ padding: 20, fontFamily: 'var(--font)' }}>Loading…</div>
      </div>
    );
  }

  const days = (monthData?.weeks || []).flat().filter(Boolean);

  return (
    <div className="tracker-root" style={cssVars}>
      <PlaceholderModal
        isOpen={Boolean(placeholderModalTitle)}
        onClose={() => setPlaceholderModalTitle(null)}
        title={placeholderModalTitle || ''}
        description="working on it 🛠️"
      />
      <AddTrackerModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAddTracker} />
      <TrackerManager
        isOpen={showManagerModal}
        onClose={() => setShowManagerModal(false)}
        trackers={trackers}
        onUpdate={loadMonthData}
      />

      <div className="topbar">
        <div className="tracked-brand">
          <h1 className="tracked-wordmark">
            tracked<span className="tracked-dot">.</span>
          </h1>
          <span className="tracked-tagline">
            a quiet record of a life
          </span>
        </div>
        <div className="month-nav">
          <button className="nav-btn" onClick={() => navigateMonth(-1)} aria-label="Previous month">‹</button>
          <div className="month-label">{getMonthName(currentDate)}</div>
          <button className="nav-btn" onClick={() => navigateMonth(1)} aria-label="Next month">›</button>
        </div>
        <div className="topbar-actions">
          <button className="add-col-btn" onClick={() => setShowAddModal(true)}>+ column</button>
          <SettingsMenu
            onToggleTheme={toggle}
            onLogout={logout}
            onOpenPlaceholder={(t) => setPlaceholderModalTitle(t)}
            onRearrangeColumns={() => setShowManagerModal(true)}
          />
        </div>
      </div>

      <div className="grid-wrapper">
        <div className={`empty-hint ${trackers.length === 0 ? 'show' : ''}`}>+ add your first column to start tracking</div>
        <table>
          <thead>
            <tr>
              <th>
                <div className="th-inner"><span className="th-name">Day</span></div>
              </th>
              {trackers.map((tracker) => {
                const unitEl = tracker.unit ? (
                  <span style={{ opacity: 0.35, fontSize: '8px', marginLeft: '2px' }}>{tracker.unit}</span>
                ) : null;
                return (
                  <th key={tracker.id}>
                    <div className="th-inner">
                      <span className="th-name">{tracker.name}{unitEl}</span>
                      <button className="col-delete" onClick={() => handleDeleteTracker(tracker.id)} aria-label={`Delete ${tracker.name}`}>×</button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {days.map((dayData) => {
              const day = dayData.day;
              const today = isToday(day);
              return (
                <tr key={`day-${dayData.date}`} className={today ? 'today-row' : undefined}>
                  <td className="day-cell">
                    <div className="day-num">{String(day).padStart(2, '0')}</div>
                    <div className="day-name">{getDayName(day)}</div>
                  </td>
                  {trackers.map((tracker) => (
                    <td key={tracker.id}>{renderCell(tracker, dayData, day)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LifeTrackerDesktop;

