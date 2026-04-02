import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useContext, Suspense, lazy } from 'react';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CinemaPage from './pages/CinemaPage';
import FilmPage from './pages/FilmPage';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AdminPage from './pages/admin/AdminPage';
import RegisterPage from './pages/RegisterPage';
import { AuthContext } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthProvider';
import { SettingsProvider } from './contexts/SettingsProvider';
import { SettingsContext } from './contexts/SettingsContext';
import { ConfigProvider } from './contexts/ConfigProvider';
import { ConfigContext } from './contexts/ConfigContext';
import { TenantProvider } from './contexts/TenantProvider';
import ProtectedRoute from './components/ProtectedRoute';
import RequirePermission from './components/RequirePermission';
import ErrorBoundary from './components/ErrorBoundary';
import { useTheme } from './hooks/useTheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ADMIN_PERMISSIONS } from './utils/adminPermissions';

// SAAS_MODE is now resolved at runtime from /api/config — see ConfigContext

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
  const { config, isLoading: isLoadingConfig } = useContext(ConfigContext);

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

  // Show loading screen while fetching initial settings or server config
  if (isLoadingPublic || isLoadingConfig) {
    return <LoadingScreen />;
  }

  return (
    <Layout>
      {config.saasEnabled ? (
        // SaaS mode — multi-tenant routing under /org/:slug
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
          <Route
            path="/org/:slug/*"
            element={
              <TenantProvider>
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
                </Routes>
              </TenantProvider>
            }
          />
        </Routes>
      ) : (
        // Standalone mode
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
      )}
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <AuthProvider>
            <SettingsProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </SettingsProvider>
          </AuthProvider>
        </ConfigProvider>
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
