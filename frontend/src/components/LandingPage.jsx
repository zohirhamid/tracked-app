import React, { useMemo } from 'react';
import { navigate } from '../app/router.jsx';
import { useTheme } from '../theme/ThemeContext';
import '../styles/public.css';

const cssVarsFor = (isDark) => {
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
      '--header-bg': '#141a14',
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
    '--header-bg': '#f2f7f2',
    '--font': "'DM Mono', 'Fira Code', 'Courier New', monospace",
    '--font-ui': "'DM Sans', system-ui, sans-serif",
  };
};

const LandingPage = () => {
  const { isDark } = useTheme();
  const cssVars = useMemo(() => cssVarsFor(isDark), [isDark]);

  return (
    <div className="public-root" style={cssVars}>
      <PublicNav actionLabel="Sign in" onAction={() => navigate('/login')} />

      <main>
        <section className="public-hero">
          <div className="public-hero-copy fade-up fade-up-1">
            <div className="public-kicker">Track. Review. Improve.</div>
            <h1 className="public-title">tracked<span className="tracked-dot">.</span></h1>
            <p className="public-subtitle">
              A quiet daily grid for the habits, rituals, and small signals that make up a life.
            </p>
            <div className="public-actions">
              <button className="public-btn public-btn-primary" type="button" onClick={() => navigate('/login')}>
                Start tracking
              </button>
              <button className="public-btn public-btn-secondary" type="button" onClick={() => navigate('/login')}>
                Sign in
              </button>
            </div>
          </div>

          <TrackerPreview />
        </section>

        <section className="public-band" aria-label="How tracked works">
          <div className="public-section-head">
            <span>Workflow</span>
            <p>Fast enough for daily use, structured enough to notice patterns.</p>
          </div>
          <div className="public-feature-grid">
            <FeatureCard number="01" title="Log the day" detail="Add columns for sleep, mood, training, prayer, reading, or anything else you want to keep visible." />
            <FeatureCard number="02" title="Scan the month" detail="The spreadsheet layout keeps time in view so streaks, gaps, and changes are easy to catch." />
            <FeatureCard number="03" title="Adjust gently" detail="Use the record to make one useful change at a time instead of turning self-improvement into noise." />
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <span>Built by Zohir Hamid</span>
        <a href="https://github.com/zohirhamid" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
};

const PublicNav = ({ actionLabel, onAction }) => (
  <nav className="public-nav">
    <button className="public-brand" type="button" onClick={() => navigate('/')}>
      <span className="tracked-wordmark">tracked<span className="tracked-dot">.</span></span>
      <span className="tracked-tagline">a quiet record of a life</span>
    </button>
    <button className="public-btn public-btn-secondary public-nav-action" type="button" onClick={onAction}>
      {actionLabel}
    </button>
  </nav>
);

const TrackerPreview = () => {
  const rows = [
    ['01', 'Mon', '7.5h', '✓', '4', '20m'],
    ['02', 'Tue', '6h', '', '3', '45m'],
    ['03', 'Wed', '8h', '✓', '5', '30m'],
    ['04', 'Thu', '7h', '✓', '4', ''],
    ['05', 'Fri', '', '', '3', '25m'],
    ['06', 'Sat', '8.5h', '✓', '5', '60m'],
  ];

  return (
    <div className="preview-shell fade-up fade-up-2" aria-hidden="true">
      <div className="preview-topbar">
        <div className="preview-month">
          <span>‹</span>
          <strong>May 2026</strong>
          <span>›</span>
        </div>
        <div className="preview-actions">
          <span>+ column</span>
          <span>⋯</span>
        </div>
      </div>
      <div className="preview-grid">
        <div className="preview-row preview-head">
          <span>Day</span>
          <span>Sleep</span>
          <span>Run</span>
          <span>Mood</span>
          <span>Read</span>
        </div>
        {rows.map(([day, weekday, sleep, run, mood, read], index) => (
          <div className={`preview-row ${index === 2 ? 'preview-today' : ''}`} key={day}>
            <span className="preview-day"><strong>{day}</strong><small>{weekday}</small></span>
            <span>{sleep}</span>
            <span className={run ? 'preview-check' : 'preview-empty'}>{run || '·'}</span>
            <span><i style={{ '--rating-width': `${Number(mood) * 4}px` }} />{mood}</span>
            <span>{read || '·'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const FeatureCard = ({ number, title, detail }) => (
  <article className="public-feature-card">
    <span>{number}</span>
    <h2>{title}</h2>
    <p>{detail}</p>
  </article>
);

export default LandingPage;
