// screens/HistoryScreen.tsx - VERSÃO CORRIGIDA E FINAL

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import { User } from '../types';
import LeaderboardScreen from './LeaderboardScreen'; // Importamos o LeaderboardScreen

interface HistoryScreenProps {
  user: User;
  onBack: () => void;
}

interface TournamentHistory {
    id: number;
    name: string;
    date: string;
    courseName: string;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ user, onBack }) => {
    const [history, setHistory] = useState<TournamentHistory[]>([]);
    const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/api/history/player/${user.id}`);
                setHistory(response.data);
            } catch (error) {
                console.error("Erro ao buscar histórico", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [user.id]);

    if (loading) return <Spinner />;
    
    // Se um torneio for selecionado, mostra o Leaderboard final dele
    if (selectedTournamentId) {
        // Passamos 'onBack' para a função que limpa a seleção, voltando à lista
        return <LeaderboardScreen tournamentId={selectedTournamentId} onBack={() => setSelectedTournamentId(null)} />;
    }

    // Caso contrário, mostra a lista de torneios finalizados que o jogador participou
    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            <div className="flex items-center mb-6">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                    <ChevronLeftIcon className="h-6 w-6" />
                </Button>
                <h1 className="text-3xl font-bold text-white">Meu Histórico de Torneios</h1>
            </div>
            <div className="space-y-3">
                {history.length > 0 ? history.map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setSelectedTournamentId(t.id.toString())} 
                        className="w-full text-left p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        <p className="font-bold text-white">{t.name}</p>
                        <p className="text-sm text-gray-400">{t.courseName} - {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                    </button>
                )) : (
                    <p className="text-gray-400">Você ainda não tem torneios finalizados no seu histórico.</p>
                )}
            </div>
        </div>
    );
};

export default HistoryScreen;