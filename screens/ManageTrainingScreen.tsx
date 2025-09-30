// screens/ManageTrainingScreen.tsx - VERSÃO CORRETA E FINAL

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

interface ManageTrainingScreenProps {
  trainingData: any;
  onBack: () => void;
  onStartTraining: (accessCode: string) => void;
}

const ManageTrainingScreen: React.FC<ManageTrainingScreenProps> = ({ trainingData, onBack, onStartTraining }) => {
    const { user } = useContext(AuthContext);
    const [participants, setParticipants] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            setParticipants([{ ...user, invitationStatus: 'accepted' }]);
        }
    }, [user]);

    useEffect(() => {
        if (searchTerm.length < 3) {
            setSearchResults([]);
            return;
        }
        const searchPlayers = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/players/search`, {
                    params: { name: searchTerm, excludeId: user!.id }
                });
                const invitedIds = new Set(participants.map(p => p.id));
                setSearchResults(response.data.filter((p: any) => !invitedIds.has(p.id)));
            } catch (error) {
                console.error("Erro ao buscar jogadores para convite", error)
            }
        };
        const debounce = setTimeout(searchPlayers, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, user, participants]);

    const handleInvite = (player: any) => {
        setParticipants([...participants, { ...player, invitationStatus: 'pending' }]);
        setSearchTerm('');
        setSearchResults([]);
    };
    
    const sendInvitesAndStart = async () => {
        const playerIdsToInvite = participants
            .filter(p => p.id !== user!.id)
            .map(p => p.id);

        if (playerIdsToInvite.length > 0) {
            try {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/trainings/groups/${trainingData.trainingGroupId}/invite`, {
                    playerIds: playerIdsToInvite
                });
            } catch (error) {
                alert("Erro ao enviar convites.");
                return;
            }
        }
        alert("Treino iniciado e convites enviados! Utilize o código de acesso para marcar os scores.");
        onStartTraining(trainingData.accessCode);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
            <h2 className="text-2xl font-bold text-white">Preparar Treino</h2>
            <div>
                <h3 className="text-lg font-bold text-green-400 mb-2">Convidar Jogadores</h3>
                <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite o nome de um jogador (mín. 3 letras)..."
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"
                />
                {searchResults.length > 0 && (
                    <ul className="bg-gray-700 rounded-md mt-2 max-h-40 overflow-y-auto">
                        {searchResults.map(player => (
                            <li key={player.id} onClick={() => handleInvite(player)} className="p-2 hover:bg-gray-600 cursor-pointer">{player.fullName}</li>
                        ))}
                    </ul>
                )}
            </div>
            <div>
                <h3 className="text-lg font-bold text-green-400 mb-2">Participantes</h3>
                <div className="space-y-2">
                    {participants.map(p => (
                        <div key={p.id} className="bg-gray-700 p-2 rounded-md flex justify-between items-center">
                            <span>{p.fullName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${p.invitationStatus === 'accepted' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                {p.invitationStatus === 'accepted' ? 'Confirmado' : 'Pendente'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={onBack}>Cancelar</Button>
                <Button onClick={sendInvitesAndStart}>Iniciar Treino e Enviar Convites</Button>
            </div>
        </div>
    );
};

export default ManageTrainingScreen;