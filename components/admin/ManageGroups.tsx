// essercodestudio/birdify-app/birdify-app-5edd58081f645dcc34f897e15210f0f29db5dc87/components/admin/ManageGroups.tsx
// VERSÃO COM CORREÇÃO VISUAL DEFINITIVA APLICADA

import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import axios from 'axios';
import Button from '../Button';
import Spinner from '../Spinner';
import { AuthContext } from '../../context/AuthContext';

// Interfaces (sem alterações)
interface Tournament {
  id: number;
  name: string;
  date: string;
}

interface Player {
  playerId: number;
  registrationId: number;
  fullName: string;
  gender: string;
}

interface Group {
    id: number;
    startHole: number;
    accessCode: string;
    status: 'pending' | 'completed';
    players: {
        playerId: number;
        fullName: string;
        isResponsible: boolean;
        teeColor: string;
    }[];
}

const ManageGroups: React.FC = () => {
    const { user } = useContext(AuthContext);

    // Estados para dados da API
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [selectedTournament, setSelectedTournament] = useState<string>('');
    const [confirmedPlayers, setConfirmedPlayers] = useState<Player[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [availableTees, setAvailableTees] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
    const [responsiblePlayerId, setResponsiblePlayerId] = useState<number | null>(null);
    const [startHole, setStartHole] = useState<number>(1);
    const [playerTeeSelections, setPlayerTeeSelections] = useState<Record<number, string>>({});
    const [searchTerm, setSearchTerm] = useState('');

    const fetchTournaments = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments?adminId=${user.id}`);
            setTournaments(response.data);
        } catch (error) {
            console.error('Erro ao buscar torneios:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const fetchTournamentData = useCallback(async () => {
        if (!selectedTournament) {
            setConfirmedPlayers([]);
            setGroups([]);
            setAvailableTees([]);
            return;
        }
        setLoading(true);
        try {
            const [playersRes, groupsRes, teesRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${selectedTournament}/confirmed-players`),
                axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${selectedTournament}/groups`),
                axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${selectedTournament}/tees`)
            ]);
            setConfirmedPlayers(playersRes.data);
            setGroups(groupsRes.data);
            setAvailableTees(teesRes.data.map((t: { color: string }) => t.color));
        } catch (error) {
            console.error('Erro ao buscar dados do torneio:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedTournament]);

    useEffect(() => { fetchTournaments(); }, [fetchTournaments]);
    useEffect(() => { fetchTournamentData(); }, [fetchTournamentData]);

    const togglePlayerSelection = (playerId: number) => {
        setSelectedPlayers(prev => {
            const newSelection = prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId];
            if (responsiblePlayerId === playerId && !newSelection.includes(playerId)) {
                setResponsiblePlayerId(null);
            }
            if (!newSelection.includes(playerId)) {
                setPlayerTeeSelections(current => {
                    const newTees = { ...current };
                    delete newTees[playerId];
                    return newTees;
                });
            }
            return newSelection;
        });
    };

    const handleCreateGroup = async () => {
        if (selectedPlayers.length === 0 || !responsiblePlayerId) {
            alert('Selecione jogadores e defina um marcador.');
            return;
        }
        const allTeesSelected = selectedPlayers.every(id => playerTeeSelections[id]);
        if (!allTeesSelected) {
            alert('Por favor, selecione uma cor de tee para cada jogador no grupo.');
            return;
        }

        try {
            const playersData = selectedPlayers.map(playerId => ({
                id: playerId,
                teeColor: playerTeeSelections[playerId]
            }));

            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/groups`, {
                tournamentId: selectedTournament,
                startHole,
                players: playersData,
                responsiblePlayerId,
            });
            setGeneratedCode(response.data.accessCode);
            setSelectedPlayers([]);
            setResponsiblePlayerId(null);
            setPlayerTeeSelections({});
            fetchTournamentData();
        } catch (error) {
            console.error('Erro ao criar grupo:', error);
            alert('Erro ao criar grupo. Verifique o console do backend.');
        }
    };

    const handleDeleteGroup = async (groupId: number) => {
        if (!window.confirm('Tem certeza que deseja apagar este grupo?')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/groups/${groupId}`);
            fetchTournamentData();
        } catch (error) {
            alert('Erro ao apagar grupo.');
        }
    };

    const playersInGroups = useMemo(() => new Set(groups.flatMap(g => g.players.map(p => p.playerId))), [groups]);
    const availablePlayers = confirmedPlayers.filter(p => !playersInGroups.has(p.playerId));
    const filteredAvailablePlayers = availablePlayers.filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Classe de estilo padrão para inputs, garantindo o tema escuro
    const inputStyle = "w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

    return (
        <div className="space-y-8">
            <div className="p-6 bg-gray-800 rounded-lg shadow-xl">
                <h1 className="text-xl font-bold text-green-400">Gerenciar Grupos</h1>
                <p className="text-sm text-gray-300 mt-1">Crie e gerencie os grupos para os torneios.</p>
            </div>

            <div className="p-6 bg-gray-800 rounded-lg shadow-xl">
                <h2 className="font-bold text-lg mb-2 text-white">1. Selecionar Torneio</h2>
                <select value={selectedTournament} onChange={(e) => setSelectedTournament(e.target.value)} disabled={loading} className={inputStyle + " sm:w-1/2"}>
                    <option value="">-- Selecione um torneio --</option>
                    {tournaments.map(tournament => (
                        <option key={tournament.id} value={tournament.id}>
                            {tournament.name} - {new Date(tournament.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </option>
                    ))}
                </select>
            </div>

            {selectedTournament && (loading ? <Spinner /> :
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 p-6 bg-gray-800 rounded-lg shadow-xl flex flex-col">
                            <h3 className="text-lg font-bold text-green-400">2. Jogadores Disponíveis ({availablePlayers.length})</h3>
                            <input type="text" placeholder="Buscar jogador..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle + " my-4"} />
                            <div className="space-y-2 flex-grow overflow-y-auto pr-2">
                                {filteredAvailablePlayers.map(player => (
                                    <div key={player.registrationId} className={`p-2 rounded flex items-center gap-2 cursor-pointer ${selectedPlayers.includes(player.playerId) ? 'bg-green-800' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => togglePlayerSelection(player.playerId)}>
                                        <input type="checkbox" checked={selectedPlayers.includes(player.playerId)} readOnly className="h-4 w-4 bg-gray-900 border-gray-600 rounded text-green-600" />
                                        <span className="text-white">{player.fullName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="lg:col-span-2 p-6 bg-gray-800 rounded-lg shadow-xl">
                            <h3 className="text-lg font-bold text-green-400 mb-4">3. Criar Novo Grupo</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Jogadores Selecionados ({selectedPlayers.length})</label>
                                    <div className="p-2 bg-gray-900 rounded-md min-h-[50px] space-y-2">
                                        {selectedPlayers.map(id => {
                                            const player = confirmedPlayers.find(p => p.playerId === id);
                                            return (
                                                <div key={id} className="flex flex-col sm:flex-row items-center justify-between bg-gray-700 p-2 rounded gap-2">
                                                    <span className="flex-grow text-white">{player?.fullName}</span>
                                                    <div className="flex items-center gap-4">
                                                        <select value={playerTeeSelections[id] || ''} onChange={(e) => setPlayerTeeSelections(prev => ({...prev, [id]: e.target.value}))} className={inputStyle + " text-sm py-1"}>
                                                            <option value="">-- Tee --</option>
                                                            {availableTees.map(color => <option key={color} value={color}>{color}</option>)}
                                                        </select>
                                                        <label className="text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap text-gray-300"><input type="radio" name="responsible" checked={responsiblePlayerId === id} onChange={() => setResponsiblePlayerId(id)} /> Marcador</label>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-300">Buraco de Início:</label>
                                    <select value={startHole} onChange={(e) => setStartHole(Number(e.target.value))} className={inputStyle + " ml-2 w-auto"}>
                                        {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => (
                                            <option key={hole} value={hole}>Buraco {hole}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button onClick={handleCreateGroup} disabled={selectedPlayers.length === 0 || !responsiblePlayerId}>➕ Criar Grupo</Button>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-800 rounded-lg shadow-xl">
                        <h2 className="font-bold text-lg mb-2 text-white">Grupos do Torneio ({groups.length})</h2>
                        <div className="groups-list space-y-4">
                            {groups.map(group => (
                                <div key={group.id} className="bg-gray-700 p-4 rounded-lg">
                                    <div className="group-header flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-white">Grupo (Início Buraco {group.startHole})</h3>
                                            <span className="text-sm font-mono bg-gray-900 px-2 py-1 rounded text-gray-300">Código: {group.accessCode}</span>
                                        </div>
                                        <Button size="sm" variant="danger" onClick={() => handleDeleteGroup(group.id)}>Apagar</Button>
                                    </div>
                                    <div className="group-players mt-2">
                                        <h4 className="text-sm font-semibold text-gray-200">Jogadores:</h4>
                                        <ul className="list-disc list-inside text-gray-300">
                                            {group.players.map(player => (
                                                <li key={player.playerId}>
                                                    {player.fullName}
                                                    {player.isResponsible && <span className="text-xs text-green-400"> (Marcador)</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ManageGroups;