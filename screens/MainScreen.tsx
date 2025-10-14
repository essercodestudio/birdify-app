// essercodestudio/birdify-app/birdify-app-5edd58081f645dcc34f897e15210f0f29db5dc87/screens/MainScreen.tsx
// VERSÃO FINAL COM BORDAS DE MAIOR DESTAQUE E CORREÇÃO DO INPUT

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
import TrainingHistoryScreen from "./TrainingHistoryScreen";

// Ícones para a UI
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import UserIcon from '../components/icons/UserIcon';
// Placeholders para ícones adicionais.
const ChartBarIcon = (props: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
const CalendarIcon = (props: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18" /></svg>;
const CogIcon = (props: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.47.234.925.539 1.35.907l.637-.478c.48-.36.926.24 1.28.69l.06.089c.353.45.24 1.04-.24 1.4l-.637.478c.05.163.09.333.12.502l.91.15c.542.09.94.56.94 1.11v1.093c0 .55-.398 1.02-.94 1.11l-.91.152a5.95 5.95 0 01-.12.502l.637.478c.48.36.69.95-.336 1.4l-.06.089a.996.996 0 01-1.28.69l-.637-.478a5.95 5.95 0 01-1.35-.907l-.149.894c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894a5.95 5.95 0 01-1.35-.907l-.637.478c-.48-.36-.926-.24-1.28-.69l-.06-.089a.996.996 0 01.336-1.4l.637-.478a5.95 5.95 0 01.12-.502l-.91-.15a1.125 1.125 0 01-.94-1.11v-1.093c0-.55.398-1.02.94-1.11l.91-.152a5.95 5.95 0 01-.12-.502l-.637-.478c-.48-.36-.69-.95-.336-1.4l.06-.089a.996.996 0 011.28-.69l.637.478c.425-.368.88-.673 1.35-.907l.149-.894zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" /></svg>;
const ClipboardListIcon = (props: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const TrophyIcon = (props: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9a9.75 9.75 0 011.036-4.873.75.75 0 01.3-1.125 1 1 0 011.125.3 9.75 9.75 0 011.036 4.873H15.5m0-13.5h.75a.75.75 0 01.75.75v3.75a.75.75 0 01-.75.75H8.25a.75.75 0 01-.75-.75V6a.75.75 0 01.75-.75h.75m6.75 0a2.25 2.25 0 00-2.25-2.25H12a2.25 2.25 0 00-2.25 2.25m6.75 0H9.75" /></svg>;

type Screen = "HOME" | "LEADERBOARD" | "SCORECARD" | "HANDICAP" | "SELECT_LEADERBOARD" | "HISTORY" | "STATS" | "PROFILE" | "ADMIN_DASHBOARD" | "TRAINING" | "TRAINING_HISTORY" | "HANDICAP_TRAINING" | "SCORECARD_TRAINING";

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
    
    const handleFinishTrainingAndGoToHistory = useCallback(() => {
        setScreen("TRAINING_HISTORY");
    }, []);

    const handleSelectLeaderboard = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments`, {
                params: { adminId: user.id, status: 'active' }
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
        localStorage.setItem('activeAccessCode', code);
        setScreen("HANDICAP_TRAINING");
    }, []);

    const handleTrainingHandicapsSubmitted = useCallback(() => {
        setScreen("SCORECARD_TRAINING");
    }, []);

    if (!user) return null;

    // Lógica de renderização para outras telas
    if (screen !== 'HOME') {
        switch (screen) {
            case "TRAINING": return <TrainingScreen onBack={handleBackToHome} onStartScoring={handleStartTrainingScoring} />;
            case "HANDICAP": return <HandicapScreen accessCode={accessCode} onHandicapsSubmitted={handleHandicapsSubmitted} user={user} type="tournament" />;
            case "SCORECARD": return <ScorecardScreen accessCode={accessCode} onBack={handleBackToHome} type="tournament"/>;
            case "HANDICAP_TRAINING": return <HandicapScreen accessCode={accessCode} onHandicapsSubmitted={handleTrainingHandicapsSubmitted} user={user} type="training" />;
            case "SCORECARD_TRAINING": return <ScorecardScreen accessCode={accessCode} onBack={handleBackToHome} type="training" onFinishTraining={handleFinishTrainingAndGoToHistory} />;
            case "ADMIN_DASHBOARD": return <AdminDashboardScreen onBack={handleBackToHome} />;
            case "PROFILE": return <ProfileScreen onBack={handleBackToHome} />;
            case "STATS": return <PlayerStatsScreen onBack={handleBackToHome} />;
            case "HISTORY": return <HistoryScreen onBack={handleBackToHome} />;
            case "TRAINING_HISTORY": return <TrainingHistoryScreen onBack={handleBackToHome} />;
            case "LEADERBOARD":
                if (selectedTournamentId) {
                    return <LeaderboardScreen tournamentId={selectedTournamentId} onBack={handleBackToHome} />;
                }
                // Fallback para evitar erro se não houver ID selecionado
                setScreen('HOME');
                return null;
            case "SELECT_LEADERBOARD":
                return (
                    <div className="card">
                        <h1 className="text-3xl font-bold text-white mb-4">Selecione um Torneio</h1>
                        {loading ? <Spinner /> : (
                            <div className="space-y-3">
                                {tournaments.length > 0 ? tournaments.map((t) => (
                                    <Button key={t.id} onClick={() => handleTournamentSelected(t.id.toString())} className="w-full text-left justify-start">
                                        {t.name} ({new Date(t.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })})
                                    </Button>
                                )) : <p className="text-gray-400">Nenhum torneio de Golf ativo encontrado.</p>}
                            </div>
                        )}
                        <Button onClick={handleBackToHome} variant="secondary" className="mt-6">Voltar</Button>
                    </div>
                );
            default:
                setScreen('HOME');
                return null;
        }
    }
    
    // Componente interno para os cards de navegação
    const NavCard: React.FC<{ title: string; description: string; onClick: () => void; icon: React.ReactNode; }> = ({ title, description, onClick, icon }) => (
        <button 
            onClick={onClick} 
            className="card text-left w-full h-full flex flex-col justify-between hover:bg-gray-700/50 transition-all duration-300 border-2 border-green-500/30 hover:border-green-500 hover:shadow-2xl hover:shadow-green-500/10 group"
        >
            <div>
                <div className="flex items-center gap-4">
                    <div className="bg-gray-900 p-3 rounded-lg group-hover:bg-green-500/10 transition-colors">
                        {icon}
                    </div>
                    <h2 className="text-xl font-bold text-white transition-colors">{title}</h2>
                </div>
                <p className="text-gray-400 mt-2 text-sm">{description}</p>
            </div>
            <div className="text-right mt-4 self-end">
                <ChevronRightIcon className="h-6 w-6 text-gray-600 group-hover:text-green-400 transition-colors" />
            </div>
        </button>
    );
    
    return (
        <div className="space-y-12">
            <div className="p-8 bg-gray-800 rounded-xl shadow-lg text-center border border-gray-700">
                <h1 className="text-4xl font-extrabold text-white tracking-tight">Bem-vindo, {user?.fullName.split(' ')[0]}!</h1>
                <p className="text-gray-300 mt-2 text-lg">Pronto para jogar Golf?</p>
            </div>

            <div className="card">
                <h2 className="text-2xl font-bold text-green-400 mb-4">Marcar Pontuação (Torneio)</h2>
                <p className="text-gray-300 mb-4">Insira o código de acesso fornecido pelo organizador para iniciar a marcação.</p>
                <div className="flex flex-col sm:flex-row gap-2 max-w-sm">
                    <input 
                        type="text" 
                        placeholder="Código de Acesso" 
                        value={accessCode} 
                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())} 
                        className="input flex-grow" // Aplica a classe .input global
                    />
                    <Button onClick={handleStartScoring} className="w-full sm:w-auto">Iniciar Marcação</Button>
                </div>
                {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <NavCard title="Área de Treino" description="Crie, participe e registe as suas sessões de treino." onClick={() => setScreen("TRAINING")} icon={<ClipboardListIcon className="h-8 w-8 text-green-400"/>} />
                <NavCard title="Leaderboards" description="Confira a classificação dos torneios oficiais em tempo real." onClick={handleSelectLeaderboard} icon={<TrophyIcon className="h-8 w-8 text-green-400"/>} />
                <NavCard title="Meu Histórico" description="Consulte os resultados dos seus torneios e treinos finalizados." onClick={() => setScreen("HISTORY")} icon={<CalendarIcon className="h-8 w-8 text-green-400"/>} />
                <NavCard title="Minhas Estatísticas" description="Analise seu desempenho, médias de scores e evolução no jogo." onClick={() => setScreen("STATS")} icon={<ChartBarIcon className="h-8 w-8 text-green-400"/>} />
                <NavCard title="Meu Perfil" description="Edite as suas informações pessoais ou gira a sua conta." onClick={() => setScreen("PROFILE")} icon={<UserIcon className="h-8 w-8 text-green-400"/>} />
                
                {user?.role === "admin" && (
                    <NavCard title="Painel Admin" description="Gerencie campos, torneios, grupos e inscrições." onClick={() => setScreen('ADMIN_DASHBOARD')} icon={<CogIcon className="h-8 w-8 text-green-400"/>} />
                )}
            </div>
        </div>
    );
};

export default MainScreen;