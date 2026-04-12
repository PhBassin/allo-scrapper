import { createContext } from 'react';
import type { PermissionName } from '../types/role';

export interface User {
    id: number | string;
    username: string;
    role_id?: number;
    role_name?: string;
    is_system_role?: boolean;
    permissions: PermissionName[];
    org_slug?: string;
    scope?: string;
}

export interface AuthContextType {
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
