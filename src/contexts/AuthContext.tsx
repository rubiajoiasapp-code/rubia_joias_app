import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, AuthError } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string, rememberMe: boolean) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string, name: string) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
    loginAsDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Modo demo só fica disponível em desenvolvimento. Em produção, a flag
// em localStorage é ignorada para não vazar um login fake.
const DEMO_ENABLED = import.meta.env.DEV;

/** Usuário sintético do modo demo, ou null. Em produção apaga a flag antiga. */
function usuarioDemo(): User | null {
    if (!DEMO_ENABLED) {
        localStorage.removeItem('demoMode');
        return null;
    }
    if (localStorage.getItem('demoMode') !== 'true') return null;
    return {
        id: 'demo-user',
        email: 'demo@rubiajoias.com',
        app_metadata: {},
        user_metadata: { name: 'Usuário Demo' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
    } as User;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Inicializador preguiçoso em vez de setState dentro do efeito: se há modo demo, isso
    // já se sabe antes da primeira renderização, então não faz sentido renderizar uma vez
    // sem usuário e corrigir logo depois — era disso que o react-hooks reclamava.
    const [demo] = useState(usuarioDemo);
    const [user, setUser] = useState<User | null>(demo);
    const [loading, setLoading] = useState(demo === null);

    useEffect(() => {
        // Sessão do Supabase não se aplica ao usuário fake do modo demo.
        if (demo) return;

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
    }, [demo]);

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
