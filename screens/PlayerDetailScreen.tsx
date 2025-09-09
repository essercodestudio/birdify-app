// screens/PlayerDetailScreen.tsx - NOVO FICHEIRO

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';

interface PlayerDetailProps {
    player: any; // Recebe o objeto completo do jogador do leaderboard
    tournamentId: string;
    onBack: () => void;
}

interface ScoreDetail {
    holeNumber: number;
    strokes: number;
    par: number;
    yardage: number | null;
}

// Função para definir o estilo com base no score
const getScoreStyle = (strokes: number, par: number) => {
    const diff = strokes - par;
    if (diff <= -2) return 'bg-yellow-500 text-black border-yellow-400'; // Eagle ou melhor
    if (diff === -1) return 'bg-green-500/20 text-green-300 border-green-500'; // Birdie
    if (diff === 0) return 'bg-gray-700 text-white border-gray-600'; // Par
    if (diff === 1) return 'bg-red-500/20 text-red-300 border-red-500'; // Bogey
    return 'bg-red-800/20 text-red-400 border-red-800'; // Double Bogey ou pior
};

const PlayerDetailScreen: React.FC<PlayerDetailProps> = ({ player, tournamentId, onBack }) => {
    const [details, setDetails] = useState<ScoreDetail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/api/history/player/${player.id}/tournament/${tournamentId}`);
                setDetails(response.data);
            } catch (error) {
                console.error("Erro ao buscar detalhes do jogador", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [player.id, tournamentId]);

    if (loading) return <Spinner />;

    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            <div className="flex items-center mb-6">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                    <ChevronLeftIcon className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-white">{player.fullName}</h1>
                    <p className="text-gray-400">Resultados Detalhados</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">Hole</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">Length</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">Par</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">Count</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {details.map(detail => {
                             const style = getScoreStyle(detail.strokes, detail.par);
                             const total = detail.strokes - detail.par;
                            return (
                                <tr key={detail.holeNumber} className="text-center">
                                    <td className="px-3 py-4 font-bold">{detail.holeNumber}</td>
                                    <td className="px-3 py-4 text-gray-300">{detail.yardage ? `${detail.yardage}j` : '-'}</td>
                                    <td className="px-3 py-4">{detail.par}</td>
                                    <td className="px-3 py-4">
                                        <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-bold ${style}`}>
                                            {detail.strokes}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 font-bold">{total === 0 ? 'E' : `${total > 0 ? '+' : ''}${total}`}</td>
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