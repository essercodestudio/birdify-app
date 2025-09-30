// screens/TournamentRegistrationScreen.tsx - NOVO FICHEIRO

import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

interface TournamentDetails {
    name: string;
    date: string;
    courseName: string;
    bannerImageUrl: string | null;
    paymentInstructions: string | null;
}

const TournamentRegistrationScreen: React.FC = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<TournamentDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchTournamentDetails = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/public`);
                setTournament(response.data);
            } catch (err) {
                setError('Não foi possível carregar os detalhes do torneio. O link pode ser inválido.');
            } finally {
                setLoading(false);
            }
        };

        if (tournamentId) {
            fetchTournamentDetails();
        }
    }, [tournamentId]);

    const handleRegister = async () => {
        if (!user) {
            alert('Você precisa de estar logado para se inscrever.');
            navigate('/login');
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/tournaments/register`, {
                tournamentId: tournamentId,
                playerId: user.id,
            });
            alert('Inscrição realizada com sucesso! O seu pagamento está pendente de confirmação pelo administrador.');
            navigate('/'); // Redireciona para a página principal após a inscrição
        } catch (err: any) {
            alert(err.response?.data?.error || 'Não foi possível realizar a inscrição.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="max-w-4xl mx-auto">
            {error ? (
                <div className="text-center p-8 bg-red-900/50 rounded-lg">
                    <h2 className="text-2xl font-bold text-red-300">Erro</h2>
                    <p className="text-red-400 mt-2">{error}</p>
                    <Button onClick={() => navigate('/')} className="mt-6">Voltar à Página Principal</Button>
                </div>
            ) : tournament && (
                <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    {tournament.bannerImageUrl && (
                        <img src={tournament.bannerImageUrl} alt={`Banner do ${tournament.name}`} className="w-full h-48 object-cover" />
                    )}
                    <div className="p-6 md:p-8">
                        <h1 className="text-4xl font-extrabold text-white">{tournament.name}</h1>
                        <p className="text-lg text-gray-400 mt-2">
                            {tournament.courseName} - {new Date(tournament.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </p>

                        <div className="mt-8 pt-6 border-t border-gray-700">
                            <h2 className="text-2xl font-bold text-green-400">Instruções para Inscrição e Pagamento</h2>
                            <div className="prose prose-invert mt-4 text-gray-300">
                                <p>{tournament.paymentInstructions || 'Nenhuma instrução de pagamento fornecida.'}</p>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-700 text-center">
                             <p className="text-gray-300 mb-4">Você está a inscrever-se como: <span className="font-bold text-white">{user?.fullName}</span></p>
                            <Button onClick={handleRegister} isLoading={isSubmitting} size="lg">
                                Confirmar Inscrição
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentRegistrationScreen;