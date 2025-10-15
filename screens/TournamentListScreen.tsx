import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';

const TournamentListScreen = ({ onBack, onSelectTournament }) => {
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/public`);
                setTournaments(response.data);
            } catch (error) {
                console.error("Erro ao buscar torneios:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTournaments();
    }, []);

    if (loading) return <Spinner />;

    return (
        <div className="card space-y-6">
            <div className="flex items-center">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                    <ChevronLeftIcon className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-white">Torneios Birdify</h1>
                    <p className="text-slate-400">Resultados e classificações dos eventos.</p>
                </div>
            </div>

            <div className="space-y-4">
                {tournaments.length > 0 ? tournaments.map(t => (
                    <div key={t.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-white">{t.name}</p>
                            <p className="text-sm text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        </div>
                        <Button size="sm" onClick={() => onSelectTournament(t.id)}>
                            Ver Resultados
                        </Button>
                    </div>
                )) : <p className="text-slate-400 text-center">Nenhum torneio encontrado.</p>}
            </div>
        </div>
    );
};

export default TournamentListScreen;