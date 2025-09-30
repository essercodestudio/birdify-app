// screens/TrainingScreen.tsx - VERSÃO CORRIGIDA

import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import CreateTrainingModal from '../components/training/CreateTrainingModal';
import ManageTrainingScreen from './ManageTrainingScreen'; // <-- Este import agora funciona

interface TrainingScreenProps {
  onBack: () => void;
  onStartScoring: (accessCode: string) => void;
}

type TrainingView = 'LIST' | 'MANAGE';

const TrainingScreen: React.FC<TrainingScreenProps> = ({ onBack, onStartScoring }) => {
    const { user } = useContext(AuthContext);
    const [view, setView] = useState<TrainingView>('LIST');
    const [activeTraining, setActiveTraining] = useState<any | null>(null);
    const [myTrainings, setMyTrainings] = useState<any[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const trainingsPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/users/${user.id}/trainings`);
            const invitesPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/users/${user.id}/invitations`);
            const [trainingsRes, invitesRes] = await Promise.all([trainingsPromise, invitesPromise]);
            setMyTrainings(trainingsRes.data);
            setInvitations(invitesRes.data);
        } catch (error) {
            console.error("Erro ao buscar dados de treino", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleInvitationResponse = async (inviteId: number, status: 'accepted' | 'declined') => {
        try {
            await axios.patch(`${import.meta.env.VITE_API_URL}/api/trainings/invitations/${inviteId}`, { status });
            alert(`Convite ${status === 'accepted' ? 'aceite' : 'recusado'}!`);
            fetchData();
        } catch (error) {
            alert("Erro ao responder ao convite.");
        }
    };

    const handleTrainingCreated = (newTrainingData: any) => {
        setActiveTraining(newTrainingData);
        setView('MANAGE');
    };
    
    const handleStartTraining = (accessCode: string) => {
        onStartScoring(accessCode);
    };

    if (loading) return <Spinner />;

    if (view === 'MANAGE' && activeTraining) {
        return (
            <ManageTrainingScreen 
                trainingData={activeTraining}
                onBack={() => setView('LIST')}
                onStartTraining={handleStartTraining}
            />
        );
    }

    return (
        <>
            {isCreateModalOpen && (
                <CreateTrainingModal 
                    onClose={() => setIsCreateModalOpen(false)}
                    onTrainingCreated={handleTrainingCreated}
                />
            )}
            <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl space-y-8">
                <div className="flex items-center">
                    <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                        <ChevronLeftIcon className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Área de Treino</h1>
                        <p className="text-gray-400">Crie, participe e registe as suas sessões de treino.</p>
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-green-400 mb-4">Convites Pendentes</h2>
                    {invitations.length === 0 ? (
                        <div className="text-center py-6 bg-gray-700/50 rounded-lg">
                            <p className="text-gray-400">Você não tem convites pendentes.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {invitations.map(invite => (
                                <div key={invite.id} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-white">{invite.inviterName} convidou você para um treino.</p>
                                        <p className="text-sm text-gray-400">{invite.courseName} em {new Date(invite.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => handleInvitationResponse(invite.id, 'accepted')}>Aceitar</Button>
                                        <Button size="sm" variant="danger" onClick={() => handleInvitationResponse(invite.id, 'declined')}>Recusar</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-green-400">Meus Treinos</h2>
                        <Button onClick={() => setIsCreateModalOpen(true)}>
                            Criar Novo Treino
                        </Button>
                    </div>
                    {myTrainings.length === 0 ? (
                        <div className="text-center py-6 bg-gray-700/50 rounded-lg">
                            <p className="text-gray-400">Você ainda não tem treinos agendados.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                           {myTrainings.map(training => (
                               <div key={training.id} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                                   <div>
                                       <p className="font-bold text-white">{training.courseName}</p>
                                       <p className="text-sm text-gray-400">Data: {new Date(training.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                       <p className="text-xs text-gray-500 mt-1">Código de Acesso: {training.accessCode}</p>
                                   </div>
                                   <Button onClick={() => onStartScoring(training.accessCode)}>Marcar Score</Button>
                               </div>
                           ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default TrainingScreen;