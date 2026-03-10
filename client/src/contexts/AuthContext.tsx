import React, { createContext, useState, useEffect, type ReactNode } from 'react';

export interface User {
    id: number;
    username: string;
    role: 'admin' | 'user';
}

interface AuthContextType {
    isAuthenticated: boolean;
    token: string | null;
    user: User | null;
    isAdmin: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    token: null,
    user: null,
    isAdmin: false,
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
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            // Optional: Set default auth header here too, but interceptor usually handles it better
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
        <AuthContext.Provider value={{ isAuthenticated, token, user, isAdmin, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
