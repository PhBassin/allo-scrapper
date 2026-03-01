import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { SettingsContext } from '../contexts/SettingsContext';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { isAuthenticated, isAdmin, user, logout } = useContext(AuthContext);
  const { publicSettings } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const APP_NAME = publicSettings?.site_name || import.meta.env.VITE_APP_NAME || 'Allo-Scrapper';
  const logo = publicSettings?.logo_base64;

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    navigate('/');
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold flex items-center gap-2">
              {logo ? (
                <img 
                  src={logo} 
                  alt={`${APP_NAME} logo`} 
                  className="h-8 w-8 object-contain" 
                />
              ) : (
                <span className="text-primary">🎬</span>
              )}
              <span>{APP_NAME}</span>
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
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={toggleDropdown}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition"
                    data-testid="user-menu-button"
                  >
                    <span>
                      Connecté en tant que <strong className="text-white">{user?.username}</strong>
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isDropdownOpen && (
                    <div 
                      className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10"
                      data-testid="user-dropdown-menu"
                    >
                      {isAdmin && (
                        <>
                          <Link
                            to="/admin/settings"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                            onClick={() => setIsDropdownOpen(false)}
                            data-testid="admin-settings-link"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>Settings</span>
                            </div>
                          </Link>
                          <div className="border-t border-gray-100"></div>
                        </>
                      )}
                      <Link
                        to="/change-password"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                        onClick={() => setIsDropdownOpen(false)}
                        data-testid="change-password-link"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          <span>Change Password</span>
                        </div>
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                        data-testid="logout-button"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Déconnexion</span>
                        </div>
                      </button>
                    </div>
                  )}
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
            {publicSettings?.footer_text || 'Données fournies par le site source - Mise à jour hebdomadaire'}
          </p>
          {publicSettings?.footer_links && publicSettings.footer_links.length > 0 && (
            <div className="flex justify-center gap-4 mt-3">
              {publicSettings.footer_links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-primary transition"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {APP_NAME} &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
