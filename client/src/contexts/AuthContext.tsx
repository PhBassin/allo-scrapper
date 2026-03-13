import React, { createContext, useState, useEffect, type ReactNode } from 'react';
import type { PermissionName } from '../types/role';

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
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    const isAuthenticated = !!token;
    const isAdmin = user?.role_name === 'admin' && user?.is_system_role === true;

    const hasPermission = (permission: PermissionName): boolean => {
        if (!user) return false;
        if (isAdmin) return true;  // Admin bypass client-side too
        return user.permissions.includes(permission);
    };

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }, [token]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, token, user, isAdmin, hasPermission, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
