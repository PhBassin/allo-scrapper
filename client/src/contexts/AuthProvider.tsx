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
    const [sessionChecked, setSessionChecked] = useState(false);

    useEffect(() => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('auth:expired');
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function validateSession() {
            try {
                const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
                const headers: Record<string, string> = {};
                if (csrfToken) {
                    headers['X-CSRF-Token'] = csrfToken;
                }
                const res = await fetch('/api/auth/me', {
                    method: 'GET',
                    credentials: 'include',
                    headers,
                });
                if (!res.ok) {
                    if (!cancelled) {
                        setUser(null);
                        localStorage.removeItem('user');
                    }
                }
            } catch {
                if (!cancelled) {
                    setUser(null);
                    localStorage.removeItem('user');
                }
            } finally {
                if (!cancelled) {
                    setSessionChecked(true);
                }
            }
        }
        if (user) {
            validateSession();
        } else {
            setSessionChecked(true);
        }
        return () => { cancelled = true; };
    }, []);

    const isAuthenticated = sessionChecked ? !!user : false;
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

    const login = (newUser: User) => {
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
        <AuthContext.Provider value={{ isAuthenticated, user, isAdmin, hasPermission, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
