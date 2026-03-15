import React, { createContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { PermissionName } from '../types/role';

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

/**
 * Extract the expiry timestamp (in seconds) from a JWT token
 */
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

export interface User {
    id: number;
    username: string;
    role_id: number;
    role_name: string;       // e.g. 'admin', 'operator'
    is_system_role: boolean; // true only for built-in system roles (admin, operator)
    permissions: PermissionName[]; // e.g. ['scraper:trigger', 'cinemas:create', ...]
}

interface AuthContextType {
    isAuthenticated: boolean;
    token: string | null;
    user: User | null;
    isAdmin: boolean;
    hasPermission: (permission: PermissionName) => boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    token: null,
    user: null,
    isAdmin: false,
    hasPermission: () => false,
    login: () => { },
    logout: () => { },
});

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

    const hasPermission = (permission: PermissionName): boolean => {
        if (!user) return false;
        if (isAdmin) return true;  // Admin bypass client-side too
        return user.permissions.includes(permission);
    };
    
    /**
     * Clear any existing expiry timer
     */
    const clearExpiryTimer = () => {
        if (expiryTimerRef.current !== null) {
            clearTimeout(expiryTimerRef.current);
            expiryTimerRef.current = null;
        }
    };
    
    /**
     * Schedule auto-logout at token expiry time
     */
    const scheduleExpiryTimer = (tokenToCheck: string) => {
        clearExpiryTimer();
        
        const expiry = getTokenExpiry(tokenToCheck);
        if (expiry === null) return;
        
        const nowInSeconds = Math.floor(Date.now() / 1000);
        const msUntilExpiry = (expiry - nowInSeconds) * 1000;
        
        // Only schedule if expiry is in the future
        if (msUntilExpiry > 0) {
            expiryTimerRef.current = setTimeout(() => {
                // Auto-logout and notify
                setToken(null);
                setUser(null);
                
                // Dispatch auth:unauthorized event with session_expired reason
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
    }, [token]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);
    
    // Cleanup timer on unmount
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
