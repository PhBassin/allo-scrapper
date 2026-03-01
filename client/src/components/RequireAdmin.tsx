import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

interface RequireAdminProps {
    children: React.ReactNode;
}

/**
 * Route guard that requires both authentication and admin role.
 * Redirects non-authenticated users to login, and non-admin users to home.
 */
const RequireAdmin: React.FC<RequireAdminProps> = ({ children }) => {
    const { isAuthenticated, isAdmin } = useContext(AuthContext);
    const location = useLocation();

    if (!isAuthenticated) {
        // Not logged in - redirect to login with return path
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!isAdmin) {
        // Logged in but not admin - redirect to home with error message
        return <Navigate to="/" state={{ error: 'Admin access required' }} replace />;
    }

    return <>{children}</>;
};

export default RequireAdmin;
