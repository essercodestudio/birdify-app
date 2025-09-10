// screens/MainScreen.tsx - VERSÃO COM BOTÃO DE ESTATÍSTICAS

import React, { useState, useContext, useCallback } from "react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import LeaderboardScreen from "./LeaderboardScreen";
import ScorecardScreen from "./ScorecardScreen";
import AdminDashboardScreen from "./AdminDashboardScreen";
import HandicapScreen from "./HandicapScreen";
import HistoryScreen from "./HistoryScreen";
import PlayerStatsScreen from "./PlayerStatsScreen"; // 1. Importa a nova tela
import Button from "../components/Button";
import Spinner from "../components/Spinner";

// 2. Adiciona 'STATS' como uma tela válida
type Screen =
  | "HOME"
  | "LEADERBOARD"
  | "SCORECARD"
  | "ADMIN_DASHBOARD"
  | "HANDICAP"
  | "SELECT_LEADERBOARD"
  | "HISTORY"
  | "STATS";

const MainScreen: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [screen, setScreen] = useState<Screen>("HOME");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);

  // screens/MainScreen.tsx -> Função handleSelectLeaderboard ATUALIZADA

  const handleSelectLeaderboard = async () => {
    setLoading(true);
    try {
      // Adiciona o parâmetro '?status=active' para buscar apenas torneios "ao vivo"
      const response = await axios.get(
        "http://localhost:3001/api/tournaments?status=active"
      );
      setTournaments(response.data);
      setScreen("SELECT_LEADERBOARD");
    } catch (err) {
      setError("Não foi possível carregar a lista de torneios.");
    } finally {
      setLoading(false);
    }
  };
  const handleTournamentSelected = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    setScreen("LEADERBOARD");
  };
  const handleStartScoring = useCallback(() => {
    if (accessCode.trim()) {
      setError("");
      setScreen("HANDICAP");
    } else {
      setError("Por favor, insira um código de acesso válido.");
    }
  }, [accessCode]);
  const handleBackToHome = useCallback(() => {
    setScreen("HOME");
    setAccessCode("");
    setError("");
    setSelectedTournamentId(null);
  }, []);
  const handleHandicapsSubmitted = useCallback(() => {
    setScreen("SCORECARD");
  }, []);

  // 3. Lógica de renderização atualizada
  if (!user) return null;

  if (screen === "STATS") {
    return <PlayerStatsScreen onBack={handleBackToHome} />;
  }
  if (screen === "HISTORY") {
    return <HistoryScreen user={user} onBack={handleBackToHome} />;
  }
  if (screen === "LEADERBOARD" && selectedTournamentId) {
    return (
      <LeaderboardScreen
        tournamentId={selectedTournamentId}
        onBack={handleBackToHome}
      />
    );
  }
  if (screen === "SELECT_LEADERBOARD") {
    return (
      <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-white mb-4">
          Selecione um Torneio
        </h1>
        {loading ? (
          <Spinner />
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <Button
                key={t.id}
                onClick={() => handleTournamentSelected(t.id.toString())}
                className="w-full text-left justify-start"
              >
                {t.name} (
                {new Date(t.date).toLocaleDateString("pt-BR", {
                  timeZone: "UTC",
                })}
                )
              </Button>
            ))}
          </div>
        )}
        <Button onClick={handleBackToHome} variant="secondary" className="mt-6">
          Voltar
        </Button>
      </div>
    );
  }
  if (screen === "HANDICAP" && accessCode) {
    return (
      <HandicapScreen
        accessCode={accessCode}
        onHandicapsSubmitted={handleHandicapsSubmitted}
      />
    );
  }
  if (screen === "SCORECARD" && accessCode) {
    return (
      <ScorecardScreen accessCode={accessCode} onBack={handleBackToHome} />
    );
  }
  if (screen === "ADMIN_DASHBOARD") {
    return <AdminDashboardScreen onBack={handleBackToHome} />;
  }

  // 4. Grid de botões atualizado
  return (
    <div className="space-y-8">
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-white">
          Bem-vindo, {user?.fullName}!
        </h1>
        <p className="text-gray-400 mt-2">O que você gostaria de fazer hoje?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-green-400 mb-4">
            Marcar Pontuação
          </h2>
          <p className="text-gray-300 mb-4">
            Insira o código de acesso para começar a marcar.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Código de Acesso"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              className="flex-grow px-3 py-2 border border-gray-700 bg-gray-900 text-white rounded-md"
            />
            <Button onClick={handleStartScoring} className="w-full sm:w-auto">
              Iniciar
            </Button>
          </div>
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
        </div>

        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-green-400 mb-4">
            Ver Leaderboard
          </h2>
          <p className="text-gray-300 mb-4">
            Confira a classificação dos torneios.
          </p>
          <Button
            onClick={handleSelectLeaderboard}
            className="w-full sm:w-auto"
          >
            Ver Leaderboards
          </Button>
        </div>

        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-green-400 mb-4">
            Meu Histórico
          </h2>
          <p className="text-gray-300 mb-4">
            Veja os resultados dos seus torneios finalizados.
          </p>
          <Button
            onClick={() => setScreen("HISTORY")}
            className="w-full sm:w-auto"
          >
            Acessar Histórico
          </Button>
        </div>

        {/* NOVO BOTÃO DE ESTATÍSTICAS */}
        <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-green-400 mb-4">
            Minhas Estatísticas
          </h2>
          <p className="text-gray-300 mb-4">
            Analise seu desempenho geral no golfe.
          </p>
          <Button
            onClick={() => setScreen("STATS")}
            className="w-full sm:w-auto"
          >
            Ver Estatísticas
          </Button>
        </div>

        {user?.role === "admin" && (
          <div className="p-6 bg-gray-800 rounded-lg shadow-lg md:col-span-3 lg:col-span-2">
            <h2 className="text-2xl font-bold text-green-400 mb-4">
              Painel do Administrador
            </h2>
            <p className="text-gray-300 mb-4">
              Gerencie campos, torneios e grupos.
            </p>
            <Button onClick={() => setScreen("ADMIN_DASHBOARD")}>
              Acessar Painel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainScreen;
