// screens/LeaderboardScreen.tsx - VERSÃO ATUALIZADA COM MODALIDADE

import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import PlayerDetailScreen from './PlayerDetailScreen';

interface LeaderboardScreenProps {
  tournamentId: string;
  onBack: () => void;
}
type ViewMode = 'Gross' | 'Net';
type Category = 'Male' | 'Female';

const formatToPar = (score: number) => { 
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
};

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ tournamentId, onBack }) => {
  const { user } = useContext(AuthContext); 
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('Gross');
  const [category, setCategory] = useState<Category>('Male');
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  
  // Determina a modalidade a partir do utilizador logado. O padrão é 'Golf'.
  const modality = useMemo(() => user?.modality || 'Golf', [user]);

  const fetchLeaderboard = useCallback(async () => { 
    try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/leaderboard/${tournamentId}`); 
        setPlayers(response.data);
      } catch (err) {
        setError("Não foi possível carregar o leaderboard.");
        console.error(err);
      } finally {
        if (loading) {
          setLoading(false);
        }
      }
  }, [tournamentId, loading]);

  useEffect(() => {
    fetchLeaderboard();
    const intervalId = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(intervalId);
  }, [fetchLeaderboard]);
  
  const handleExport = async () => {
    try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/export`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Relatorio_Torneio.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        alert('Erro ao gerar o relatório.');
        console.error(error);
    }
  };

  const sortedData = useMemo(() => { 
    return players.filter(p => p.gender === category);
  }, [players, category]);

  if (loading) return <Spinner />;
  if (error) return <p className="text-red-400 text-center">{error}</p>;
  if (selectedPlayer) { 
    return <PlayerDetailScreen player={selectedPlayer} tournamentId={tournamentId} onBack={() => setSelectedPlayer(null)} />
  }

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
            <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                <ChevronLeftIcon className="h-6 w-6" />
            </Button>
            {/* TÍTULO DINÂMICO BASEADO NA MODALIDADE */}
            <h1 className="text-3xl font-bold text-white">Leaderboard de {modality}</h1>
        </div>
        {user?.role === 'admin' && (
            <Button onClick={handleExport}>
                Exportar Relatório Detalhado
            </Button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <div className="flex bg-gray-700 rounded-lg p-1">
              <Button onClick={() => setCategory('Male')} variant={category === 'Male' ? 'primary' : 'secondary'} size="sm" className={category !== 'Male' ? 'bg-transparent' : ''}>Masculino</Button>
              <Button onClick={() => setCategory('Female')} variant={category === 'Female' ? 'primary' : 'secondary'} size="sm" className={category !== 'Female' ? 'bg-transparent' : ''}>Feminino</Button>
          </div>
          <div className="flex bg-gray-700 rounded-lg p-1">
              <Button onClick={() => setViewMode('Gross')} variant={viewMode === 'Gross' ? 'primary' : 'secondary'} size="sm" className={viewMode !== 'Gross' ? 'bg-transparent' : ''}>Gross</Button>
              <Button onClick={() => setViewMode('Net')} variant={viewMode === 'Net' ? 'primary' : 'secondary'} size="sm" className={viewMode !== 'Net' ? 'bg-transparent' : ''}>Net</Button>
          </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">Pos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">Hole</th>
              {/* CABEÇALHO DA COLUNA DINÂMICO */}
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                {modality === 'Footgolf' ? 'Kicks' : 'Strokes'}
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">Par</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {sortedData.map((player) => (
              <tr key={player.id} onClick={() => setSelectedPlayer(player)} className="cursor-pointer hover:bg-gray-700">
                <td className="px-3 py-4 font-medium text-white">{player.rank}</td>
                <td className="px-6 py-4 font-medium text-white">{player.fullName}</td>
                <td className="px-3 py-4 text-center text-sm text-gray-300">{player.through}</td>
                <td className={`px-3 py-4 text-center text-lg font-bold text-white`}>
                  {player.grossTotal}
                </td>
                <td className={`px-3 py-4 text-center font-bold ${viewMode === 'Net' ? 'text-green-400' : 'text-blue-400'}`}>
                  {formatToPar(viewMode === 'Net' ? player.netToPar : player.toPar)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaderboardScreen;