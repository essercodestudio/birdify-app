import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';

const PlayerStatsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<any[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [type, setType] = useState<'all' | 'tournament' | 'training'>('all');

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/courses/public`);
                setCourses(response.data);
            } catch (error) {
                console.error('Erro ao carregar campos:', error);
            }
        };
        fetchCourses();
    }, []);

    useEffect(() => {
        if (!user) return;
        const fetchStats = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/players/${user.id}/stats`, {
                    params: {
                        courseId: selectedCourse || undefined,
                        type: type
                    }
                });
                setStats(response.data);
            } catch (error) {
                console.error("Erro ao buscar estatísticas", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [user, selectedCourse, type]);

    const formatNumber = (num: number | null | undefined) => (num ? num.toFixed(2) : '0.00');

    const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
        <div className="bg-gray-700 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );

    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            <div className="flex items-center mb-6">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                    <ChevronLeftIcon className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-white">Minhas Estatísticas</h1>
                    <p className="text-gray-400">Seu desempenho geral no Birdify.</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <select value={type} onChange={(e) => setType(e.target.value as any)} className="input">
                    <option value="all">Geral (Torneios e Treinos)</option>
                    <option value="tournament">Apenas Torneios</option>
                    <option value="training">Apenas Treinos</option>
                </select>
                <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="input">
                    <option value="">Todos os Campos</option>
                    {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                </select>
            </div>

            {loading ? <Spinner /> : !stats ? <p>Não foi possível carregar as estatísticas.</p> : (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard title="Rodadas Jogadas" value={stats.totalRounds} />
                        <StatCard title="Melhor Gross" value={stats.bestGross || 0} />
                        <StatCard title="Melhor Net" value={stats.bestNet || 0} />
                        <StatCard title="Média de Tacadas" value={formatNumber(stats.averageStrokes)} />
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-green-400 mb-2">Desempenho por Par</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard title="Média Par 3" value={formatNumber(stats.averagePar3)} />
                            <StatCard title="Média Par 4" value={formatNumber(stats.averagePar4)} />
                            <StatCard title="Média Par 5" value={formatNumber(stats.averagePar5)} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-green-400 mb-2">Distribuição de Scores</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            <StatCard title="Eagles ou Melhor" value={stats.eaglesOrBetter} />
                            <StatCard title="Birdies" value={stats.birdies} />
                            <StatCard title="Pars" value={stats.pars} />
                            <StatCard title="Bogeys" value={stats.bogeys} />
                            <StatCard title="Double Bogeys+" value={stats.doubleBogeysOrWorse} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerStatsScreen;