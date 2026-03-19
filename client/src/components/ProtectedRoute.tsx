import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated } = useContext(AuthContext);
    const location = useLocation();

    if (!isAuthenticated) {
        const isSessionExpired = sessionStorage.getItem('auth:expired') === '1';
        if (isSessionExpired) {
            sessionStorage.removeItem('auth:expired');
        }

        // Redirect to the login page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience
        // than dropping them off on the home page.
        return <Navigate to="/login" state={{ from: location, reason: isSessionExpired ? 'session_expired' : undefined }} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
