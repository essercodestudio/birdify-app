// screens/ManageTrainingScreen.tsx

import React, { useState, useEffect, useContext, useCallback } from 'react';
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
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchParticipants = useCallback(async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/trainings/groups/${trainingData.trainingGroupId}/participants`);
            setParticipants(response.data);
        } catch (error) {
            console.error("Erro ao buscar participantes", error);
        } finally {
            setIsLoading(false);
        }
    }, [trainingData.trainingGroupId]);

    useEffect(() => {
        fetchParticipants();
        const interval = setInterval(fetchParticipants, 5000);
        return () => clearInterval(interval);
    }, [fetchParticipants]);

    useEffect(() => {
        if (searchTerm.length < 3) {
            setSearchResults([]);
            return;
        }
        const searchPlayers = async () => {
            setIsSearching(true);
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/players/search`, {
                    params: { search: searchTerm, excludeTrainingGroup: trainingData.trainingGroupId }
                });
                setSearchResults(response.data);
            } catch (error) {
                console.error("Erro ao buscar jogadores", error);
            } finally {
                setIsSearching(false);
            }
        };
        const debounce = setTimeout(searchPlayers, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, trainingData.trainingGroupId]);

    const handleInvite = async (player: any) => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/trainings/groups/${trainingData.trainingGroupId}/invite`, {
                playerIds: [player.id]
            });
            setParticipants(prev => [...prev, { ...player, invitationStatus: 'pending' }]);
            setSearchTerm('');
            setSearchResults([]);
        } catch (error) {
            alert("Erro ao enviar convite.");
        }
    };
    
    const handleStart = () => {
        if (window.confirm("Tem a certeza de que quer iniciar a partida? Não terá como apagar após criada.")) {
            onStartTraining(trainingData.accessCode);
        }
    };

    if (isLoading) return <Spinner />;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
            <h2 className="text-2xl font-bold text-white">Gerir Treino</h2>
            <p className="text-gray-400">Convide jogadores e inicie a partida quando estiver pronto.</p>
            
            <div>
                <h3 className="text-lg font-bold text-green-400 mb-2">Convidar Jogadores</h3>
                <div className="relative">
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Procurar jogador (mín. 3 letras)..."
                        className="w-full input"
                        style={{ colorScheme: 'dark' }} // <-- CORREÇÃO APLICADA AQUI
                    />
                    {isSearching && <div className="absolute right-3 top-2"><Spinner size="sm" /></div>}
                </div>
                {searchResults.length > 0 && (
                    <ul className="bg-gray-700 rounded-md mt-2 max-h-40 overflow-y-auto">
                        {searchResults.map(player => (
                            <li key={player.id} onClick={() => handleInvite(player)} className="p-2 hover:bg-gray-600 cursor-pointer">{player.fullName}</li>
                        ))}
                    </ul>
                )}
            </div>
            
            <div>
                <h3 className="text-lg font-bold text-green-400 mb-2">Participantes ({participants.length})</h3>
                <div className="space-y-2">
                    {participants.map(p => (
                        <div key={p.id} className="bg-gray-700 p-2 rounded-md flex justify-between items-center">
                            <span>{p.fullName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                p.invitationStatus === 'accepted' ? 'bg-green-500/20 text-green-300' 
                                : 'bg-yellow-500/20 text-yellow-300'}`}>
                                {p.invitationStatus === 'accepted' ? 'Confirmado' : 'Pendente'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={onBack}>Voltar</Button>
                <Button onClick={handleStart}>
                    Iniciar Treino
                </Button>
            </div>
        </div>
    );
};

export default ManageTrainingScreen;