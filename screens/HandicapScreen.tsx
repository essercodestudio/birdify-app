// screens/HandicapScreen.tsx - ATUALIZADO E CORRIGIDO

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

interface HandicapScreenProps {
  accessCode: string;
  onHandicapsSubmitted: () => void;
}

interface GroupPlayerData {
    id: number;
    fullName: string;
}
interface GroupData {
    groupId: number;
    players: GroupPlayerData[];
}

const HandicapScreen: React.FC<HandicapScreenProps> = ({ accessCode, onHandicapsSubmitted }) => {
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [handicaps, setHandicaps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/scorecard/${accessCode}`);
        setGroupData(response.data);
      } catch (err) {
        setError('Não foi possível carregar os dados do grupo.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroupData();
  }, [accessCode]);

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
  if (error) return <div className="text-red-400 text-center">{error}</div>;
  if (!groupData) return <p className="text-center text-gray-400 p-6">Grupo não encontrado ou código de acesso inválido.</p>;

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold text-white">Handicap do Grupo</h1>
      <p className="text-gray-400 mb-6">Insira o handicap de cada jogador para este torneio.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {groupData.players.map((player) => (
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