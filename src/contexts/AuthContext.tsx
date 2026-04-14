import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string, rememberMe: boolean) => Promise<{ error: any }>;
    signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: any }>;
    loginAsDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Modo demo só fica disponível em desenvolvimento. Em produção, a flag
// em localStorage é ignorada para não vazar um login fake.
const DEMO_ENABLED = import.meta.env.DEV;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for demo mode (só em DEV)
        const isDemo = DEMO_ENABLED && localStorage.getItem('demoMode') === 'true';
        if (!DEMO_ENABLED) {
            // Em produção, limpa qualquer flag antiga.
            localStorage.removeItem('demoMode');
        }
        if (isDemo) {
            setUser({
                id: 'demo-user',
                email: 'demo@rubiajoias.com',
                app_metadata: {},
                user_metadata: { name: 'Usuário Demo' },
                aud: 'authenticated',
                created_at: new Date().toISOString()
            } as User);
            setLoading(false);
            return;
        }

        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!localStorage.getItem('demoMode')) {
                setUser(session?.user ?? null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string, rememberMe: boolean) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (!error && rememberMe) {
            localStorage.setItem('rememberMe', 'true');
        }

        return { error };
    };

    const signUp = async (email: string, password: string, name: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name,
                }
            }
        });

        return { error };
    };

    const signOut = async () => {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('demoMode');
        setUser(null);
        await supabase.auth.signOut();
    };

    const resetPassword = async (email: string) => {
        // A rota /reset-password agora existe em App.tsx (é o Login em modo 'reset').
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        return { error };
    };

    const loginAsDemo = async () => {
        if (!DEMO_ENABLED) {
            console.warn('Demo mode está desabilitado em produção.');
            return;
        }
        const demoUser = {
            id: 'demo-user',
            email: 'demo@rubiajoias.com',
            app_metadata: {},
            user_metadata: { name: 'Usuário Demo' },
            aud: 'authenticated',
            created_at: new Date().toISOString()
        } as User;

        setUser(demoUser);
        localStorage.setItem('demoMode', 'true');
    };

    const value = {
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        loginAsDemo
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
