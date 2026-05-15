import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../app/router.jsx';
import { useTheme } from '../theme/ThemeContext';
import { configAPI } from '../services/api';

const BUILD_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const Login = () => {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(BUILD_GOOGLE_CLIENT_ID || '');
  const { login, signup, loginWithGoogle } = useAuth();
  const { theme } = useTheme();

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
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rect',
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
  }, [loginWithGoogle, googleClientId]);

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
  };

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
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '32px',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.textMuted,
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: '24px',
              display: 'block',
            }}
          >
            ← Back
          </button>
          <div style={{
            fontSize: '10px',
            letterSpacing: '3px',
            color: theme.textMuted,
            marginBottom: '8px',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
        }}>
          Life Tracker
        </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '300',
            margin: 0,
            letterSpacing: '-0.5px',
          }}>
            {isSignUp ? 'Sign Up' : 'Login'}
          </h1>
        </div>

        {/* Google Login (top) */}
        {googleClientId ? (
          <div style={{
            width: '100%',
            opacity: anyLoading ? 0.6 : 1,
            pointerEvents: anyLoading ? 'none' : 'auto',
          }}>
            <div style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <div ref={googleButtonRef} />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              margin: '16px 0 24px',
            }}>
              <div style={{ flex: 1, height: '1px', background: theme.border }} />
              <span style={{ fontSize: '9px', color: theme.textMuted, letterSpacing: '1px' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: theme.border }} />
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '10px',
              letterSpacing: '1px',
              color: theme.textMuted,
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                background: theme.bgCard,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                padding: '12px 16px',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '10px',
              letterSpacing: '1px',
              color: theme.textMuted,
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                background: theme.bgCard,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                padding: '12px 16px',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '12px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={anyLoading}
            style={{
              width: '100%',
              background: theme.accent,
              border: 'none',
              color: theme.accentText,
              padding: '14px',
              fontSize: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: anyLoading ? 'default' : 'pointer',
              fontFamily: 'inherit',
              fontWeight: '500',
              opacity: anyLoading ? 0.6 : 1,
            }}
	          >
	            {isLoading
	              ? (isSignUp ? 'Creating account...' : 'Logging in...')
	              : (isSignUp ? 'Sign Up' : 'Login')}
	          </button>
	        </form>

	        <div style={{
	          textAlign: 'center',
	          marginTop: '24px',
          fontSize: '12px',
          color: theme.textMuted,
        }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span
            onClick={toggleMode}
	            style={{
	              color: theme.accent,
	              cursor: 'pointer',
	            }}
	          >
	            {isSignUp ? 'Login' : 'Sign Up'}
	          </span>
	        </div>
      </div>
    </div>
  );
};

export default Login;
