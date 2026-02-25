import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { isAuthenticated, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold flex items-center gap-2">
              <span className="text-primary">🎬</span>
              <span>Allo-Scrapper</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/" className="hover:text-primary transition">
                Accueil
              </Link>
              {isAuthenticated && (
                <Link to="/reports" className="hover:text-primary transition">
                  Rapports
                </Link>
              )}
              <div className="border-l border-gray-600 h-6"></div>
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-300">
                    Connecté en tant que <strong className="text-white">{user?.username}</strong>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded transition"
                  >
                    Déconnexion
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="text-sm bg-primary text-black hover:bg-yellow-500 font-medium px-4 py-2 rounded transition"
                >
                  Connexion
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        {title && <h1 className="text-3xl font-bold mb-6">{title}</h1>}
        {children}
      </main>

      <footer className="bg-secondary text-white mt-16">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-sm">
            Données fournies par le site source - Mise à jour hebdomadaire
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Allo-Scrapper &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
