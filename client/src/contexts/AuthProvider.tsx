import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AuthContext, type User } from './AuthContext';

interface JwtPayload {
    exp?: number;
}

function decodeBase64Url(value: string): string | null {
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
        return atob(padded);
    } catch {
        return null;
    }
}

function isTokenExpired(token: string): boolean {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return true;

        const payloadJson = decodeBase64Url(parts[1]);
        if (!payloadJson) return true;

        const payload = JSON.parse(payloadJson) as JwtPayload;
        if (typeof payload.exp !== 'number') return true;

        const nowInSeconds = Math.floor(Date.now() / 1000);
        return payload.exp <= nowInSeconds;
    } catch {
        return true;
    }
}

function getTokenExpiry(token: string): number | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payloadJson = decodeBase64Url(parts[1]);
        if (!payloadJson) return null;

        const payload = JSON.parse(payloadJson) as JwtPayload;
        if (typeof payload.exp !== 'number') return null;

        return payload.exp;
    } catch {
        return null;
    }
}

function getInitialToken(): string | null {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return null;

    if (isTokenExpired(storedToken)) {
        sessionStorage.setItem('auth:expired', '1');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return null;
    }

    return storedToken;
}

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [token, setToken] = useState<string | null>(getInitialToken);
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isAuthenticated = !!token;
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

    const scheduleExpiryTimer = (tokenToCheck: string) => {
        clearExpiryTimer();
        
        const expiry = getTokenExpiry(tokenToCheck);
        if (expiry === null) return;
        
        const nowInSeconds = Math.floor(Date.now() / 1000);
        const msUntilExpiry = (expiry - nowInSeconds) * 1000;
        
        if (msUntilExpiry > 0) {
            expiryTimerRef.current = setTimeout(() => {
                setToken(null);
                setUser(null);
                
                window.dispatchEvent(
                    new CustomEvent('auth:unauthorized', {
                        detail: { reason: 'session_expired' }
                    })
                );
            }, msUntilExpiry);
        }
    };

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            scheduleExpiryTimer(token);
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            clearExpiryTimer();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);
    
    useEffect(() => {
        return () => {
            clearExpiryTimer();
        };
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        clearExpiryTimer();
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, token, user, isAdmin, hasPermission, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
