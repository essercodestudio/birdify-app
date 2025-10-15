// screens/TrainingScreen.tsx - VERSÃO ATUALIZADA

import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import CreateTrainingModal from '../components/training/CreateTrainingModal';
import ManageTrainingScreen from './ManageTrainingScreen';

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

    // Verifica se já existe um treino ativo
    const hasActiveTraining = myTrainings.length > 0;

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [trainingsRes, invitesRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/users/${user.id}/trainings`),
                axios.get(`${import.meta.env.VITE_API_URL}/api/users/${user.id}/invitations`)
            ]);
            setMyTrainings(trainingsRes.data);
            setInvitations(invitesRes.data);
        } catch (error) {
            console.error("Erro ao buscar dados de treino", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (view === 'LIST') {
            fetchData();
        }
    }, [view, fetchData]);

    const handleInvitationResponse = async (inviteId: number, status: 'accepted' | 'declined') => {
        try {
            await axios.patch(`${import.meta.env.VITE_API_URL}/api/trainings/invitations/${inviteId}`, { status });
            alert(`Convite ${status === 'accepted' ? 'aceite' : 'recusado'}!`);
            fetchData();
        } catch (error) {
            alert("Erro ao responder ao convite.");
        }
    };
    
    const handleDeleteTraining = async (trainingId: number) => {
        if (window.confirm("Tem a certeza de que quer apagar este treino? Esta ação não pode ser desfeita.")) {
            try {
                await axios.delete(`${import.meta.env.VITE_API_URL}/api/trainings/${trainingId}/creator/${user?.id}`);
                alert("Treino apagado com sucesso!");
                fetchData();
            } catch (error: any) {
                alert(error.response?.data?.error || "Não foi possível apagar o treino.");
            }
        }
    };

    const handleManageTraining = (training: any) => {
        setActiveTraining(training);
        setView('MANAGE');
    };

    const handleTrainingCreated = (newTrainingData: any) => {
        setIsCreateModalOpen(false);
        handleManageTraining(newTrainingData);
    };
    
    const handleStartWithConfirmation = (training: any) => {
        if (window.confirm("Tem a certeza de que quer iniciar a partida? Não terá como apagar após criada.")) {
            onStartScoring(training.accessCode);
        }
    };

    if (loading) return <Spinner />;

    if (view === 'MANAGE' && activeTraining) {
        return (
            <ManageTrainingScreen 
                trainingData={activeTraining}
                onBack={() => setView('LIST')}
                onStartTraining={onStartScoring}
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
                                <div key={invite.invitationId} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-white">{invite.inviterName} convidou você para um treino.</p>
                                        <p className="text-sm text-gray-400">{invite.courseName} em {new Date(invite.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => handleInvitationResponse(invite.invitationId, 'accepted')} disabled={hasActiveTraining} title={hasActiveTraining ? "Finalize seu treino atual para aceitar um convite." : "Aceitar convite"}>Aceitar</Button>
                                        <Button size="sm" variant="danger" onClick={() => handleInvitationResponse(invite.invitationId, 'declined')}>Recusar</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-green-400">Meus Treinos</h2>
                        <Button onClick={() => setIsCreateModalOpen(true)} disabled={hasActiveTraining} title={hasActiveTraining ? "Você já tem um treino ativo. Finalize-o para criar um novo." : "Criar um novo treino"}>
                            Criar Novo Treino
                        </Button>
                    </div>
                    {myTrainings.length === 0 ? (
                        <div className="text-center py-6 bg-gray-700/50 rounded-lg">
                            <p className="text-gray-400">Você não tem treinos ativos.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                           {myTrainings.map(training => {
                               const isCreator = training.creatorId === user?.id;
                               return (
                                   <div key={training.id} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                                       <div>
                                           <p className="font-bold text-white">{training.courseName}</p>
                                           <p className="text-sm text-gray-400">Data: {new Date(training.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                       </div>
                                       <div className="flex flex-wrap gap-2 justify-end">
                                           {isCreator && (
                                                <>
                                                    <Button variant="secondary" size="sm" onClick={() => handleManageTraining(training)}>
                                                        Gerir Convites
                                                    </Button>
                                                    <Button variant="danger" size="sm" onClick={() => handleDeleteTraining(training.id)}>
                                                        Remover
                                                    </Button>
                                                </>
                                           )}
                                           <Button size="sm" onClick={() => onStartScoring(training.accessCode)}>
                                                Iniciar Partida
                                           </Button>
                                       </div>
                                   </div>
                               );
                           })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default TrainingScreen;