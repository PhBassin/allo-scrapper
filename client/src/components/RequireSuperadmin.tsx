import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { ConfigContext } from '../contexts/ConfigContext';

interface RequireSuperadminProps {
  children: React.ReactNode;
}

/**
 * Route guard that only renders children when:
 *  1. saasEnabled=true (superadmin portal only exists in SaaS mode)
 *  2. The current user is authenticated
 *  3. The JWT carries scope='superadmin'
 *
 * Otherwise redirects:
 *  - Unauthenticated → /login
 *  - Authenticated but not superadmin, or saasEnabled=false → /
 */
const RequireSuperadmin: React.FC<RequireSuperadminProps> = ({ children }) => {
  const { isAuthenticated, isSuperadmin } = useContext(AuthContext);
  const { config } = useContext(ConfigContext);

  if (!config.saasEnabled) {
    return <Navigate to="/" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperadmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RequireSuperadmin;
