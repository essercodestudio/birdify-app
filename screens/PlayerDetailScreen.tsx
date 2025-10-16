// essercodestudio/birdify-app/birdify-app-292f4c7e273124d606a73f19222b8d25fd42d22f/screens/PlayerDetailScreen.tsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import Spinner from '../components/Spinner';
import { LeaderboardPlayer } from '../types';

interface ScoreDetail {
  holeNumber: number;
  strokes: number | null;
  par: number;
  yardage: number | null;
}

const getScoreStyle = (strokes: number | null, par: number) => {
  if (strokes === null || strokes === 0) return "bg-gray-600";
  const diff = strokes - par;
  if (diff <= -2) return "bg-yellow-500 text-black";
  if (diff === -1) return "bg-green-500";
  if (diff === 0) return "bg-gray-700";
  if (diff === 1) return "bg-red-500";
  return "bg-red-800";
};

const PlayerDetailScreen: React.FC = () => {
  const navigate = useNavigate();
  const { tournamentId, playerId } = useParams<{ tournamentId: string; playerId: string }>();
  const location = useLocation();
  const { player: initialPlayer } = location.state || {};

  const [playerDetails, setPlayerDetails] = useState<ScoreDetail[]>([]);
  const [allPlayers, setAllPlayers] = useState<LeaderboardPlayer[]>([]);
  const [comparedPlayerId, setComparedPlayerId] = useState<string>('');
  const [comparedPlayerDetails, setComparedPlayerDetails] = useState<ScoreDetail[] | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!playerId || !tournamentId) return;
      try {
        setLoading(true);
        const [detailsRes, allPlayersRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/history/player/${playerId}/tournament/${tournamentId}`),
          axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/leaderboard`)
        ]);
        setPlayerDetails(detailsRes.data);
        // Filtra o próprio jogador da lista de comparação
        setAllPlayers(allPlayersRes.data.leaderboard.filter((p: LeaderboardPlayer) => p.playerId.toString() !== playerId));
      } catch (error) {
        console.error("Erro ao buscar detalhes do jogador:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [playerId, tournamentId]);

  useEffect(() => {
    const fetchComparedData = async () => {
      if (!comparedPlayerId || !tournamentId) {
        setComparedPlayerDetails(null);
        return;
      }
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/history/player/${comparedPlayerId}/tournament/${tournamentId}`);
        setComparedPlayerDetails(response.data);
      } catch (error) {
        console.error("Erro ao buscar dados de comparação:", error);
      }
    };
    fetchComparedData();
  }, [comparedPlayerId, tournamentId]);

  if (loading) return <div className="card"><Spinner /></div>;

  const getScoreForHole = (details: ScoreDetail[] | null, holeNumber: number) => details?.find(d => d.holeNumber === holeNumber)?.strokes || null;
  const getComparedPlayerName = () => allPlayers.find(p => p.playerId.toString() === comparedPlayerId)?.fullName || 'Oponente';

  return (
    <div className="card space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
            <Button onClick={() => navigate(-1)} variant="secondary" size="icon" className="mr-4">
                <ChevronLeftIcon className="h-6 w-6" />
            </Button>
            <div>
                <h1 className="text-3xl font-bold text-white">{initialPlayer?.fullName}</h1>
                <p className="text-gray-400">Resultados Detalhados</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <label htmlFor="compare-select" className="text-sm text-gray-300">Comparar com:</label>
            <select
                id="compare-select"
                value={comparedPlayerId}
                onChange={(e) => setComparedPlayerId(e.target.value)}
                className="input"
            >
                <option value="">-- Ninguém --</option>
                {allPlayers.map((p) => (
                    <option key={p.playerId} value={p.playerId}>{p.fullName}</option>
                ))}
            </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
                <tr>
                    <th className="px-3 py-2 text-center text-xs font-medium uppercase">BURACO</th>
                    <th className="px-3 py-2 text-center text-xs font-medium uppercase">COMPRIMENTO</th>
                    <th className="px-3 py-2 text-center text-xs font-medium uppercase">PAR</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-green-300 uppercase">{initialPlayer?.fullName.split(' ')[0]}</th>
                    {comparedPlayerId && <th className="px-3 py-2 text-center text-xs font-medium text-blue-300 uppercase">{getComparedPlayerName().split(' ')[0]}</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
                {playerDetails.map(detail => (
                    <tr key={detail.holeNumber} className="text-center">
                        <td className="px-3 py-4 font-bold">{detail.holeNumber}</td>
                        <td className="px-3 py-4 text-gray-300">{detail.yardage ? `${detail.yardage}j` : '-'}</td>
                        <td className="px-3 py-4">{detail.par}</td>
                        <td className="px-3 py-4">
                            <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-bold ${getScoreStyle(detail.strokes, detail.par)}`}>
                                {detail.strokes || '-'}
                            </span>
                        </td>
                        {comparedPlayerId && (
                             <td className="px-3 py-4">
                                <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-bold ${getScoreStyle(getScoreForHole(comparedPlayerDetails, detail.holeNumber), detail.par)}`}>
                                    {getScoreForHole(comparedPlayerDetails, detail.holeNumber) || '-'}
                                </span>
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerDetailScreen;