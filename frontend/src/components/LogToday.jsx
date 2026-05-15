import React, { useEffect, useMemo, useState } from 'react';
import { entryAPI, trackerAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { Link, navigate } from '../app/router.jsx';
import PlaceholderModal from './PlaceholderModal';
import TrackerCell from './TrackerCell';
import UserMenu from './UserMenu';
import './LogToday.css';

const LogToday = () => {
  const { logout } = useAuth();
  const { isDark, theme, toggle } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [trackers, setTrackers] = useState([]);
  const [dayData, setDayData] = useState(null);
  const [selectedTrackerId, setSelectedTrackerId] = useState(null);
  const [placeholderModalTitle, setPlaceholderModalTitle] = useState(null);

  const loadToday = async () => {
    setIsLoading(true);
    try {
      const data = await trackerAPI.getTodayView();
      setTrackers(data.trackers || []);
      setDayData(data.day || null);
    } catch (error) {
      console.error('Failed to load today view:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadToday();
  }, []);

  const dateLabel = useMemo(() => {
    if (!dayData?.date) return '';
    const d = new Date(`${dayData.date}T00:00:00`);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [dayData?.date]);

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
      case 'text':
        return entry.text_value || '';
      case 'prayer':
        return entry.prayer_values || null;
      default:
        return '';
    }
  };

  const updateValue = async (trackerId, value) => {
    if (!dayData?.date) return;
    try {
      const tracker = trackers.find(t => t.id === trackerId);
      if (!tracker) return;

      const entryData = {
        tracker_id: trackerId,
        date: dayData.date,
      };

      const isEmptyPrayerValues = tracker.tracker_type === 'prayer'
        && value
        && typeof value === 'object'
        && !Array.isArray(value)
        && Object.values(value).every(v => v === null || v === undefined);

      if (!value || value === '' || isEmptyPrayerValues) {
        entryData.delete_entry = true;
      } else {
        switch (tracker.tracker_type) {
          case 'binary':
            {
              const normalized = String(value).toLowerCase();
              entryData.binary_value = normalized === 'true' || normalized === '1' || normalized === 'yes';
            }
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
      await loadToday();
    } catch (error) {
      console.error('Failed to update entry:', error);
    }
  };

  if (isLoading && !dayData) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: '14px', color: theme.textMuted }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="logTodayContainer"
      style={{
        minHeight: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
        boxSizing: 'border-box',
        transition: 'background-color 0.2s ease, color 0.2s ease',
        '--lt-border': theme.border,
        '--lt-border-light': theme.borderLight,
      }}
    >
      <PlaceholderModal
        isOpen={Boolean(placeholderModalTitle)}
        onClose={() => setPlaceholderModalTitle(null)}
        title={placeholderModalTitle || ''}
        description="working on it 🛠️"
        theme={theme}
      />

      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: theme.bg,
        paddingTop: '8px',
        paddingBottom: '16px',
      }} className="logTodayHeader">
        <div>
          <div style={{
            fontSize: '10px',
            letterSpacing: '3px',
            color: theme.textDim,
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}>
            Log Today
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '300',
            margin: 0,
            letterSpacing: '-0.5px',
            color: isDark ? '#fff' : '#000',
          }}>
            {dateLabel || 'Today'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }} className="logTodayHeaderActions">
          <button
            onClick={() => toggle()}
            style={{
              background: 'transparent',
              border: `1px solid ${theme.borderLight}`,
              color: theme.textDim,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '10px',
              letterSpacing: '1px',
              fontFamily: 'inherit',
              borderRadius: '10px',
              transition: 'all 0.15s ease',
            }}
            title="Toggle theme"
          >
            THEME
          </button>
          <Link
            to="/app"
            style={{
              border: `1px solid ${theme.borderLight}`,
              color: theme.textDim,
              padding: '8px 12px',
              fontSize: '10px',
              letterSpacing: '1px',
              borderRadius: '10px',
              textDecoration: 'none',
            }}
            title="Back to month view"
          >
            MONTH
          </Link>
          <button
            onClick={() => loadToday()}
            style={{
              background: 'transparent',
              border: `1px solid ${theme.borderLight}`,
              color: theme.textDim,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '10px',
              letterSpacing: '1px',
              fontFamily: 'inherit',
              borderRadius: '10px',
              transition: 'all 0.15s ease',
            }}
            title="Refresh"
          >
            REFRESH
          </button>
          <UserMenu
            theme={theme}
            onLogout={() => logout()}
            onOpenPlaceholder={(title) => setPlaceholderModalTitle(title)}
          />
        </div>
      </header>

      <div style={{
        maxWidth: '860px',
        border: `1px solid ${theme.border}`,
        background: theme.bgAlt,
        borderRadius: '14px',
        overflow: 'hidden',
      }} className="logTodayPanel">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 180px',
          padding: '10px 14px',
          background: theme.bg,
          borderBottom: `1px solid ${theme.border}`,
        }} className="logTodayPanelHeader">
          <div style={{ fontSize: '10px', color: theme.textDim, letterSpacing: '2px', textTransform: 'uppercase' }}>
            Tracker
          </div>
          <div style={{ fontSize: '10px', color: theme.textDim, letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center' }}>
            Value
          </div>
        </div>

        {trackers.length === 0 ? (
          <div style={{ padding: '18px 14px', color: theme.textMuted, fontSize: '12px' }}>
            No trackers yet. Go to <button
              type="button"
              onClick={() => navigate('/app')}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.accent,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >month view</button> to add some.
          </div>
        ) : trackers.map((tracker) => {
          const entry = dayData?.entries?.[tracker.id];
          const value = getCellValueFromEntry(tracker, entry);
          const isSelected = selectedTrackerId === tracker.id;

          return (
            <div
              key={tracker.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 180px',
                alignItems: 'center',
                borderBottom: `1px solid ${theme.borderLight}`,
                background: isSelected ? theme.accentBgStrong : 'transparent',
              }}
              className="logTodayRow"
            >
              <div style={{ padding: '10px 14px' }} className="logTodayRowMeta">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: theme.text }}>
                    {tracker.name}
                  </div>
                  <div style={{ fontSize: '9px', color: theme.textDimmer, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {tracker.tracker_type}
                  </div>
                </div>
              </div>

              <div style={{ padding: '0', borderLeft: `1px solid ${theme.borderLight}` }} className="logTodayRowValue">
                <TrackerCell
                  tracker={tracker}
                  day={dayData?.day}
                  value={value}
                  isSelected={isSelected}
                  onValueChange={(newValue) => updateValue(tracker.id, newValue)}
                  onFocus={() => setSelectedTrackerId(tracker.id)}
                  onBlur={() => setSelectedTrackerId(null)}
                  theme={theme}
                  isDark={isDark}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LogToday;
