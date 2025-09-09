import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthProvider.jsx';
import Layout from './components/Layout.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import MainScreen from './screens/MainScreen.jsx';
import LeaderboardScreen from './screens/LeaderboardScreen.jsx';
import ScorecardScreen from './screens/ScorecardScreen.jsx';
import AdminDashboardScreen from './screens/AdminDashboardScreen.jsx';

// Componente para rotas protegidas
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    // Redireciona para a página de login se o usuário não estiver autenticado
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Componente para rotas de administrador
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') {
     // Redireciona para a home se o usuário não for admin
    return <Navigate to="/" replace />;
  }
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Layout>
      <Routes>
        {/* Rota Pública */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginScreen />} />
        
        {/* Rotas Protegidas */}
        <Route path="/" element={<ProtectedRoute><MainScreen /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardScreen /></ProtectedRoute>} />
        <Route path="/scorecard" element={<ProtectedRoute><ScorecardScreen /></ProtectedRoute>} />
        
        {/* Rota de Admin */}
        <Route path="/admin" element={<AdminRoute><AdminDashboardScreen /></AdminRoute>} />

        {/* Rota de Fallback */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Layout>
  );
};


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;