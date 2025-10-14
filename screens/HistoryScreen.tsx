// essercodestudio/birdify-app/birdify-app-5edd58081f645dcc34f897e15210f0f29db5dc87/screens/HistoryScreen.tsx

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import LeaderboardScreen from './LeaderboardScreen';
import TrainingCardScreen from './TrainingCardScreen';

interface HistoryItem {
    id: number;
    name: string;
    date: string;
    courseName: string;
    type: 'tournament' | 'training';
    groupId: number; 
}

const HistoryScreen: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { user } = useContext(AuthContext);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'LIST' | 'TOURNAMENT_DETAILS' | 'TRAINING_DETAILS'>('LIST');
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

    useEffect(() => {
        if (!user) return;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/history/player/${user.id}`);
                setHistory(response.data);
            } catch (error) {
                console.error("Erro ao buscar histórico unificado:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [user]);

    const handleViewDetails = (item: HistoryItem) => {
        setSelectedItem(item);
        setView(item.type === 'tournament' ? 'TOURNAMENT_DETAILS' : 'TRAINING_DETAILS');
    };

    const handleBackToList = () => {
        setSelectedItem(null);
        setView('LIST');
    };
    
    // ... (funções de exportação aqui)

    if (loading) return <div className="card"><Spinner /></div>;

    if (view === 'TOURNAMENT_DETAILS' && selectedItem) {
        return <LeaderboardScreen tournamentId={selectedItem.id.toString()} onBack={handleBackToList} />;
    }
    
    if (view === 'TRAINING_DETAILS' && selectedItem) {
        // O trainingGroupId é o groupId no nosso histórico unificado
        const trainingData = { trainingGroupId: selectedItem.groupId, courseName: selectedItem.courseName, finishedAt: selectedItem.date };
        return <TrainingCardScreen training={trainingData} onBack={handleBackToList} />;
    }

    return (
        <div className="card space-y-6">
            <div className="flex items-center">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                    <ChevronLeftIcon className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-white">Meu Histórico</h1>
                    <p className="text-slate-400">Resultados de todos os seus eventos finalizados.</p>
                </div>
            </div>

            <div className="space-y-4">
                {history.length > 0 ? history.map(item => (
                    <div key={`${item.type}-${item.id}`} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                            <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${item.type === 'tournament' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'}`}>
                                {item.type === 'tournament' ? 'Torneio' : 'Treino'}
                            </span>
                            <p className="font-bold text-white mt-2">{item.name}</p>
                            <p className="text-sm text-slate-400">
                                {item.courseName} - {new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </p>
                        </div>
                        <div className="flex gap-2">
                           <Button size="sm" onClick={() => handleViewDetails(item)}>
                                Ver Detalhes
                           </Button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10 bg-slate-900/50 rounded-lg">
                        <p className="text-slate-400">Você não tem eventos finalizados no seu histórico.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryScreen;