import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext, type User } from './AuthContext';

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    const isAuthenticated = !!user;
    const isAdmin = user?.role_name === 'admin' && user?.is_system_role === true;

    const hasPermission = (permission: string): boolean => {
        if (!user) return false;
        if (isAdmin) return true;
        return user.permissions.includes(permission as never);
    };

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);

    const login = (_newToken: string, newUser: User) => {
        setUser(newUser);
    };

    const logout = async () => {
        try {
            const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers,
            });
        } catch {
            // Ignore network errors during logout
        }

        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, token: null, user, isAdmin, hasPermission, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
