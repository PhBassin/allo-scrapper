import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import { ADMIN_PERMISSIONS } from '../utils/adminPermissions.js';
import { useScrollHeader, useClickOutside } from '../hooks/useLayoutChrome.js';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

const HEADER_OFFSET_VAR = '--layout-header-offset';

export default function Layout({ children, title }: LayoutProps) {
  const { isAuthenticated, user, logout, hasPermission } = useContext(AuthContext);
  const { publicSettings } = useContext(SettingsContext);
  const navigate = useNavigate();

  const APP_NAME = publicSettings?.site_name || import.meta.env.VITE_APP_NAME || 'Allo-Scrapper';
  const logo = publicSettings?.logo_base64 ?? undefined;
  const hasAdminAccess = isAuthenticated && ADMIN_PERMISSIONS.some((perm) => hasPermission(perm));

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        appName={APP_NAME}
        logo={logo}
        isAuthenticated={isAuthenticated}
        username={user?.username ?? undefined}
        hasAdminAccess={hasAdminAccess}
        onLogout={() => {
          logout();
          navigate('/');
        }}
      />
      <main className="container mx-auto px-4 py-4 flex-1">
        {title && <h1 className="text-3xl font-bold mb-6">{title}</h1>}
        {children}
      </main>
      <Footer appName={APP_NAME} footerText={publicSettings?.footer_text ?? undefined} footerLinks={publicSettings?.footer_links} />
    </div>
  );
}

interface HeaderProps {
  appName: string;
  logo?: string;
  isAuthenticated: boolean;
  username?: string;
  hasAdminAccess: boolean;
  onLogout: () => void;
}

function Header({ appName, logo, isAuthenticated, username, hasAdminAccess, onLogout }: HeaderProps) {
  const isHeaderVisible = useScrollHeader();

  useLayoutHeaderOffset(isHeaderVisible);

  return (
    <header
      className={`bg-secondary text-white shadow-lg sticky top-0 z-50 transform transition-transform duration-300 will-change-transform ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <BrandLink appName={appName} logo={logo} />
          <nav className="flex items-center gap-6">
            <Link to="/" className="hover:text-primary transition">Accueil</Link>
            {hasAdminAccess && (
              <Link to="/admin?tab=theaters" className="hover:text-primary transition">Admin</Link>
            )}
            <div className="border-l border-gray-600 h-6"></div>
            {isAuthenticated ? (
              <UserMenu username={username} onLogout={onLogout} />
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
  );
}

function useLayoutHeaderOffset(isHeaderVisible: boolean) {
  useEffect(() => {
    document.documentElement.style.setProperty(HEADER_OFFSET_VAR, isHeaderVisible ? '64px' : '0px');
    return () => {
      document.documentElement.style.setProperty(HEADER_OFFSET_VAR, '64px');
    };
  }, [isHeaderVisible]);
}

function BrandLink({ appName, logo }: { appName: string; logo?: string }) {
  return (
    <Link to="/" className="text-2xl font-bold flex items-center gap-2">
      {logo ? (
        <img src={logo} alt={`${appName} logo`} className="h-8 w-8 object-contain" />
      ) : (
        <span className="text-primary">🎬</span>
      )}
      <span>{appName}</span>
    </Link>
  );
}

function UserMenu({ username, onLogout }: { username?: string; onLogout: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useClickOutside<HTMLDivElement>(isOpen, () => setIsOpen(false));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition"
        data-testid="user-menu-button"
      >
        <span>Connecté en tant que <strong className="text-white">{username}</strong></span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10"
          data-testid="user-dropdown-menu"
        >
          <MenuLink to="/change-password" icon="key" label="Change Password" testId="change-password-link" onClose={() => setIsOpen(false)} />
          <div className="border-t border-gray-100"></div>
          <button
            onClick={onLogout}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
            data-testid="logout-button"
          >
            <div className="flex items-center gap-2">
              <LogoutIcon />
              <span>Déconnexion</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, icon, label, testId, onClose }: {
  to: string;
  icon: 'key';
  label: string;
  testId: string;
  onClose: () => void;
}) {
  return (
    <Link
      to={to}
      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
      onClick={onClose}
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        {icon === 'key' && <KeyIcon />}
        <span>{label}</span>
      </div>
    </Link>
  );
}

function KeyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function Footer({
  appName,
  footerText,
  footerLinks,
}: {
  appName: string;
  footerText?: string;
  footerLinks?: Array<{ url: string; label: string }>;
}) {
  return (
    <footer className="bg-secondary text-white mt-16">
      <div className="container mx-auto px-4 py-6 text-center">
        <p className="text-sm">
          {footerText || 'Données fournies par le site source - Mise à jour hebdomadaire'}
        </p>
        {footerLinks && footerLinks.length > 0 && (
          <div className="flex justify-center gap-4 mt-3">
            {footerLinks.map((link, index) => (
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
          {appName} &copy; {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}