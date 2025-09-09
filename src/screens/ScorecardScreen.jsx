import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon.jsx';

const ScorecardScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
      <div className="flex items-center mb-6">
        <Button onClick={() => navigate('/')} variant="secondary" size="icon" className="mr-4">
          <ChevronLeftIcon className="h-6 w-6" />
        </Button>
        <h1 className="text-3xl font-bold text-white">Scorecard</h1>
      </div>
      <div className="text-center py-16">
        <p className="text-gray-400">A funcionalidade de marcação de pontos (Scorecard) será implementada aqui.</p>
        <p className="text-gray-500 text-sm mt-2">Você conectará esta tela à sua lógica de backend para salvar as pontuações.</p>
      </div>
    </div>
  );
};

export default ScorecardScreen;