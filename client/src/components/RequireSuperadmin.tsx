/**
 * Route guard component that only allows superadmin access.
 * Checks the user object from AuthContext (httpOnly cookie-based auth).
 * 
 * System admins receive superadmin-scoped JWTs from /api/auth/login.
 * If the user is not a system admin, redirects to main login page.
 */
import { Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

interface RequireSuperadminProps {
  children: ReactNode;
}

export function RequireSuperadmin({ children }: RequireSuperadminProps) {
  const { isAdmin, isAuthenticated } = useContext(AuthContext);
  
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
