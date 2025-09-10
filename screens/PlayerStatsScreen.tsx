// screens/PlayerStatsScreen.tsx - ATUALIZADO

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';

interface PlayerStatsScreenProps {
  onBack: () => void;
}

interface Stats {
    totalRounds: number;
    averageStrokes: number;
    bestGross: number;
    bestNet: number;
    eaglesOrBetter: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doubleBogeysOrWorse: number;
    averagePar3: number;
    averagePar4: number;
    averagePar5: number;
}

const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="bg-gray-700 p-4 rounded-lg text-center">
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
    </div>
);

const PlayerStatsScreen: React.FC<PlayerStatsScreenProps> = ({ onBack }) => {
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/players/${user.id}/stats`);
                setStats(response.data);
            } catch (error) {
                console.error("Erro ao buscar estatísticas", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [user]);

    if (loading) return <Spinner />;

    const formatStat = (value: number | undefined | null) => {
        if (typeof value !== 'number') {
            return '0.00';
        }
        return value.toFixed(2);
    };

    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            <div className="flex items-center mb-6">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                    <ChevronLeftIcon className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-white">Minhas Estatísticas</h1>
                    <p className="text-gray-400">Seu desempenho geral em torneios finalizados.</p>
                </div>
            </div>

            {stats && stats.totalRounds > 0 ? (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-green-400 mb-3">Resumo Geral</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard title="Rodadas Jogadas" value={stats.totalRounds} />
                            <StatCard title="Melhor Gross" value={stats.bestGross} />
                            <StatCard title="Melhor Net" value={stats.bestNet} />
                            <StatCard title="Média de Tacadas" value={formatStat(stats.averageStrokes)} />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-green-400 mb-3">Distribuição de Scores</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <StatCard title="Eagle ou Melhor" value={stats.eaglesOrBetter} />
                            <StatCard title="Birdies" value={stats.birdies} />
                            <StatCard title="Pars" value={stats.pars} />
                            <StatCard title="Bogeys" value={stats.bogeys} />
                            <StatCard title="Double Bogey+" value={stats.doubleBogeysOrWorse} />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-green-400 mb-3">Desempenho por Tipo de Buraco</h2>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatCard title="Média em Par 3" value={formatStat(stats.averagePar3)} />
                            <StatCard title="Média em Par 4" value={formatStat(stats.averagePar4)} />
                            <StatCard title="Média em Par 5" value={formatStat(stats.averagePar5)} />
                        </div>
                    </div>
                </div>
            ) : (
                <p className="text-center text-gray-400 py-10">
                    Você ainda não possui estatísticas. Jogue e finalize um torneio para começar!
                </p>
            )}
        </div>
    );
};

export default PlayerStatsScreen;