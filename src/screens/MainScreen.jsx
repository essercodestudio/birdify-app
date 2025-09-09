import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider.jsx';
import Button from '../components/Button.jsx';

const MainScreen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-white">Bem-vindo, {user?.fullName}!</h1>
        <p className="text-gray-400 mt-2">Selecione uma opção para começar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card para Scorecard */}
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-green-400 mb-4">Marcar Pontuação</h2>
          <p className="text-gray-300 mb-4">Acesse a tela de marcação para inserir as pontuações.</p>
          <Button onClick={() => navigate('/scorecard')} className="w-full sm:w-auto">Ir para Scorecard</Button>
        </div>

        {/* Card para Leaderboard */}
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-green-400 mb-4">Ver Leaderboard</h2>
          <p className="text-gray-300 mb-4">Confira o leaderboard do torneio.</p>
          <Button onClick={() => navigate('/leaderboard')} className="w-full sm:w-auto">Ver Leaderboard</Button>
        </div>

        {/* Card para Admin, visível apenas para administradores */}
        {user?.role === 'admin' && (
             <div className="p-6 bg-gray-800 rounded-lg shadow-lg md:col-span-2">
                <h2 className="text-2xl font-bold text-green-400 mb-4">Painel do Administrador</h2>
                <p className="text-gray-300 mb-4">Gerencie campos, torneios e grupos para os seus eventos.</p>
                <Button onClick={() => navigate('/admin')}>Acessar Painel</Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default MainScreen;