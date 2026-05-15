import React, { useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import LifeTracker from './components/LifeTracker';
import LogToday from './components/LogToday';
import { ThemeProvider } from './theme/ThemeContext';
import { Link, RouteSwitch, navigate, useRoutePath } from './app/router.jsx';

const NotFound = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
      color: '#888',
      background: '#0a0a0a',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '520px' }}>
        <div style={{ letterSpacing: '3px', textTransform: 'uppercase', fontSize: '10px', marginBottom: '10px' }}>
          Not Found
        </div>
        <div style={{ fontSize: '12px', lineHeight: 1.7, marginBottom: '16px' }}>
          This route doesn’t exist. Use the link below to get back.
        </div>
        <Link to="/" style={{ color: '#eab308', fontSize: '12px', textDecoration: 'none' }}>
          Go home
        </Link>
      </div>
    </div>
  );
};

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const path = useRoutePath();
  const routes = useMemo(() => ([
    { path: '/', element: LandingPage },
    { path: '/login', element: Login },
    { path: '/app', element: LifeTracker },
    { path: '/app/today', element: LogToday },
  ]), []);

  useEffect(() => {
    if (isLoading) return;
    const isAppRoute = path === '/app' || path.startsWith('/app/');
    if (isAuthenticated && !isAppRoute) navigate('/app', { replace: true });
    if (!isAuthenticated && isAppRoute) navigate('/login', { replace: true });
  }, [isAuthenticated, isLoading, path]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#888',
        fontFamily: '"JetBrains Mono", monospace',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Loading...
      </div>
    );
  }

  return <RouteSwitch routes={routes} fallback={<NotFound />} />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
