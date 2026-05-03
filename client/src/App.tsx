/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useContext, Suspense, lazy, useState, type ReactNode } from 'react';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CinemaPage from './pages/CinemaPage';
import FilmPage from './pages/FilmPage';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AdminPage from './pages/admin/AdminPage';
import SuperadminPage from './pages/admin/SuperadminPage';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import { AuthContext } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthProvider';
import { SettingsProvider } from './contexts/SettingsProvider';
import { SettingsContext } from './contexts/SettingsContext';
import { TenantProvider } from './contexts/TenantProvider';
import ProtectedRoute from './components/ProtectedRoute';
import RequirePermission from './components/RequirePermission';
import { RequireSuperadmin } from './components/RequireSuperadmin';
import ErrorBoundary from './components/ErrorBoundary';
import { useTheme } from './hooks/useTheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ADMIN_PERMISSIONS } from './utils/adminPermissions';
import { getConfig } from './api/saas';
import { getTenantScopedPath } from './api/client';

// Lazy load devtools only in development
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      }))
    )
  : () => null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const { isLoadingPublic } = useContext(SettingsContext);

  // Apply theme globally
  useTheme();

  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<{ originalPath: string; reason?: 'session_expired' }>;
      const reason = customEvent.detail?.reason;
      const isSessionExpired = reason === 'session_expired';

      if (isSessionExpired) {
        sessionStorage.setItem('auth:expired', '1');
      }
      
      // Logout user
      logout();
      
      // Navigate to login with original path
      navigate('/login', { 
        state: {
          from: { pathname: customEvent.detail.originalPath },
          reason,
        },
        replace: true 
      });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout, navigate]);

  // Show loading screen while fetching initial settings
  if (isLoadingPublic) {
    return <LoadingScreen />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route path="/cinema/:id" element={<CinemaPage />} />
        <Route path="/film/:id" element={<FilmPage />} />
        <Route
          path="/admin"
          element={
            <RequirePermission anyOf={ADMIN_PERMISSIONS}>
              <AdminPage />
            </RequirePermission>
          }
        />
      </Routes>
    </Layout>
  );
}

/**
 * SaasRoutes — rendered when SAAS_ENABLED=true.
 *
 * /            → LandingPage
 * /login       → LoginPage (standalone, no Layout)
 * /register    → RegisterPage (standalone, no Layout)
 * /org/:slug/* → tenant-scoped routes wrapped in TenantProvider
 */
function TenantLoginRedirect({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.location.pathname.startsWith('/org/')) {
      return;
    }

    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<{ originalPath?: string; reason?: 'session_expired' }>;
      const reason = customEvent.detail?.reason;
      const originalPath = customEvent.detail?.originalPath ?? window.location.pathname;

      if (reason === 'session_expired') {
        sessionStorage.setItem('auth:expired', '1');
      }

      navigate(getTenantScopedPath('/login'), {
        state: { from: { pathname: originalPath }, reason },
        replace: true,
      });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  return <>{children}</>;
}

function TenantAppRoutes() {
  const { isLoadingPublic } = useContext(SettingsContext);

  useTheme();

  if (isLoadingPublic) {
    return <LoadingScreen />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cinema/:id" element={<CinemaPage />} />
        <Route path="/film/:id" element={<FilmPage />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <RequirePermission anyOf={ADMIN_PERMISSIONS}>
              <AdminPage />
            </RequirePermission>
          }
        />
      </Routes>
    </Layout>
  );
}

function SaasRoutes() {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<{ originalPath?: string; reason?: 'session_expired' }>;
      const reason = customEvent.detail?.reason;
      const originalPath = customEvent.detail?.originalPath ?? window.location.pathname;
      if (reason === 'session_expired') {
        sessionStorage.setItem('auth:expired', '1');
      }
      logout();

      const loginPath = originalPath.startsWith('/org/')
        ? getTenantScopedPath('/login')
        : '/login';

      navigate(loginPath, {
        state: { from: { pathname: originalPath }, reason },
        replace: true,
      });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout, navigate]);

  return (
    <Routes>
      {/* Public SaaS pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Superadmin routes */}
      <Route
        path="/superadmin/*"
        element={
          <RequireSuperadmin>
            <SuperadminPage />
          </RequireSuperadmin>
        }
      />

      {/* Org-scoped tenant routes */}
      <Route
        path="/org/:slug/*"
        element={
          <TenantProvider>
            <SettingsProvider>
              <TenantLoginRedirect>
                <TenantAppRoutes />
              </TenantLoginRedirect>
            </SettingsProvider>
          </TenantProvider>
        }
      />
    </Routes>
  );
}

function App() {
  const [saasEnabled, setSaasEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    getConfig()
      .then((cfg) => setSaasEnabled(cfg.saasEnabled))
      .catch((err) => {
        console.error('Failed to load config:', err);
        setError(true);
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Configuration Error</h1>
          <p className="text-gray-600 mb-4">
            Failed to load application configuration. Please check your connection and try again.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Wait until config is loaded before rendering routes
  if (saasEnabled === null) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            {saasEnabled ? (
              <SaasRoutes />
            ) : (
              <SettingsProvider>
                <AppRoutes />
              </SettingsProvider>
            )}
          </BrowserRouter>
        </AuthProvider>
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
