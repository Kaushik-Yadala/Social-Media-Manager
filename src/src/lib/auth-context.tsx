'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { users, validCredentials } from '@/lib/stub-data/users';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    loginAttempts: number;
}

interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_LOGIN_ATTEMPTS = 5;

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        loginAttempts: 0,
    });

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        if (state.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Account locked. Too many failed login attempts. Please contact an administrator.',
            }));
            return false;
        }

        const cred = validCredentials.find(c => c.email === email && c.password === password);

        if (!cred) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Invalid email or password. Please try again.',
                loginAttempts: prev.loginAttempts + 1,
            }));
            return false;
        }

        const user = users.find(u => u.email === email)!;
        setState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            loginAttempts: 0,
        });
        return true;
    }, [state.loginAttempts]);

    const logout = useCallback(() => {
        setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            loginAttempts: 0,
        });
    }, []);

    const hasRole = useCallback((role: UserRole | UserRole[]) => {
        if (!state.user) return false;
        const roles = Array.isArray(role) ? role : [role];
        return roles.includes(state.user.role);
    }, [state.user]);

    return (
        <AuthContext.Provider value={{ ...state, login, logout, hasRole }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
