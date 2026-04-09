/**
 * Route guard component that only allows superadmin access.
 * Checks for scope='superadmin' in the JWT payload.
 */
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface RequireSuperadminProps {
  children: ReactNode;
}

/**
 * Decode JWT payload from localStorage token.
 * Returns null if no token or invalid token.
 */
function decodeToken(): { scope?: string } | null {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export function RequireSuperadmin({ children }: RequireSuperadminProps) {
  const decoded = decodeToken();
  
  if (!decoded || decoded.scope !== 'superadmin') {
    return <Navigate to="/superadmin/login" replace />;
  }

  return <>{children}</>;
}
