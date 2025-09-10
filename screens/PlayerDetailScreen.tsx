// screens/PlayerDetailScreen.tsx - VERSÃO COM A URL DA API CORRIGIDA

import React, { useState, useEffect } from "react";
import axios from "axios";
import Spinner from "../components/Spinner";
import Button from "../components/Button";
import ChevronLeftIcon from "../components/icons/ChevronLeftIcon";

// Interfaces para os dados
interface PlayerDetailProps {
  player: any;
  tournamentId: string;
  onBack: () => void;
}

interface ScoreDetail {
  holeNumber: number;
  strokes: number;
  par: number;
  yardage: number | null;
}

interface TournamentPlayer {
  id: string;
  fullName: string;
}

// Função para estilo do score (sem alterações)
const getScoreStyle = (strokes: number, par: number) => {
  if (!strokes) return "bg-gray-600 text-gray-300 border-gray-500";
  const diff = strokes - par;
  if (diff <= -2) return "bg-yellow-500 text-black border-yellow-400";
  if (diff === -1) return "bg-green-500/20 text-green-300 border-green-500";
  if (diff === 0) return "bg-gray-700 text-white border-gray-600";
  if (diff === 1) return "bg-red-500/20 text-red-300 border-red-500";
  return "bg-red-800/20 text-red-400 border-red-800";
};

const PlayerDetailScreen: React.FC<PlayerDetailProps> = ({
  player,
  tournamentId,
  onBack,
}) => {
  const [details, setDetails] = useState<ScoreDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Novos estados para a funcionalidade de comparação
  const [tournamentPlayers, setTournamentPlayers] = useState<
    TournamentPlayer[]
  >([]);
  const [comparedPlayerId, setComparedPlayerId] = useState<string>("");
  const [comparedPlayerDetails, setComparedPlayerDetails] = useState<
    ScoreDetail[] | null
  >(null);
  const [isComparisonLoading, setIsComparisonLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Busca os detalhes do jogador principal e a lista de todos os jogadores do torneio em paralelo
        const [detailsRes, playersRes] = await Promise.all([
          axios.get(
            `${import.meta.env.VITE_API_URL}/api/history/player/${player.id}/tournament/${tournamentId}`
          ),
          axios.get(`${import.meta.env.VITE_API_URL}/api/leaderboard/${tournamentId}`),
        ]);
        setDetails(detailsRes.data);
        // Filtra o próprio jogador da lista de comparação
        setTournamentPlayers(
          playersRes.data.filter((p: any) => p.id !== player.id)
        );
      } catch (error) {
        console.error("Erro ao buscar detalhes iniciais", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [player.id, tournamentId]);

  // Efeito para buscar os dados do jogador comparado quando ele for selecionado
  useEffect(() => {
    const fetchComparedData = async () => {
      if (!comparedPlayerId) {
        setComparedPlayerDetails(null);
        return;
      }
      try {
        setIsComparisonLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/history/player/${comparedPlayerId}/tournament/${tournamentId}`
        );
        setComparedPlayerDetails(response.data);
      } catch (error) {
        console.error("Erro ao buscar dados do jogador comparado", error);
      } finally {
        setIsComparisonLoading(false);
      }
    };
    fetchComparedData();
  }, [comparedPlayerId, tournamentId]);

  if (loading) return <Spinner />;

  const getScoreForHole = (
    scoreDetails: ScoreDetail[] | null,
    holeNumber: number
  ) => {
    return scoreDetails?.find((d) => d.holeNumber === holeNumber);
  };

  const comparedPlayerName =
    tournamentPlayers.find((p) => p.id === comparedPlayerId)?.fullName ||
    "Oponente";

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center">
          <Button
            onClick={onBack}
            variant="secondary"
            size="icon"
            className="mr-4"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">{player.fullName}</h1>
            <p className="text-gray-400">Resultados Detalhados</p>
          </div>
        </div>
        {/* Nova UI para seleção de comparação */}
        <div className="flex items-center gap-2">
          <label htmlFor="compare-select" className="text-sm text-gray-300">
            Comparar com:
          </label>
          <select
            id="compare-select"
            value={comparedPlayerId}
            onChange={(e) => setComparedPlayerId(e.target.value)}
            className="px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
          >
            <option value="">-- Ninguém --</option>
            {tournamentPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                Hole
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                Length
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                Par
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-green-300 uppercase">
                {player.fullName.split(" ")[0]}
              </th>
              {comparedPlayerDetails && (
                <th className="px-3 py-3 text-center text-xs font-medium text-blue-300 uppercase">
                  {comparedPlayerName.split(" ")[0]}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {details.map((detail) => {
              const ownScore = detail.strokes;
              const ownStyle = getScoreStyle(ownScore, detail.par);

              const opponentData = getScoreForHole(
                comparedPlayerDetails,
                detail.holeNumber
              );
              const opponentScore = opponentData?.strokes;
              const opponentStyle = getScoreStyle(opponentScore!, detail.par);

              return (
                <tr key={detail.holeNumber} className="text-center">
                  <td className="px-3 py-4 font-bold">{detail.holeNumber}</td>
                  <td className="px-3 py-4 text-gray-300">
                    {detail.yardage ? `${detail.yardage}j` : "-"}
                  </td>
                  <td className="px-3 py-4">{detail.par}</td>
                  <td className="px-3 py-4">
                    <span
                      className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-bold ${ownStyle}`}
                    >
                      {ownScore || "-"}
                    </span>
                  </td>
                  {comparedPlayerDetails && (
                    <td className="px-3 py-4">
                      {isComparisonLoading ? (
                        "..."
                      ) : (
                        <span
                          className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-bold ${opponentStyle}`}
                        >
                          {opponentScore || "-"}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerDetailScreen;