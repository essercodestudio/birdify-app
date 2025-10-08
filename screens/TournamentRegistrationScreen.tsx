// screens/TournamentRegistrationScreen.tsx - VERSÃO FINAL E CORRIGIDA

import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

const TournamentRegistrationScreen: React.FC = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Estilo Padrão para os Campos do Formulário ---
    const inputStyle = "w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent mt-1";

    useEffect(() => {
        // Esta verificação garante que só prosseguimos se o utilizador estiver logado.
        if (!user) {
            alert("Por favor, faça login para se inscrever num torneio.");
            navigate('/login');
            return;
        }

        const fetchFormData = async () => {
            try {
                // Busca os detalhes do torneio e as perguntas do formulário em paralelo
                const [tournamentRes, questionsRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/public`),
                    axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/questions`)
                ]);
                setTournament(tournamentRes.data);
                setQuestions(questionsRes.data);
            } catch (err) {
                setError('Não foi possível carregar o formulário de inscrição. O torneio pode não existir ou o link pode ser inválido.');
            } finally {
                setLoading(false);
            }
        };

        if (tournamentId && user) {
            fetchFormData();
        }
    }, [tournamentId, user, navigate]);

    const handleAnswerChange = (questionId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return; // Verificação de segurança adicional

        setIsSubmitting(true);
        // Mapeia as respostas do formulário para o formato que a API espera
        const answersPayload = Object.entries(answers).map(([questionId, answerText]) => ({
            questionId: parseInt(questionId, 10),
            answerText,
        }));

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/register`, {
                playerId: user.id,
                answers: answersPayload,
            });
            alert('Inscrição realizada com sucesso! O seu pagamento está pendente de confirmação pelo administrador.');
            navigate('/');
        } catch (err: any) {
            // Mostra uma mensagem de erro mais específica se a API a enviar
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
                <form onSubmit={handleRegister} className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    {tournament.bannerImageUrl && <img src={tournament.bannerImageUrl} alt={`Banner do ${tournament.name}`} className="w-full h-48 object-cover" />}
                    <div className="p-6 md:p-8 space-y-6">
                        <h1 className="text-4xl font-extrabold text-white">{tournament.name}</h1>
                        <p className="text-lg text-gray-400">{tournament.courseName} - {new Date(tournament.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        
                        <div className="pt-6 border-t border-gray-700">
                            <h2 className="text-2xl font-bold text-green-400 mb-4">Formulário de Inscrição</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400">Nome Completo</label>
                                    <input type="text" value={user?.fullName || ''} disabled className="mt-1 w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-400 rounded-md cursor-not-allowed" />
                                </div>

                                {questions.map(q => (
                                    <div key={q.id}>
                                        <label htmlFor={`q-${q.id}`} className="block text-sm font-medium text-gray-300">
                                            {q.questionText} {q.isRequired && <span className="text-red-400">*</span>}
                                        </label>
                                        {q.questionType === 'MULTIPLE_CHOICE' ? (
                                            <select id={`q-${q.id}`} value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id.toString(), e.target.value)} required={q.isRequired} className={inputStyle}>
                                                <option value="">-- Selecione --</option>
                                                {q.options.map((opt: any) => <option key={opt.id} value={opt.optionText}>{opt.optionText}</option>)}
                                            </select>
                                        ) : (
                                            <input type={q.questionType.toLowerCase()} id={`q-${q.id}`} value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id.toString(), e.target.value)} required={q.isRequired} className={inputStyle} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-700">
                            <h2 className="text-2xl font-bold text-green-400">Instruções de Pagamento</h2>
                            <p className="mt-2 text-gray-300">{tournament.paymentInstructions || 'Nenhuma instrução de pagamento fornecida.'}</p>
                        </div>

                        <div className="pt-6 border-t border-gray-700 text-center">
                            <Button type="submit" isLoading={isSubmitting} size="lg">Confirmar Inscrição</Button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
};

export default TournamentRegistrationScreen;