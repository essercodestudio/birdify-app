import React, { useState, useMemo } from 'react';
import Button from '../Button.jsx';
import UserIcon from '../icons/UserIcon.jsx';

const ManageGroups = ({ tournaments, players, groups, groupPlayers, holes, tees, onCreateGroup }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [startHole, setStartHole] = useState('1');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState({});
  const [responsiblePlayerId, setResponsiblePlayerId] = useState(null);
  const [playerTeeColorSelections, setPlayerTeeColorSelections] = useState({});
  const [generatedCode, setGeneratedCode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPlayers = useMemo(() => {
    if (!searchTerm.trim()) return players;
    const lowercasedFilter = searchTerm.toLowerCase();
    return players.filter(player =>
      player.fullName.toLowerCase().includes(lowercasedFilter) ||
      player.cpf.replace(/[.-]/g, '').includes(lowercasedFilter.replace(/[.-]/g, ''))
    );
  }, [players, searchTerm]);
  
  const availableTeeColors = useMemo(() => {
    if (!selectedTournamentId) return [];
    const tournament = tournaments.find(t => t.id === selectedTournamentId);
    if (!tournament) return [];
    
    const courseHoleIds = new Set(holes.filter(h => h.courseId === tournament.courseId).map(h => h.id));
    
    const relevantTees = tees.filter(t => courseHoleIds.has(t.holeId));
    const colors = new Set(relevantTees.map(t => t.color));
    
    return Array.from(colors).sort((a, b) => a.localeCompare(b));
  }, [selectedTournamentId, tournaments, holes, tees]);


  const handlePlayerSelection = (playerId) => {
    const newSelection = { ...selectedPlayerIds };
    if (newSelection[playerId]) {
      delete newSelection[playerId];
      if (responsiblePlayerId === playerId) setResponsiblePlayerId(null);
      setPlayerTeeColorSelections(prev => {
        const newTees = { ...prev };
        delete newTees[playerId];
        return newTees;
      });

    } else {
      newSelection[playerId] = true;
    }
    setSelectedPlayerIds(newSelection);
  };
  
  const handleTeeColorSelectionChange = (playerId, color) => {
    setPlayerTeeColorSelections(prev => ({ ...prev, [playerId]: color }));
  };


  const handleCreateGroup = (e) => {
    e.preventDefault();
    const playerIds = Object.keys(selectedPlayerIds).filter(id => selectedPlayerIds[id]);
    const allPlayersHaveTees = playerIds.every(id => playerTeeColorSelections[id]);
    
    if (!selectedTournamentId || !startHole || playerIds.length === 0 || !responsiblePlayerId || !allPlayersHaveTees) {
       alert("Por favor, preencha todos os campos, selecione jogadores, um responsável, e a cor do tee para cada jogador.");
       return;
    }

    const playerTeeIdSelections = {};
    const startHoleNumber = parseInt(startHole, 10);
    const tournament = tournaments.find(t => t.id === selectedTournamentId);
    const startHoleRecord = holes.find(h => h.courseId === tournament?.courseId && h.holeNumber === startHoleNumber);

    if (!startHoleRecord) {
        alert(`Não foi possível encontrar o buraco de início ${startHoleNumber} no campo selecionado.`);
        return;
    }

    for (const playerId of playerIds) {
        const color = playerTeeColorSelections[playerId];
        const teeRecord = tees.find(t => t.holeId === startHoleRecord.id && t.color === color);
        if (teeRecord) {
            playerTeeIdSelections[playerId] = teeRecord.id;
        } else {
            alert(`O tee da cor "${color}" não existe para o buraco de início (${startHoleNumber}). Por favor, cadastre este tee no campo.`);
            return;
        }
    }

    const code = onCreateGroup({
      tournamentId: selectedTournamentId,
      startHole: parseInt(startHole, 10),
      playerIds,
      responsiblePlayerId,
      playerTeeSelections: playerTeeIdSelections,
    });
    setGeneratedCode(code);
    setSelectedPlayerIds({});
    setResponsiblePlayerId(null);
    setPlayerTeeColorSelections({});
    setStartHole('1');
    setSearchTerm('');
  };
  
  const tournamentGroups = useMemo(() => {
    return groups.filter(g => g.tournamentId === selectedTournamentId);
  }, [groups, selectedTournamentId]);

  const getPlayerName = (playerId) => players.find(p => p.id === playerId)?.fullName || 'Desconhecido';

  return (
    <div className="space-y-8">
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Montar Grupos de Jogadores</h3>
        <label htmlFor="selectTournament" className="block text-sm font-medium text-gray-300 mb-1">1. Selecione o Torneio</label>
        <select id="selectTournament" value={selectedTournamentId} onChange={(e) => { setSelectedTournamentId(e.target.value); setGeneratedCode(null); }} className="w-full sm:w-1/2 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md">
          <option value="">-- Selecione --</option>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {selectedTournamentId && (
        <>
            <div className="p-6 bg-gray-700/50 rounded-lg">
                <h3 className="text-lg font-bold text-green-400 mb-4">Grupos Existentes</h3>
                {tournamentGroups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tournamentGroups.map(group => {
                            const playersInGroup = groupPlayers.filter(gp => gp.groupId === group.id);
                            return (
                                <div key={group.id} className="bg-gray-800 p-4 rounded-md">
                                    <p className="font-bold">Grupo (Início Buraco {group.startHole})</p>
                                    <p className="text-sm text-gray-400">Código: <span className="font-mono bg-gray-900 px-2 py-1 rounded">{group.accessCode}</span></p>
                                    <ul className="mt-2 text-sm">
                                        {playersInGroup.map(gp => (
                                            <li key={gp.id} className="flex items-center">
                                                <UserIcon className="h-4 w-4 mr-2 text-gray-400"/> 
                                                {getPlayerName(gp.playerId)} 
                                                {gp.isResponsible && <span className="ml-2 text-xs bg-green-500/50 text-green-200 px-2 rounded-full">Marcador</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )
                        })}
                    </div>
                ) : <p className="text-gray-400">Nenhum grupo criado para este torneio ainda.</p>}
            </div>
            
            <form onSubmit={handleCreateGroup} className="p-6 bg-gray-700/50 rounded-lg space-y-6">
                <h3 className="text-lg font-bold text-green-400">2. Criar Novo Grupo</h3>
                <div>
                    <label htmlFor="startHole" className="block text-sm font-medium text-gray-300 mb-1">Buraco de Início</label>
                    <input type="number" id="startHole" value={startHole} onChange={e => setStartHole(e.target.value)} min="1" max="18" required className="w-24 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Selecione Jogadores, Responsável e Tees</label>
                     <input type="text" placeholder="Buscar por nome ou CPF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-2/3 mb-2 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
                    <div className="space-y-2 max-h-80 overflow-y-auto p-2 bg-gray-900/50 rounded-md">
                        {filteredPlayers.map(player => (
                            <div key={player.id} className="p-2 bg-gray-800 rounded">
                                <div className="flex items-center">
                                    <input type="checkbox" id={`cb-${player.id}`} checked={!!selectedPlayerIds[player.id]} onChange={() => handlePlayerSelection(player.id)} className="h-4 w-4 bg-gray-700 border-gray-600 rounded text-green-600 focus:ring-green-500"/>
                                    <label htmlFor={`cb-${player.id}`} className="ml-2 flex-grow text-sm font-medium text-white">{player.fullName}</label>
                                    <input type="radio" name="responsiblePlayer" id={`rb-${player.id}`} disabled={!selectedPlayerIds[player.id]} checked={responsiblePlayerId === player.id} onChange={() => setResponsiblePlayerId(player.id)} className="h-4 w-4 bg-gray-700 border-gray-600 text-green-600 focus:ring-green-500" />
                                </div>
                                {selectedPlayerIds[player.id] && (
                                    <div className="mt-2 pl-6">
                                        <select required value={playerTeeColorSelections[player.id] || ''} onChange={(e) => handleTeeColorSelectionChange(player.id, e.target.value)} className="w-full px-2 py-1.5 border border-gray-600 bg-gray-900 text-white rounded-md text-sm">
                                            <option value="" disabled>-- Selecione a Cor do Tee --</option>
                                            {availableTeeColors.map(color => (
                                                <option key={color} value={color}>{color}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                     <p className="text-xs text-gray-400 mt-1">Marque a caixa para incluir um jogador, o círculo para designá-lo marcador, e escolha o tee.</p>
                </div>

                <Button type="submit" className="w-full sm:w-auto">Criar Grupo e Gerar Código</Button>

                {generatedCode && (
                    <div className="mt-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-center">
                        <p className="text-green-300">Grupo criado com sucesso! Compartilhe o código com o marcador:</p>
                        <p className="text-3xl font-bold font-mono tracking-widest text-white mt-2 bg-gray-900 inline-block px-4 py-2 rounded">{generatedCode}</p>
                    </div>
                )}
            </form>
        </>
      )}
    </div>
  );
};

export default ManageGroups;