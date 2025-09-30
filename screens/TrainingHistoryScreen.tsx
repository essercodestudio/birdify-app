// screens/TrainingHistoryScreen.tsx - NOVO FICHEIRO

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
// Futuramente, importaremos a tela do cartão de treino aqui

interface TrainingHistoryScreenProps {
  onBack: () => void;
  // onSelectTraining: (training: any) => void; // Para ver o cartão detalhado
}

const TrainingHistoryScreen: React.FC<TrainingHistoryScreenProps> = ({ onBack }) => {
    const { user } = useContext(AuthContext);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/trainings/history/player/${user.id}`);
                setHistory(response.data);
            } catch (error) {
                console.error("Erro ao buscar histórico de treinos", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [user]);

    if (loading) return <Spinner />;

    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            <div className="flex items-center mb-6">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                    <ChevronLeftIcon className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-white">Histórico de Treinos</h1>
                    <p className="text-gray-400">Veja os seus treinos finalizados.</p>
                </div>
            </div>
            <div className="space-y-3">
                {history.length > 0 ? history.map(t => (
                    <div key={t.id} className="w-full text-left p-4 bg-gray-700 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold text-white">{t.courseName}</p>
                            <p className="text-sm text-gray-400">
                                Finalizado em: {new Date(t.finishedAt).toLocaleString('pt-BR', { timeZone: 'UTC' })}
                            </p>
                        </div>
                        <Button size="sm" variant="secondary" /* onClick={() => onSelectTraining(t)} */ >
                            Ver Cartão
                        </Button>
                    </div>
                )) : (
                    <p className="text-center text-gray-400 py-10">Você ainda não tem treinos finalizados no seu histórico.</p>
                )}
            </div>
        </div>
    );
};

export default TrainingHistoryScreen;