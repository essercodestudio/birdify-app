// screens/TrainingCardScreen.tsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';

const TrainingCardScreen: React.FC<{ training: any; onBack: () => void; }> = ({ training, onBack }) => {
    const { user } = useContext(AuthContext);
    const [scores, setScores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchDetails = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/trainings/history/${training.trainingGroupId}/player/${user.id}`);
                setScores(response.data);
            } catch (error) {
                console.error("Erro ao buscar detalhes do cartão", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [user, training]);

    const handleExport = async () => {
        if (!user) return;
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/trainings/${training.trainingGroupId}/export/${user.id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `cartao_treino_${user.fullName.replace(/\s+/g, '_')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Erro ao exportar o resultado.');
        }
    };

    if (loading) return <Spinner />;

    const totalStrokes = scores.reduce((sum, score) => sum + (score.strokes || 0), 0);
    const totalPar = scores.reduce((sum, score) => sum + (score.par || 0), 0);

    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                        <ChevronLeftIcon className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">{training.courseName}</h1>
                        <p className="text-gray-400">Finalizado em: {new Date(training.finishedAt).toLocaleString('pt-BR', {timeZone: 'UTC'})}</p>
                    </div>
                </div>
                <Button onClick={handleExport}>Exportar Excel</Button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Buraco</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Distância</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Par</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Score</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-600">
                        {scores.map(s => (
                            <tr key={s.holeNumber} className="text-center">
                                <td className="px-4 py-3 font-bold">{s.holeNumber}</td>
                                <td className="px-4 py-3">{s.yardage ? `${s.yardage}m` : '-'}</td>
                                <td className="px-4 py-3">{s.par}</td>
                                <td className="px-4 py-3 font-bold text-green-400">{s.strokes}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-700 font-bold">
                            <td className="px-4 py-3 text-right" colSpan={2}>Totais</td>
                            <td className="px-4 py-3 text-center">{totalPar}</td>
                            <td className="px-4 py-3 text-center">{totalStrokes}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TrainingCardScreen;