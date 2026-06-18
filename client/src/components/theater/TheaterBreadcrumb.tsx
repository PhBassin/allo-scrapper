import { Link } from 'react-router-dom';

interface TheaterBreadcrumbProps {
  name: string;
}

export function TheaterBreadcrumb({ name }: TheaterBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
      <Link to="/" className="hover:text-primary hover:underline">← Accueil</Link>
      <span>/</span>
      <span>{name}</span>
    </div>
  );
}