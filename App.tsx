// essercodestudio/birdify-app/birdify-app-292f4c7e273124d606a73f19222b8d25fd42d22f/App.tsx

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
import TournamentRegistrationScreen from "./screens/TournamentRegistrationScreen";
import AdminDashboardScreen from "./screens/AdminDashboardScreen";
import PlayerDetailScreen from "./screens/PlayerDetailScreen"; // Importar a nova tela

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useContext(AuthContext);
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useContext(AuthContext);
    if (!user || user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

const AppRoutes: React.FC = () => {
    const { user } = useContext(AuthContext);

    return (
        <Layout>
            <Routes>
                <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginScreen />} />
                <Route path="/reset/:token" element={<ResetPasswordScreen />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyScreen />} />
                <Route path="/terms-of-use" element={<TermsOfUseScreen />} />
                <Route path="/register/:tournamentId" element={<TournamentRegistrationScreen />} />

                {/* Rota de Detalhes do Jogador */}
                <Route path="/leaderboard/:tournamentId/player/:playerId" element={
                    <ProtectedRoute>
                        <PlayerDetailScreen />
                    </ProtectedRoute>
                } />

                <Route path="/admin" element={
                    <AdminRoute>
                        <AdminDashboardScreen onBack={() => window.history.back()} />
                    </AdminRoute>
                } />

                <Route path="/" element={
                    <ProtectedRoute>
                        <MainScreen />
                    </ProtectedRoute>
                } />
                
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    );
};

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