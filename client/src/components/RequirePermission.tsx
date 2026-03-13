import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import type { PermissionName } from '../types/role';

interface RequirePermissionProps {
    children: React.ReactNode;
    permission?: PermissionName; // If absent → just authenticated
    anyOf?: PermissionName[];    // At least one of the permissions
    allOf?: PermissionName[];    // All of the permissions
}

/**
 * Route guard that requires authentication and optionally specific permissions.
 * - No permission props → just requires authentication
 * - permission → requires that specific permission
 * - anyOf → requires at least one of the listed permissions
 * - allOf → requires all listed permissions
 *
 * Redirects unauthenticated users to /login,
 * and insufficiently-permitted users to / with an error state.
 */
const RequirePermission: React.FC<RequirePermissionProps> = ({ children, permission, anyOf, allOf }) => {
    const { isAuthenticated, hasPermission } = useContext(AuthContext);
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (permission && !hasPermission(permission)) {
        return <Navigate to="/" state={{ error: 'Permission insuffisante' }} replace />;
    }

    if (allOf && !allOf.every(p => hasPermission(p))) {
        return <Navigate to="/" state={{ error: 'Permission insuffisante' }} replace />;
    }

    if (anyOf && !anyOf.some(p => hasPermission(p))) {
        return <Navigate to="/" state={{ error: 'Permission insuffisante' }} replace />;
    }

    return <>{children}</>;
};

export default RequirePermission;
