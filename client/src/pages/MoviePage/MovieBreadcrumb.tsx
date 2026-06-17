import { Link } from 'react-router-dom';

export function MovieBreadcrumb({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
      <Link to="/" className="hover:text-primary hover:underline">← Accueil</Link>
      <span>/</span>
      <span>{title}</span>
    </div>
  );
}
