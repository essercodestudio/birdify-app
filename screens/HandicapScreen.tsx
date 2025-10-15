// screens/HandicapScreen.tsx - VERSÃO CORRIGIDA

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import { User } from '../types';
import { AuthContext } from '../context/AuthContext';

interface HandicapScreenProps {
  accessCode: string;
  onHandicapsSubmitted: () => void;
  user: User | null;
  type: 'tournament' | 'training';
}

interface GroupPlayerData {
    id: number;
    fullName: string;
}
interface GroupData {
    groupId: number;
    players: GroupPlayerData[];
}

const HandicapScreen: React.FC<HandicapScreenProps> = ({ accessCode, onHandicapsSubmitted, user, type }) => {
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [handicaps, setHandicaps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroupData = async () => {
      if (!user || !accessCode) { // Verificação robusta
          setError('Utilizador não autenticado ou código de acesso inválido.');
          setLoading(false);
          return;
      }
      try {
        const url = type === 'tournament'
            ? `${import.meta.env.VITE_API_URL}/api/scorecard/${accessCode}?playerId=${user.id}`
            : `${import.meta.env.VITE_API_URL}/api/trainings/scorecard/${accessCode}?playerId=${user.id}`;
        
        const response = await axios.get(url);
        setGroupData(response.data);
      } catch (err) {
        setError('Não foi possível carregar os dados do grupo. Verifique o código de acesso.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroupData();
  }, [accessCode, user, type]);

  const handleHandicapChange = (playerId: string, value: string) => {
    if (/^\d*$/.test(value)) {
      setHandicaps(prev => ({ ...prev, [playerId]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (groupData && groupData.players.some((p: any) => !handicaps[p.id] || handicaps[p.id] === '')) {
        return alert('Por favor, preencha o handicap para todos os jogadores.');
    }

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/groups/handicaps`, {
        groupId: groupData?.groupId,
        handicaps: handicaps
      });
      onHandicapsSubmitted();
    } catch (err) {
      setError('Não foi possível salvar os handicaps.');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-400 text-center p-4">{error}</div>;
  if (!groupData) return null;

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold text-white">Handicap do Grupo</h1>
      <p className="text-gray-400 mb-6">Insira o handicap de cada jogador para esta rodada.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {groupData.players.map((player: any) => (
          <div key={player.id}>
            <label htmlFor={`hcp-${player.id}`} className="block text-sm font-medium text-white">{player.fullName}</label>
            <input
              id={`hcp-${player.id}`}
              type="text"
              inputMode="numeric" 
              value={handicaps[player.id] || ''}
              onChange={(e) => handleHandicapChange(player.id.toString(), e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"
            />
          </div>
        ))}
        <Button type="submit" className="w-full mt-6">
          Confirmar Handicaps e Iniciar Jogo
        </Button>
      </form>
    </div>
  );
};

export default HandicapScreen;