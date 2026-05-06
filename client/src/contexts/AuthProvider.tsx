import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AuthContext, type User } from './AuthContext';

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isAuthenticated = !!user;
    const isAdmin = user?.role_name === 'admin' && user?.is_system_role === true;

    const hasPermission = (permission: string): boolean => {
        if (!user) return false;
        if (isAdmin) return true;
        return user.permissions.includes(permission as never);
    };

    const clearExpiryTimer = () => {
        if (expiryTimerRef.current !== null) {
            clearTimeout(expiryTimerRef.current);
            expiryTimerRef.current = null;
        }
    };

    // On mount, try to restore session from httpOnly cookie via /api/auth/me
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const response = await fetch('/api/auth/me', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data) {
                        setUser(data.data);
                        // Token is in httpOnly cookie — we don't have it client-side,
                        // but we keep a placeholder so AuthContext.token is non-null
                        // for backward compatibility with existing code.
                        setToken('cookie');
                    }
                }
            } catch {
                // Cookie not present or network error — stay logged out
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, []);

    useEffect(() => {
        return () => {
            clearExpiryTimer();
        };
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
    };

    const logout = async () => {
        clearExpiryTimer();
        try {
            const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
            });
        } catch {
            // Best-effort logout
        }
        setToken(null);
        setUser(null);
    };

    if (loading) {
        return null; // Wait for session restoration before rendering
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, token, user, isAdmin, hasPermission, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
