// essercodestudio/birdify-app/birdify-app-292f4c7e273124d606a73f19222b8d25fd42d22f/screens/TournamentResultScreen.tsx

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
    // Estado para controlar qual jogador está selecionado para ver o detalhe
    const [selectedPlayer, setSelectedPlayer] = useState(null); 

    useEffect(() => {
        const fetchResults = async () => {
            try {
                // Rota que busca todos os dados necessários: campo, jogadores, categorias e scores
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
        try {
            // A rota de exportação que já corrigimos no backend
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/export/scorecard/tournament/${tournamentId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const tournamentName = data?.course?.courseName || 'torneio';
            link.setAttribute('download', `relatorio_completo_${tournamentName.replace(/\s+/g, '_')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Erro ao exportar o relatório.');
            console.error(error);
        }
    };

    if (loading) return <Spinner />;
    if (!data) return <p className="text-red-400">Não foi possível carregar os dados.</p>;

    const { course, players } = data;

    // Lógica para separar jogadores por categoria (Masculino, Feminino, etc.)
    const playersByCategory = players.reduce((acc, player) => {
        // Usa 'Geral' se a categoria não estiver definida
        const category = player.categoryName || 'Geral';
        if (!acc[category]) acc[category] = [];
        acc[category].push(player);
        return acc;
    }, {});
    
    // Ordena as categorias para exibição (ex: Feminino, Masculino, Sênior)
    const sortedCategories = Object.keys(playersByCategory).sort();
    const sortedGross = [...players].sort((a, b) => (a.totalStrokes ?? 999) - (b.totalStrokes ?? 999));

    return (
        <>
            {/* O Modal do scorecard do jogador só aparece se um jogador for selecionado */}
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
                            <h1 className="text-3xl font-bold text-white">{course.courseName}</h1>
                            <p className="text-slate-400">{new Date(course.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        </div>
                    </div>
                    {/* Botão de exportar visível apenas para admins */}
                    {user?.role === 'admin' && (
                        <Button onClick={handleExport}>Exportar Resultados</Button>
                    )}
                </div>

                <CourseInfoTable course={course} />
                
                {/* Mapeia e exibe uma tabela de resultados NET para cada categoria */}
                {sortedCategories.map(category => (
                    <ResultsTable 
                        key={category} 
                        title={`Resultado NET: ${category}`} 
                        players={playersByCategory[category]} 
                        onPlayerClick={setSelectedPlayer}
                        type="net"
                    />
                ))}

                {/* Tabela separada para o resultado GROSS geral */}
                <ResultsTable 
                    title="Resultado GROSS Geral" 
                    players={sortedGross} 
                    onPlayerClick={setSelectedPlayer}
                    type="gross"
                />
            </div>
        </>
    );
};

export default TournamentResultScreen;