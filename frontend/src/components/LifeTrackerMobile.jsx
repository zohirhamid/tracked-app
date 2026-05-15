import React, { useEffect, useMemo, useRef, useState } from 'react';
import { entryAPI, trackerAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import PlaceholderModal from './PlaceholderModal';
import SettingsMenu from './SettingsMenu';
import '../styles/tracker.css';
import '../styles/lifeTrackerMobile.css';

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

const getDayName = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
};

const formatDuration = (minutesStr) => {
  const totalMinutes = parseInt(minutesStr, 10);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
};

const getEntryValue = (tracker, entry) => {
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
      return entry.prayer_values || null;
    case 'text':
      return entry.text_value || '';
    default:
      return '';
  }
};

const LifeTrackerMobile = () => {
  const { logout } = useAuth();
  const { isDark, toggle, theme } = useTheme();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [trackers, setTrackers] = useState([]);
  const [monthData, setMonthData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [openDayKey, setOpenDayKey] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [placeholderModalTitle, setPlaceholderModalTitle] = useState(null);

  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newType, setNewType] = useState('number');
  const nameInputRef = useRef(null);

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

  const loadMonth = async () => {
    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const data = await trackerAPI.getMonthView(year, month);
      setMonthData(data);
      setTrackers(data.trackers || []);

      const today = new Date();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
      if (isCurrentMonth) setOpenDayKey(`${year}-${month}-${today.getDate()}`);
      else setOpenDayKey(null);
    } catch (error) {
      console.error('Failed to load month data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  useEffect(() => {
    if (!openDayKey) return;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    if (openDayKey !== todayKey) return;
    // If we auto-opened today, scroll it into view (best-effort).
    const el = document.querySelector(`[data-ltm-openkey="${openDayKey}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      setTimeout(() => {
        try {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {
          el.scrollIntoView();
        }
      }, 80);
    }
  }, [openDayKey]);

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const getMonthName = (date) => date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  const isToday = (dateStr) => {
    const today = new Date();
    const d = new Date(`${dateStr}T00:00:00`);
    return d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate();
  };

  const days = useMemo(() => (monthData?.weeks || []).flat().filter(Boolean), [monthData]);

  const saveEntry = async (tracker, dateStr, value) => {
    try {
      const entryData = { tracker_id: tracker.id, date: dateStr };

      const isEmptyPrayerValues = tracker.tracker_type === 'prayer'
        && value
        && typeof value === 'object'
        && !Array.isArray(value)
        && Object.values(value).every((v) => v === null || v === undefined);

      if (!value || value === '' || isEmptyPrayerValues) {
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
          case 'text':
            entryData.text_value = value;
            break;
          case 'prayer':
            entryData.prayer_values = value;
            break;
        }
      }

      await entryAPI.saveEntry(entryData);
      await loadMonth();
    } catch (error) {
      console.error('Failed to update entry:', error);
    }
  };

  const openSheet = () => {
    setSheetOpen(true);
    setShowAddForm(false);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setShowAddForm(false);
  };

  const startAdd = () => {
    setShowAddForm(true);
    setNewName('');
    setNewUnit('');
    setNewType('number');
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const createTracker = async () => {
    const name = newName.trim();
    if (!name) {
      nameInputRef.current?.focus();
      return;
    }
    try {
      const mapped = mapUiTypeToTracker(newType, newUnit.trim());
      await trackerAPI.createTracker({
        name,
        tracker_type: mapped.tracker_type,
        unit: mapped.unit,
        description: null,
      });
      await loadMonth();
      closeSheet();
    } catch (error) {
      console.error('Failed to add tracker:', error);
      alert('Failed to add tracker: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteTracker = async (trackerId) => {
    if (!confirm('Delete this column?')) return;
    try {
      await trackerAPI.deleteTracker(trackerId);
      await loadMonth();
    } catch (error) {
      console.error('Failed to delete tracker:', error);
    }
  };

  const renderChip = (tracker, entry) => {
    const rawValue = getEntryValue(tracker, entry);
    if (!rawValue || rawValue === 'false') return null;

    let label = '';
    switch (tracker.tracker_type) {
      case 'binary':
        if (rawValue !== 'true' && rawValue !== true) return null;
        label = '✓';
        break;
      case 'rating':
        label = '●'.repeat(Math.max(0, Math.min(5, parseInt(rawValue, 10) || 0)));
        break;
      case 'duration':
        label = formatDuration(rawValue);
        break;
      case 'time':
        label = formatTime(rawValue);
        break;
      case 'prayer':
        {
          const vals = rawValue && typeof rawValue === 'object' ? rawValue : null;
          if (!vals) return null;
          const keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
          const done = keys.filter((k) => vals[k] === true).length;
          const any = keys.some((k) => vals[k] === true || vals[k] === false);
          if (!any) return null;
          label = `P ${done}/5`;
        }
        break;
      default:
        label = String(rawValue);
    }

    if (!label) return null;
    const unit = tracker.unit ? ` ${tracker.unit}` : '';
    return (
      <span key={tracker.id} className="ltm-chip" title={tracker.name}>
        {tracker.name.slice(0, 6)} {label}{unit}
      </span>
    );
  };

  const renderFieldControl = (tracker, dayData, value) => {
    const dateStr = dayData.date;

    if (tracker.tracker_type === 'binary') {
      return (
        <div className="cell-check">
          <input
            type="checkbox"
            checked={value === 'true' || value === true}
            onChange={(e) => saveEntry(tracker, dateStr, e.target.checked ? 'true' : '')}
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
              onClick={() => saveEntry(tracker, dateStr, String(n))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  saveEntry(tracker, dateStr, String(n));
                }
              }}
            />
          ))}
        </div>
      );
    }

    if (tracker.tracker_type === 'prayer') {
      return <PrayerControl value={value} onChange={(next) => saveEntry(tracker, dateStr, next)} />;
    }

    return (
      <MobileFieldInput
        tracker={tracker}
        value={value}
        onCommit={(next) => saveEntry(tracker, dateStr, next)}
      />
    );
  };

  if (isLoading && !monthData) {
    return (
      <div className="ltm-root" style={cssVars}>
        <div style={{ padding: 20, fontFamily: 'var(--font)' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="ltm-root" style={cssVars}>
      <PlaceholderModal
        isOpen={Boolean(placeholderModalTitle)}
        onClose={() => setPlaceholderModalTitle(null)}
        title={placeholderModalTitle || ''}
        description="working on it 🛠️"
        theme={theme}
      />

      <div className="ltm-topbar">
        <div className="ltm-logo">tracked</div>
        <div className="ltm-monthNav">
          <button className="ltm-navBtn" onClick={() => navigateMonth(-1)} aria-label="Previous month">‹</button>
          <div className="ltm-monthLabel">{getMonthName(currentDate)}</div>
          <button className="ltm-navBtn" onClick={() => navigateMonth(1)} aria-label="Next month">›</button>
        </div>
        <button className="ltm-manageBtn" onClick={openSheet} aria-label="Manage columns">⋮</button>
      </div>

      <div className="ltm-scrollArea">
        {trackers.length === 0 ? (
          <div className="ltm-empty">tap + to add your first column<br />then start tracking</div>
        ) : null}

        {days.map((dayData) => {
          const openKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${dayData.day}`;
          const open = openDayKey === openKey;
          const today = isToday(dayData.date);

          const chips = trackers
            .map((t) => renderChip(t, dayData?.entries?.[t.id]))
            .filter(Boolean);

          return (
            <div
              key={dayData.date}
              data-ltm-openkey={openKey}
              className={[
                'ltm-dayCard',
                open ? 'ltm-dayCardOpen' : '',
                today ? 'ltm-dayCardToday' : '',
              ].filter(Boolean).join(' ')}
            >
              <div
                className={[
                  'ltm-dayHeader',
                  today ? 'ltm-dayHeaderToday' : '',
                ].filter(Boolean).join(' ')}
                role="button"
                tabIndex={0}
                onClick={() => setOpenDayKey(open ? null : openKey)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpenDayKey(open ? null : openKey);
                  }
                }}
              >
                <div className="ltm-dayDate">
                  <div className={['ltm-dayNum', today ? 'ltm-dayNumToday' : ''].filter(Boolean).join(' ')}>
                    {String(dayData.day).padStart(2, '0')}
                  </div>
                  <div className={['ltm-dayName', today ? 'ltm-dayNameToday' : ''].filter(Boolean).join(' ')}>
                    {getDayName(dayData.date)}
                  </div>
                </div>
                <div className="ltm-preview">
                  {chips.length ? (
                    <>
                      {chips.slice(0, 3)}
                      {chips.length > 3 ? (
                        <span className="ltm-chip ltm-chipEmpty">+{chips.length - 3}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="ltm-chip ltm-chipEmpty">tap to fill</span>
                  )}
                </div>
                <div className="ltm-chevron">›</div>
              </div>

              {open ? (
                <div className={['ltm-fields', today ? 'ltm-fieldsToday' : ''].filter(Boolean).join(' ')}>
                  {trackers.map((tracker) => {
                    const entry = dayData?.entries?.[tracker.id];
                    const value = getEntryValue(tracker, entry);
                    return (
                      <div key={tracker.id} className="ltm-fieldRow">
                        <div className="ltm-fieldLabel" title={tracker.name}>
                          {tracker.name}
                          {tracker.unit ? <span className="ltm-fieldUnit">{tracker.unit}</span> : null}
                        </div>
                        <div className="ltm-fieldControl">
                          {renderFieldControl(tracker, dayData, value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button className="ltm-fab" onClick={() => { openSheet(); setShowAddForm(true); setTimeout(() => nameInputRef.current?.focus(), 50); }} aria-label="Add column">+</button>

      <div
        className={[
          'ltm-sheetOverlay',
          sheetOpen ? 'ltm-sheetOverlayOpen' : '',
        ].join(' ')}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSheet();
        }}
      >
        <div className="ltm-sheet" role="dialog" aria-modal="true" aria-label="Manage columns">
          <div className="ltm-handle" />
          <div className="ltm-sheetHeader">
            <div className="ltm-sheetTitle">Columns</div>
            <button className="ltm-sheetClose" onClick={closeSheet} aria-label="Close">×</button>
          </div>

          <div className="ltm-sheetScroll">
            {trackers.length === 0 ? (
              <div style={{ padding: '16px 0', fontFamily: 'var(--font)', fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
                no columns yet
              </div>
            ) : (
              trackers.map((t) => (
                <div key={t.id} className="ltm-colItem">
                  <div className="ltm-colInfo">
                    <div className="ltm-colName">{t.name}{t.unit ? ` (${t.unit})` : ''}</div>
                    <div className="ltm-colMeta">{t.tracker_type}</div>
                  </div>
                  <button className="ltm-colDel" onClick={() => deleteTracker(t.id)} aria-label={`Delete ${t.name}`}>×</button>
                </div>
              ))
            )}
          </div>

          {!showAddForm ? (
            <div className="ltm-addRow">
              <button className="ltm-showAdd" onClick={startAdd}>+ new column</button>
              <div style={{ marginLeft: 'auto' }}>
                <SettingsMenu
                  onToggleTheme={toggle}
                  onLogout={logout}
                  onOpenPlaceholder={(t) => setPlaceholderModalTitle(t)}
                  onRearrangeColumns={() => {}}
                />
              </div>
            </div>
          ) : (
            <div className="ltm-addForm">
              <div>
                <label className="ltm-formLabel">Name</label>
                <input
                  ref={nameInputRef}
                  className="ltm-formInput"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="sleep, water, weight…"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createTracker();
                  }}
                />
              </div>
              <div>
                <label className="ltm-formLabel">Type</label>
                <div className="ltm-typeGrid">
                  {TYPE_OPTIONS.map((opt) => (
                    <div
                      key={opt.ui}
                      className={['ltm-typeChip', opt.ui === newType ? 'ltm-typeChipSel' : ''].filter(Boolean).join(' ')}
                      role="button"
                      tabIndex={0}
                      onClick={() => setNewType(opt.ui)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setNewType(opt.ui);
                        }
                      }}
                    >
                      <span className="ltm-ti">{opt.icon}</span>
                      <span className="ltm-tl">{opt.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="ltm-formLabel">
                  Unit <span style={{ opacity: 0.4, fontSize: '8px', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <input
                  className="ltm-formInput"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="kg, hrs, ml…"
                  autoComplete="off"
                />
              </div>
              <div className="ltm-formActions">
                <button className="ltm-btnCancel" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button className="ltm-btnSave" onClick={createTracker}>Add column</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MobileFieldInput = ({ tracker, value, onCommit }) => {
  const [local, setLocal] = useState(() => {
    if (tracker.tracker_type === 'time') return formatTime(value);
    return value || '';
  });

  useEffect(() => {
    if (tracker.tracker_type === 'time') setLocal(formatTime(value));
    else setLocal(value || '');
  }, [tracker.tracker_type, value]);

  const type = tracker.tracker_type === 'time'
    ? 'time'
    : (tracker.tracker_type === 'duration' || tracker.tracker_type === 'number' ? 'number' : 'text');

  return (
    <input
      className="cell-input"
      type={type}
      value={local}
      placeholder={tracker.tracker_type === 'time' ? 'hh:mm' : ''}
      onChange={(e) => {
        const next = tracker.tracker_type === 'time' ? formatTime(e.target.value) : e.target.value;
        setLocal(next);
      }}
      onBlur={() => onCommit(local)}
    />
  );
};

const PrayerControl = ({ value, onChange }) => {
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

  const toggle = (key) => {
    const current = prayerValues[key];
    let next;
    if (current === true) next = false;
    else if (current === false) next = null;
    else next = true;

    const updated = { ...prayerValues, [key]: next };
    const allEmpty = prayerOptions.every((opt) => updated[opt.key] === null || updated[opt.key] === undefined);
    onChange(allEmpty ? '' : updated);
  };

  const renderState = (state) => {
    if (state === true) return <span className="prayer-state on">✓</span>;
    if (state === false) return <span className="prayer-state off">×</span>;
    return <span className="prayer-state empty">·</span>;
  };

  return (
    <div className="cell-prayer" role="group" aria-label="Prayers">
      {prayerOptions.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className="prayer-btn"
          title={opt.label}
          onClick={() => toggle(opt.key)}
        >
          <span className="prayer-short">{opt.short}</span>
          {renderState(prayerValues[opt.key])}
        </button>
      ))}
    </div>
  );
};

export default LifeTrackerMobile;
