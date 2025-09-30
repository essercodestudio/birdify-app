// screens/MainScreen.tsx - VERSÃO COMPLETA E CORRIGIDA

import React, { useState, useContext, useCallback, useEffect } from "react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import LeaderboardScreen from "./LeaderboardScreen";
import ScorecardScreen from "./ScorecardScreen";
import AdminDashboardScreen from "./AdminDashboardScreen";
import HandicapScreen from "./HandicapScreen";
import HistoryScreen from "./HistoryScreen";
import PlayerStatsScreen from "./PlayerStatsScreen";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import ProfileScreen from "./ProfileScreen";
import TrainingScreen from "./TrainingScreen";

type Screen =
  | "HOME"
  | "LEADERBOARD"
  | "SCORECARD"
  | "HANDICAP"
  | "SELECT_LEADERBOARD"
  | "HISTORY"
  | "STATS"
  | "PROFILE"
  | "ADMIN_DASHBOARD"
  | "TRAINING"
  | "HANDICAP_TRAINING"
  | "SCORECARD_TRAINING";

const MainScreen: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [screen, setScreen] = useState<Screen>('HOME');
    const [accessCode, setAccessCode] = useState(() => localStorage.getItem('activeAccessCode') || '');
    const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(() => localStorage.getItem('selectedTournamentId') || null);
    const [error, setError] = useState("");
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const activeScreen = localStorage.getItem('activeScreen') as Screen;
        if (activeScreen && activeScreen !== 'HOME') {
            setScreen(activeScreen);
        }
    }, []);

    useEffect(() => {
        if (screen !== 'HOME') {
            localStorage.setItem('activeScreen', screen);
            if (accessCode) localStorage.setItem('activeAccessCode', accessCode);
            if (selectedTournamentId) localStorage.setItem('selectedTournamentId', selectedTournamentId);
        } else {
            localStorage.removeItem('activeScreen');
            localStorage.removeItem('activeAccessCode');
            localStorage.removeItem('selectedTournamentId');
        }
    }, [screen, accessCode, selectedTournamentId]);

    const handleBackToHome = useCallback(() => {
        setScreen("HOME");
        setAccessCode("");
        setError("");
        setSelectedTournamentId(null);
    }, []);

    const handleSelectLeaderboard = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments`, {
                params: {
                    status: 'active',
                    modality: user.modality
                }
            });
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
            localStorage.setItem('activeAccessCode', accessCode);
            setScreen("HANDICAP");
        } else {
            setError("Por favor, insira um código de acesso válido.");
        }
    }, [accessCode]);

    const handleHandicapsSubmitted = useCallback(() => {
        setScreen("SCORECARD");
    }, []);

    const handleStartTrainingScoring = useCallback((code: string) => {
        setAccessCode(code);
        setScreen("HANDICAP_TRAINING");
    }, []);

    const handleTrainingHandicapsSubmitted = useCallback(() => {
        setScreen("SCORECARD_TRAINING");
    }, []);
    
    if (!user) return null;
    
    if (screen === "TRAINING") {
        return <TrainingScreen onBack={handleBackToHome} onStartScoring={handleStartTrainingScoring} />;
    }
    if (screen === "HANDICAP") {
        return (<HandicapScreen accessCode={accessCode} onHandicapsSubmitted={handleHandicapsSubmitted} user={user} type="tournament" />);
    }
    if (screen === "SCORECARD") {
        return (<ScorecardScreen accessCode={accessCode} onBack={handleBackToHome} type="tournament"/>);
    }
    if (screen === "HANDICAP_TRAINING") {
        return (<HandicapScreen accessCode={accessCode} onHandicapsSubmitted={handleTrainingHandicapsSubmitted} user={user} type="training" />);
    }
    if (screen === "SCORECARD_TRAINING") {
        return (<ScorecardScreen accessCode={accessCode} onBack={handleBackToHome} type="training"/>);
    }
    if (screen === "ADMIN_DASHBOARD") {
        return <AdminDashboardScreen onBack={handleBackToHome} />;
    }
    if (screen === "PROFILE") {
        return <ProfileScreen onBack={handleBackToHome} />;
    }
    if (screen === "STATS") {
        return <PlayerStatsScreen onBack={handleBackToHome} />;
    }
    if (screen === "HISTORY") {
        return <HistoryScreen user={user} onBack={handleBackToHome} />;
    }
    if (screen === "LEADERBOARD" && selectedTournamentId) {
        return <LeaderboardScreen tournamentId={selectedTournamentId} onBack={handleBackToHome} />;
    }
    if (screen === "SELECT_LEADERBOARD") {
        return (
            <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
                <h1 className="text-3xl font-bold text-white mb-4">Selecione um Torneio</h1>
                {loading ? (<Spinner />) : (
                    <div className="space-y-3">
                        {tournaments.length > 0 ? tournaments.map((t) => (
                            <Button key={t.id} onClick={() => handleTournamentSelected(t.id.toString())} className="w-full text-left justify-start">
                                {t.name} ({new Date(t.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })})
                            </Button>
                        )) : <p className="text-gray-400">Nenhum torneio ativo encontrado para a sua modalidade.</p>}
                    </div>
                )}
                <Button onClick={handleBackToHome} variant="secondary" className="mt-6">Voltar</Button>
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-center">
                <h1 className="text-3xl font-bold text-white">Bem-vindo, {user?.fullName}!</h1>
                <p className="text-gray-400 mt-2">Modalidade: <span className="font-bold text-green-400">{user.modality}</span></p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-green-400 mb-4">Marcar Pontuação (Torneio)</h2>
                    <p className="text-gray-300 mb-4">Insira o código de acesso para um torneio oficial.</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" placeholder="Código de Acesso" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())} className="flex-grow px-3 py-2 border border-gray-700 bg-gray-900 text-white rounded-md" />
                        <Button onClick={handleStartScoring} className="w-full sm:w-auto">Iniciar</Button>
                    </div>
                    {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
                </div>
                <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-green-400 mb-4">Treino</h2>
                    <p className="text-gray-300 mb-4">Crie, participe e registe as suas sessões de treino.</p>
                    <Button onClick={() => setScreen("TRAINING")} className="w-full sm:w-auto">
                        Aceder à Área de Treino
                    </Button>
                </div>
                <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-green-400 mb-4">Leaderboard de Torneios</h2>
                    <p className="text-gray-300 mb-4">Confira a classificação dos eventos oficiais.</p>
                    <Button onClick={handleSelectLeaderboard} className="w-full sm:w-auto">Ver Leaderboards</Button>
                </div>
                <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-green-400 mb-4">Meu Histórico</h2>
                    <p className="text-gray-300 mb-4">Veja os resultados dos seus torneios finalizados.</p>
                    <Button onClick={() => setScreen("HISTORY")} className="w-full sm:w-auto">Acessar Histórico</Button>
                </div>
                <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-green-400 mb-4">Minhas Estatísticas</h2>
                    <p className="text-gray-300 mb-4">Analise seu desempenho geral.</p>
                    <Button onClick={() => setScreen("STATS")} className="w-full sm:w-auto">Ver Estatísticas</Button>
                </div>
                {user?.role === "admin" && (
                    <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold text-green-400 mb-4">Painel do Administrador</h2>
                        <p className="text-gray-300 mb-4">Gerencie campos, torneios e grupos.</p>
                        <Button onClick={() => setScreen('ADMIN_DASHBOARD')}>Acessar Painel</Button>
                    </div>
                )}
                <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-green-400 mb-4">Meu Perfil</h2>
                    <p className="text-gray-300 mb-4">Edite as suas informações ou gira a sua conta.</p>
                    <Button onClick={() => setScreen("PROFILE")} className="w-full sm:w-auto">Aceder ao Perfil</Button>
                </div>
            </div>
        </div>
    );
};

export default MainScreen;