import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { user, loading } = useAuth();
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        if (!loading) return;
        const timer = setTimeout(() => setTimedOut(true), 10000);
        return () => clearTimeout(timer);
    }, [loading]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-sm">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando...</p>
                    {timedOut && (
                        <div className="mt-6">
                            <p className="text-sm text-red-600 mb-3">
                                A autenticação está demorando mais do que o esperado. Pode ser um problema de conexão.
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
