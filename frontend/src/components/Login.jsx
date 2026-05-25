import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../app/router.jsx';
import { useTheme } from '../theme/ThemeContext';
import { configAPI } from '../services/api';
import '../styles/public.css';

const BUILD_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

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

const Login = () => {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(BUILD_GOOGLE_CLIENT_ID || '');
  const { login, signup, loginWithGoogle } = useAuth();
  const { isDark } = useTheme();
  const cssVars = useMemo(() => cssVarsFor(isDark), [isDark]);

  const googleButtonRef = useRef(null);
  const googleInitializedRef = useRef(false);
  const lastGoogleCredentialRef = useRef(null);

  useEffect(() => {
    if (googleClientId) return;

    let cancelled = false;
    configAPI.getPublicConfig()
      .then((config) => {
        if (cancelled) return;
        const id = config?.google_client_id || '';
        if (id) setGoogleClientId(id);
      })
      .catch(() => {
        // Non-blocking: fall back to email/password login.
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = isSignUp
      ? await signup(email, password)
      : await login(email, password);

    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;

  useEffect(() => {
    if (!googleClientId) return;
    if (!googleButtonRef.current) return;
    if (googleInitializedRef.current) return;

    const origin = window.location.origin;
    if (origin.includes('127.0.0.1')) {
      setError('Google Sign-In requires an authorized origin. Use http://localhost:5173 (not 127.0.0.1) for local dev.');
      return;
    }

    const ensureScript = () => {
      const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
      if (existing) return existing;

      const script = document.createElement('script');
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      return script;
    };

    const script = ensureScript();

    const init = () => {
      if (googleInitializedRef.current) return;
      if (!window.google?.accounts?.id) return;

      googleInitializedRef.current = true;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          const credential = response?.credential;
          if (!credential) return;
          if (lastGoogleCredentialRef.current === credential) return;
          lastGoogleCredentialRef.current = credential;

          setError('');
          setIsGoogleLoading(true);
          const result = await loginWithGoogle(credential, googleClientId);
          if (!result.success) {
            setError(result.error);
            setIsGoogleLoading(false);
          }
        },
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: isDark ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 336,
      });
    };

    if (window.google?.accounts?.id) {
      init();
      return;
    }

    const onLoad = () => init();
    script.addEventListener('load', onLoad);
    return () => script.removeEventListener('load', onLoad);
  }, [loginWithGoogle, googleClientId, isDark]);

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
  };

  return (
    <div className="public-root auth-root" style={cssVars}>
      <nav className="public-nav">
        <button className="public-brand" type="button" onClick={() => navigate('/')}>
          <span className="tracked-wordmark">tracked<span className="tracked-dot">.</span></span>
          <span className="tracked-tagline">a quiet record of a life</span>
        </button>
        <button className="public-btn public-btn-secondary public-nav-action" type="button" onClick={() => navigate('/')}>
          Home
        </button>
      </nav>

      <main className="auth-main">
        <section className="auth-panel fade-up fade-up-1">
          <div className="auth-header">
            <div className="public-kicker">{isSignUp ? 'Create an account' : 'Welcome back'}</div>
            <h1>{isSignUp ? 'Start your record' : 'Sign in to tracked'}</h1>
            <p>{isSignUp ? 'Make a private grid for the signals you want to keep close.' : 'Return to your month view and keep the pattern going.'}</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={!isSignUp ? 'active' : ''}
              onClick={() => !anyLoading && setIsSignUp(false)}
              aria-selected={!isSignUp}
            >
              Sign in
            </button>
            <button
              type="button"
              className={isSignUp ? 'active' : ''}
              onClick={() => !anyLoading && setIsSignUp(true)}
              aria-selected={isSignUp}
            >
              Sign up
            </button>
          </div>

          {googleClientId ? (
            <div className={`auth-google ${anyLoading ? 'loading' : ''}`}>
              <div ref={googleButtonRef} />
              <div className="auth-divider">
                <span />
                <small>or</small>
                <span />
              </div>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
              />
            </label>

            {error ? <div className="auth-error">{error}</div> : null}

            <button className="public-btn public-btn-primary auth-submit" type="submit" disabled={anyLoading}>
              {isLoading
                ? (isSignUp ? 'Creating account...' : 'Signing in...')
                : (isSignUp ? 'Create account' : 'Sign in')}
            </button>
          </form>

          <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button type="button" onClick={toggleMode} disabled={anyLoading}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </section>
      </main>
    </div>
  );
};

export default Login;
