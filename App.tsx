// App.tsx - VERSÃO COMPLETA E ATUALIZADA

import React, { useState, useMemo, useEffect, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User } from "./types";
import { AuthContext } from "./context/AuthContext";
import LoginScreen from "./screens/LoginScreen";
import MainScreen from "./screens/MainScreen";
import Layout from "./components/Layout";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import PrivacyPolicyScreen from "./screens/PrivacyPolicyScreen";
import TermsOfUseScreen from "./screens/TermsOfUseScreen";
import TournamentRegistrationScreen from "./screens/TournamentRegistrationScreen"; // Importação da nova tela

// Componente para proteger rotas que precisam de login
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useContext(AuthContext);
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

// Componente que define todas as rotas da aplicação
const AppRoutes: React.FC = () => {
    const { user } = useContext(AuthContext);

    return (
        <Layout>
            <Routes>
                {/* Rotas Públicas */}
                <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginScreen />} />
                <Route path="/reset/:token" element={<ResetPasswordScreen />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyScreen />} />
                <Route path="/terms-of-use" element={<TermsOfUseScreen />} />
                
                {/* Rota de Inscrição (requer login, mas o componente trata do redirecionamento) */}
                <Route path="/register/:tournamentId" element={<TournamentRegistrationScreen />} />

                {/* Rota Principal Protegida */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <MainScreen />
                    </ProtectedRoute>
                } />
                
                {/* Rota de fallback para qualquer outro caminho */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    );
};

// Componente principal da aplicação
const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const storedUser = localStorage.getItem("birdifyUser");
            return storedUser ? JSON.parse(storedUser) : null;
        } catch (error) {
            return null;
        }
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem("birdifyUser", JSON.stringify(user));
        } else {
            localStorage.removeItem("birdifyUser");
        }
    }, [user]);

    const authContextValue = useMemo(
        () => ({
            user,
            login: (loggedInUser: User) => setUser(loggedInUser),
            logout: () => {
                setUser(null);
                // Limpa a "memória" da última tela visitada ao fazer logout
                localStorage.removeItem('activeScreen');
                localStorage.removeItem('activeAccessCode');
                localStorage.removeItem('selectedTournamentId');
            },
        }),
        [user]
    );

    return (
        <AuthContext.Provider value={authContextValue}>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthContext.Provider>
    );
};

export default App;
