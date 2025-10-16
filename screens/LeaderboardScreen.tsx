// essercodestudio/birdify-app/birdify-app-292f4c7e273124d606a73f19222b8d25fd42d22f/screens/LeaderboardScreen.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import { LeaderboardPlayer } from '../types';

type Category = 'Male' | 'Female';
type ViewMode = 'Gross' | 'Net';

interface LeaderboardScreenProps {
  tournamentId: string;
  onBack: () => void;
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ tournamentId, onBack }) => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [category, setCategory] = useState<Category>('Male');
  const [viewMode, setViewMode] = useState<ViewMode>('Net');

  const fetchLeaderboard = useCallback(async () => {
    try {
      if (players.length === 0) setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/leaderboard`);
      setPlayers(response.data.leaderboard);
      setTournamentName(response.data.tournamentName || 'Classificação');
    } catch (err) {
      setError('Não foi possível carregar o leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, players.length]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const sortedData = useMemo(() => {
    return players
      .filter(p => p.gender === category)
      .sort((a, b) => {
        const scoreA = viewMode === 'Net' ? a.netToPar : a.toParGross;
        const scoreB = viewMode === 'Net' ? b.netToPar : b.toParGross;
        return (scoreA ?? 999) - (scoreB ?? 999);
      });
  }, [players, category, viewMode]);

  const handlePlayerClick = (player: LeaderboardPlayer) => {
    navigate(`/leaderboard/${tournamentId}/player/${player.playerId}`, { state: { player } });
  };

  const handleExport = async () => {
    // A funcionalidade de exportação já foi corrigida no backend
    // para gerar o formato horizontal.
    try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/export/scorecard/tournament/${tournamentId}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_completo_${tournamentName.replace(/\s+/g, '_')}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        alert('Relatório exportado com sucesso!');
    } catch (error) {
        alert('Erro ao exportar o relatório.');
    }
  };
  
  const formatToPar = (score: number) => {
    if (score === null || score === undefined) return '-';
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : score;
  };

  if (loading) return <div className="card"><Spinner /></div>;
  if (error) return <div className="card text-red-400 text-center">{error}</div>;

  return (
    <div className="card space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={onBack} variant="secondary" size="icon" className="mr-4"><ChevronLeftIcon className="h-6 w-6" /></Button>
        <h1 className="text-3xl font-bold text-white">Classificação</h1>
        <Button onClick={handleExport}>Exportar Relatório Detalhado</Button>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
            <Button variant={category === 'Male' ? 'primary' : 'secondary'} onClick={() => setCategory('Male')}>Masculino</Button>
            <Button variant={category === 'Female' ? 'primary' : 'secondary'} onClick={() => setCategory('Female')}>Feminino</Button>
        </div>
        <div className="flex space-x-2">
            <Button variant={viewMode === 'Gross' ? 'primary' : 'secondary'} onClick={() => setViewMode('Gross')}>Gross</Button>
            <Button variant={viewMode === 'Net' ? 'primary' : 'secondary'} onClick={() => setViewMode('Net')}>Net</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">POS</th>
              <th className="px-4 py-2 text-left">NOME</th>
              <th className="px-4 py-2 text-center">BURACO</th>
              <th className="px-4 py-2 text-center">GOLPES</th>
              <th className="px-4 py-2 text-center">PAR</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-600">
            {sortedData.map((player, index) => (
              <tr key={player.playerId} onClick={() => handlePlayerClick(player)} className="cursor-pointer hover:bg-gray-700">
                <td className="px-4 py-3 font-bold">{index + 1}</td>
                <td className="px-4 py-3 font-medium">{player.fullName}</td>
                <td className="px-4 py-3 text-center">{player.through}</td>
                <td className="px-4 py-3 text-center font-bold">{player.totalStrokes}</td>
                <td className="px-4 py-3 text-center font-bold text-blue-400">
                    {formatToPar(viewMode === 'Net' ? player.netToPar : player.toParGross)}
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