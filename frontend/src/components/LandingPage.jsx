import React from 'react';
import { navigate } from '../app/router.jsx';
import { useTheme } from '../theme/ThemeContext';

const LandingPage = () => {
  const { theme } = useTheme();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.text,
      fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
    }}>
      {/* ── Navigation ── */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 48px',
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{
          fontSize: '10px',
          letterSpacing: '3px',
          color: theme.textMuted,
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          Life Tracker
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/login')}
            className="cta-btn"
            style={{
              background: 'transparent',
              border: `1px solid ${theme.border}`,
              color: theme.textMuted,
              padding: '8px 16px',
              fontSize: '9px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
	          >
	            Login
	          </button>
	        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section style={{
        padding: '120px 48px 80px',
        maxWidth: '800px',
        margin: '0 auto',
        textAlign: 'center',
      }}>
        <div className="fade-up fade-up-1" style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '12px',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            border: `1px solid ${theme.border}`,
            background: theme.bgCard,
            fontSize: '10px',
            letterSpacing: '1px',
            color: theme.textMuted,
            textTransform: 'uppercase',
            borderRadius: '2px',
            minWidth: '140px',
            justifyContent: 'center',
          }}>
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              background: '#22c55e',
            }} />
            Create your account
          </div>
        </div>

        <div className="fade-up fade-up-1" style={{
          fontSize: '9px',
          letterSpacing: '3px',
          color: theme.accent,
          textTransform: 'uppercase',
          marginBottom: '24px',
        }}>
          Track · Review · Improve
        </div>

        <h1 className="fade-up fade-up-2" style={{
          fontSize: '42px',
          fontWeight: '300',
          lineHeight: '1.3',
          margin: '0 0 24px',
          letterSpacing: '-1px',
        }}>
          Your habits,<br />
          <span style={{ color: theme.accent }}>made easy to see</span>
        </h1>

        <p className="fade-up fade-up-3" style={{
          fontSize: '14px',
          color: theme.textMuted,
          lineHeight: '1.8',
          maxWidth: '500px',
          margin: '0 auto 48px',
          fontWeight: '300',
        }}>
          Log your daily habits in a minimal spreadsheet-like interface.
          Spot trends across days and weeks, and build consistency with a simple workflow.
        </p>

        <div className="fade-up fade-up-4" style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => navigate('/login')}
            className="cta-btn"
            style={{
              background: theme.accent,
              border: 'none',
              color: theme.accentText,
              padding: '14px 32px',
              fontSize: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: '500',
            }}
          >
            Get Started
          </button>
        </div>

      </section>

      {/* ── How It Works ── */}
      <section style={{
        padding: '80px 48px',
        borderTop: `1px solid ${theme.border}`,
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            fontSize: '9px',
            letterSpacing: '2px',
            color: theme.textDim,
            textTransform: 'uppercase',
            marginBottom: '40px',
            textAlign: 'center',
          }}>
            How it works
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
          }}>
            <StepCard
              number="01"
              title="Track"
              description="Log sleep, exercise, mood, productivity — anything you want. The grid makes daily logging fast and frictionless."
              theme={theme}
            />
            <StepCard
              number="02"
              title="Review"
              description="See your month at a glance. Weekly and monthly summary rows help you notice what’s working."
              theme={theme}
            />
            <StepCard
              number="03"
              title="Improve"
              description="Adjust one habit at a time. Use the grid to stay honest and keep momentum."
              theme={theme}
            />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{
        padding: '80px 48px',
        borderTop: `1px solid ${theme.border}`,
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            fontSize: '9px',
            letterSpacing: '2px',
            color: theme.textDim,
            textTransform: 'uppercase',
            marginBottom: '40px',
            textAlign: 'center',
          }}>
            Features
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
          }}>
            <FeatureCard
              label="Multiple Tracker Types"
              detail="Binary, number, time, duration, rating, text — track anything your way"
              theme={theme}
            />
            <FeatureCard
              label="Summary Rows"
              detail="Weekly and monthly stats per tracker for quick progress checks"
              theme={theme}
            />
            <FeatureCard
              label="Spreadsheet Interface"
              detail="Minimal, fast, keyboard-friendly — like Excel but purpose-built"
              theme={theme}
            />
            <FeatureCard
              label="Trend Detection"
              detail="See what's improving, declining, or staying stable across weeks"
              theme={theme}
            />
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section style={{
        padding: '60px 48px',
        borderTop: `1px solid ${theme.border}`,
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'center',
          gap: '48px',
          flexWrap: 'wrap',
        }}>
          {['Django', 'React', 'PostgreSQL'].map(tech => (
            <span key={tech} style={{
              fontSize: '10px',
              letterSpacing: '2px',
              color: theme.textDim,
              textTransform: 'uppercase',
            }}>
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        padding: '32px 48px',
        borderTop: `1px solid ${theme.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: '9px',
          color: theme.textDim,
          letterSpacing: '1px',
        }}>
          Built by Zohir Hamid
        </span>
        <a
          href="https://github.com/zohirhamid"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '9px',
            color: theme.textDim,
            letterSpacing: '1px',
            textDecoration: 'none',
          }}
        >
          GITHUB ↗
        </a>
      </footer>
    </div>
  );
};


/* ── Sub-components ── */

const StepCard = ({ number, title, description, theme }) => (
  <div style={{
    padding: '32px 24px',
    border: `1px solid ${theme.border}`,
    background: theme.bgCard,
  }}>
    <div style={{
      fontSize: '32px',
      fontWeight: '300',
      color: theme.accent,
      marginBottom: '16px',
      letterSpacing: '-1px',
    }}>
      {number}
    </div>
    <div style={{
      fontSize: '13px',
      fontWeight: '500',
      color: theme.text,
      marginBottom: '8px',
      letterSpacing: '0.5px',
    }}>
      {title}
    </div>
    <div style={{
      fontSize: '11px',
      color: theme.textMuted,
      lineHeight: '1.7',
    }}>
      {description}
    </div>
  </div>
);

const FeatureCard = ({ label, detail, theme }) => (
  <div
    className="feature-card"
    style={{
      padding: '24px',
      border: `1px solid ${theme.border}`,
      background: theme.bgCard,
    }}
  >
    <div style={{
      fontSize: '11px',
      fontWeight: '500',
      color: theme.text,
      marginBottom: '6px',
    }}>
      {label}
    </div>
    <div style={{
      fontSize: '10px',
      color: theme.textMuted,
      lineHeight: '1.6',
    }}>
      {detail}
    </div>
  </div>
);

export default LandingPage;
