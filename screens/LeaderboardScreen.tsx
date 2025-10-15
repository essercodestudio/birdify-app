import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
// CAMINHO CORRIGIDO ABAIXO
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';

interface LeaderboardScreenProps {
  tournamentId: string;
  onBack: () => void;
}

interface PlayerScore {
  playerId: number;
  fullName:string;
  totalStrokes: number;
  courseHandicap: number;
  netScore: number;
  categoryName: string;
  tieBreakScores: {
    last9: number;
    last6: number;
    last3: number;
    last1: number;
  };
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ tournamentId, onBack }) => {
  const [leaderboard, setLeaderboard] = useState<PlayerScore[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/leaderboard`);
      setLeaderboard(response.data.leaderboard);
      setTournamentName(response.data.tournamentName);
    } catch (err) {
      setError('Não foi possível carregar o leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleExport = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/export/scorecard/tournament/${tournamentId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_completo_${tournamentName.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Erro ao exportar o relatório.');
      console.error(error);
    }
  };

  if (loading) return <div className="card"><Spinner /></div>;
  if (error) return <div className="card text-red-400 text-center">{error}</div>;

  return (
    <div className="card space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center">
              <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                  <ChevronLeftIcon className="h-6 w-6" />
              </Button>
              <div>
                  <h1 className="text-3xl font-bold text-white">{tournamentName}</h1>
                  <p className="text-gray-400">Leaderboard Geral (NET)</p>
              </div>
          </div>
          <Button onClick={handleExport}>Exportar Relatório Detalhado</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Pos</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Jogador</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Categoria</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Gross</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">HCP</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Net</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-600">
            {leaderboard.map((player, index) => (
              <tr key={player.playerId}>
                <td className="px-4 py-3 text-center font-bold text-white">{index + 1}</td>
                <td className="px-4 py-3 text-left font-medium text-white">{player.fullName}</td>
                <td className="px-4 py-3 text-center text-gray-300">{player.categoryName || '-'}</td>
                <td className="px-4 py-3 text-center text-gray-300">{player.totalStrokes}</td>
                <td className="px-4 py-3 text-center text-gray-300">{player.courseHandicap}</td>
                <td className="px-4 py-3 text-center font-bold text-green-400 text-lg">{player.netScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaderboardScreen;