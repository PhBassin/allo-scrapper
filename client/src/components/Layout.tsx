import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-secondary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold flex items-center gap-2">
              <span className="text-primary">🎬</span>
              <span>Allo-Scrapper</span>
            </Link>
            <nav className="flex gap-4">
              <Link to="/" className="hover:text-primary transition">
                Accueil
              </Link>
              <Link to="/reports" className="hover:text-primary transition">
                Rapports
              </Link>
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
