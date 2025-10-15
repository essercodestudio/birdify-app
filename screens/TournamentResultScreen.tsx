import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import CourseInfoTable from '../components/results/CourseInfoTable';
import ResultsTable from '../components/results/ResultsTable';
import PlayerScorecardModal from '../components/results/PlayerScorecardModal'; // Importa o modal

const TournamentResultScreen = ({ tournamentId, onBack }) => {
    const { user } = useContext(AuthContext);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPlayer, setSelectedPlayer] = useState(null); // Estado para o modal

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/full-results`);
                setData(response.data);
            } catch (error) {
                console.error("Erro ao buscar resultados do torneio:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchResults();
    }, [tournamentId]);

    const handleExport = async () => {
        // ... (código de exportação permanece igual)
    };

    if (loading) return <Spinner />;
    if (!data) return <p className="text-red-400">Não foi possível carregar os dados.</p>;

    const { course, players } = data;

    const playersByCategory = players.reduce((acc, player) => {
        const category = player.categoryName || 'Geral';
        if (!acc[category]) acc[category] = [];
        acc[category].push(player);
        return acc;
    }, {});

    const sortedNet = [...players].sort((a, b) => a.netScore - b.netScore);
    const sortedGross = [...players].sort((a, b) => a.totalStrokes - b.totalStrokes);

    return (
        <>
            {selectedPlayer && (
                <PlayerScorecardModal 
                    player={selectedPlayer} 
                    course={course} 
                    onClose={() => setSelectedPlayer(null)} 
                />
            )}
            <div className="space-y-8">
                <div className="card flex justify-between items-center">
                    <div className="flex items-center">
                        <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                            <ChevronLeftIcon className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold text-white">{course.name}</h1>
                            <p className="text-slate-400">{new Date(course.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        </div>
                    </div>
                    {user?.role === 'admin' && (
                        <Button onClick={handleExport}>Exportar Resultados para Excel</Button>
                    )}
                </div>

                <CourseInfoTable course={course} />
                
                {Object.keys(playersByCategory).sort().map(category => (
                    <ResultsTable key={category} title={`Categoria: ${category}`} players={playersByCategory[category]} onPlayerClick={setSelectedPlayer} />
                ))}

                <ResultsTable title="Classificação Gross Geral" players={sortedGross} type="gross" onPlayerClick={setSelectedPlayer} />
                <ResultsTable title="Classificação Net Geral" players={sortedNet} type="net" onPlayerClick={setSelectedPlayer} />
            </div>
        </>
    );
};

export default TournamentResultScreen;