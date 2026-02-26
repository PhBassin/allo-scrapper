import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useContext } from 'react';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CinemaPage from './pages/CinemaPage';
import FilmPage from './pages/FilmPage';
import ReportsPage from './pages/ReportsPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function AppRoutes() {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<{ originalPath: string }>;
      
      // Logout user
      logout();
      
      // Navigate to login with original path
      navigate('/login', { 
        state: { from: { pathname: customEvent.detail.originalPath } },
        replace: true 
      });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout, navigate]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cinema/:id" element={<CinemaPage />} />
        <Route path="/film/:id" element={<FilmPage />} />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/:reportId"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
