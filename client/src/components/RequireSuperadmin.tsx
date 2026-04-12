/**
 * Route guard component that only allows superadmin access.
 * Checks for scope='superadmin' in the JWT payload.
 */
import { Navigate } from 'react-router-dom';
import { useContext, type ReactNode } from 'react';
import { AuthContext } from '../contexts/AuthContext';

interface RequireSuperadminProps {
  children: ReactNode;
}

/**
 * Decode Base64URL to string.
 */
function decodeBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return atob(padded);
  } catch {
    return null;
  }
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

    const payloadJson = decodeBase64Url(parts[1]);
    if (!payloadJson) return null;

    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

export function RequireSuperadmin({ children }: RequireSuperadminProps) {
  const { user } = useContext(AuthContext);
  const decoded = decodeToken();
  
  const isSuperadmin = (decoded && decoded.scope === 'superadmin') || (user?.scope === 'superadmin');
  
  if (!isSuperadmin) {
    return <Navigate to="/superadmin/login" replace />;
  }

  return <>{children}</>;
}
