// components/admin/ManageGroups.tsx - VERSÃO FINAL (LIGAÇÃO COM JOGADORES CONFIRMADOS)

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { AdminTournament, AdminPlayer } from "../../data/mockDatabase";
import Button from "../Button";
import UserIcon from "../icons/UserIcon";

interface PlayerSelection {
  id: string;
  teeColor: string;
}

const ManageGroups: React.FC = () => {
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<AdminPlayer[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [availableTees, setAvailableTees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");

  // Estados para o formulário de CRIAÇÃO
  const [groupCategory, setGroupCategory] = useState("Male");
  const [startHole, setStartHole] = useState<string>("1");
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, PlayerSelection>>({});
  const [responsiblePlayerId, setResponsiblePlayerId] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- NOVOS ESTADOS PARA O MODAL DE EDIÇÃO ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [editSearchTerm, setEditSearchTerm] = useState('');

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const tournamentsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments`);
        setTournaments(tournamentsRes.data);
      } catch (error) {
        console.error("Erro ao buscar torneios", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  // <<< FUNÇÃO ATUALIZADA >>>
  const fetchTournamentData = async (tournamentId: string) => {
    if (tournamentId) {
      try {
        // Agora busca os jogadores da rota de confirmados e as outras informações
        const [playersRes, groupsRes, teesRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/confirmed-players`),
          axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/groups`),
          axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/tees`),
        ]);
        setAvailablePlayers(playersRes.data);
        setGroups(groupsRes.data);
        setAvailableTees(teesRes.data);
      } catch (error) {
        console.error("Erro ao buscar dados do torneio", error);
        // Limpa os dados em caso de erro para evitar inconsistências
        setAvailablePlayers([]);
        setGroups([]);
        setAvailableTees([]);
      }
    } else {
      // Limpa os dados se nenhum torneio for selecionado
      setAvailablePlayers([]);
      setGroups([]);
      setAvailableTees([]);
    }
  };

  useEffect(() => {
    fetchTournamentData(selectedTournamentId);
  }, [selectedTournamentId]);
  
  const handleExportGroups = async () => {
      if (!selectedTournamentId) return;
      try {
          const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${selectedTournamentId}/export-groups`, {
              responseType: 'blob',
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', 'Horarios_de_Saida.xlsx');
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (error) {
          alert('Erro ao gerar o relatório de grupos.');
          console.error(error);
      }
  };

  const filteredPlayers = useMemo(() => {
    let playersByCategory = availablePlayers.filter((player: any) => player.gender === groupCategory);
    if (!searchTerm.trim()) return playersByCategory;
    const lowercasedFilter = searchTerm.toLowerCase();
    return playersByCategory.filter(player => player.fullName.toLowerCase().includes(lowercasedFilter) || (player.cpf && player.cpf.replace(/[.-]/g, '').includes(lowercasedFilter.replace(/[.-]/g, ''))));
  }, [availablePlayers, groupCategory, searchTerm]);

  const handlePlayerSelectionChange = (playerId: string, field: "teeColor", value: string) => {
    setSelectedPlayers((prev) => ({ ...prev, [playerId]: { ...prev[playerId], id: playerId, [field]: value } }));
  };

  const handlePlayerToggle = (player: AdminPlayer) => {
    const newSelection = { ...selectedPlayers };
    if (newSelection[player.id]) {
      delete newSelection[player.id];
      if (responsiblePlayerId === player.id.toString()) setResponsiblePlayerId(null);
    } else {
      newSelection[player.id] = { id: player.id.toString(), teeColor: "" };
    }
    setSelectedPlayers(newSelection);
  };
  
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const playersToSubmit = Object.values(selectedPlayers);
    if (!selectedTournamentId || playersToSubmit.length === 0 || !responsiblePlayerId) {
      return alert("Selecione um torneio, jogadores, tees e um responsável.");
    }
    const groupData = {
      tournamentId: parseInt(selectedTournamentId, 10),
      startHole: parseInt(startHole, 10),
      players: playersToSubmit.map((p: PlayerSelection) => ({ id: parseInt(p.id, 10), teeColor: p.teeColor })),
      responsiblePlayerId: parseInt(responsiblePlayerId, 10),
      category: groupCategory,
    };
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/groups`, groupData);
      setGeneratedCode(response.data.accessCode);
      fetchTournamentData(selectedTournamentId);
      setSelectedPlayers({});
      setResponsiblePlayerId(null);
      setSearchTerm('');
    } catch (error) {
      alert("Falha ao criar o grupo.");
      console.error(error);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (window.confirm("Tem a certeza de que quer apagar este grupo?")) {
      try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/groups/${groupId}`);
        fetchTournamentData(selectedTournamentId);
      } catch (error) {
        alert("Não foi possível apagar o grupo.");
        console.error(error);
      }
    }
  };

  const handleOpenEditModal = async (groupId: number) => {
    try {
        const [groupRes, playersRes] = await Promise.all([
            axios.get(`${import.meta.env.VITE_API_URL}/api/groups/${groupId}`),
            // Na edição, buscamos os jogadores confirmados para adicionar ao grupo
            axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${selectedTournamentId}/confirmed-players`)
        ]);
        
        const groupData = groupRes.data;
        const availablePlayersForEdit = [...groupData.players, ...playersRes.data];

        setEditingGroup({
            ...groupData,
            selectedPlayers: Object.fromEntries(groupData.players.map((p: any) => [p.id, { id: p.id.toString(), teeColor: p.teeColor }])),
            responsiblePlayerId: groupData.players.find((p: any) => p.isResponsible)?.id.toString(),
            availablePlayersForEdit: availablePlayersForEdit
        });
        setIsEditModalOpen(true);
    } catch (error) {
        alert('Não foi possível carregar os dados do grupo para edição.');
    }
  };
    
  const handleEditingPlayerToggle = (player: any) => {
      if (!editingGroup) return;
      const newSelection = { ...editingGroup.selectedPlayers };
      if (newSelection[player.id]) {
          delete newSelection[player.id];
          if (editingGroup.responsiblePlayerId === player.id.toString()) {
              setEditingGroup({ ...editingGroup, selectedPlayers: newSelection, responsiblePlayerId: null });
          } else {
              setEditingGroup({ ...editingGroup, selectedPlayers: newSelection });
          }
      } else {
          newSelection[player.id] = { id: player.id.toString(), teeColor: "" };
          setEditingGroup({ ...editingGroup, selectedPlayers: newSelection });
      }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingGroup || !editingGroup.responsiblePlayerId) {
          alert("Por favor, selecione um jogador responsável.");
          return;
      }
      
      const playersToSubmit = Object.values(editingGroup.selectedPlayers).map((p: any) => ({
          id: parseInt(p.id, 10),
          teeColor: p.teeColor,
      }));

      try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/groups/${editingGroup.id}`, {
              startHole: editingGroup.startHole,
              category: editingGroup.category,
              responsiblePlayerId: parseInt(editingGroup.responsiblePlayerId, 10),
              players: playersToSubmit,
          });
          setIsEditModalOpen(false);
          setEditingGroup(null);
          fetchTournamentData(selectedTournamentId);
          alert('Grupo atualizado com sucesso!');
      } catch (error) {
          alert('Falha ao atualizar o grupo.');
      }
  };

  if (loading) return <p>A carregar...</p>;

  return (
    <div className="space-y-8">
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Montar Grupos de Jogadores</h3>
        <div className="flex items-center gap-4">
            <div className="flex-grow">
                <label htmlFor="selectTournament" className="block text-sm font-medium text-gray-300 mb-1">1. Selecione o Torneio</label>
                <select id="selectTournament" value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} className="w-full sm:w-1/2 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md">
                    <option value="">-- Selecione --</option>
                    {tournaments.map((t: any) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
            </div>
            <div className="self-end"><Button onClick={handleExportGroups} disabled={!selectedTournamentId}>Exportar Grupos</Button></div>
        </div>
      </div>

      {selectedTournamentId && (
        <>
          <div className="p-6 bg-gray-700/50 rounded-lg">
            <h3 className="text-lg font-bold text-green-400 mb-4">Grupos Existentes</h3>
            {groups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((group) => (
                  <div key={group.id} className="bg-gray-800 p-4 rounded-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold">Grupo ({group.category === "Male" ? "Masculino" : "Feminino"})</p>
                            <p className="text-sm">Início Buraco {group.startHole}</p>
                            <p className="text-sm text-gray-400">Código: <span className="font-mono bg-gray-900 px-2 py-1 rounded">{group.accessCode}</span></p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(group.id)}>Editar</Button>
                            <Button variant="danger" size="icon" className="p-1" onClick={() => handleDeleteGroup(group.id)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </Button>
                        </div>
                    </div>
                    <ul className="mt-2 text-sm">
                        {group.players.map((p: any) => (<li key={p.fullName} className="flex items-center"><UserIcon className="h-4 w-4 mr-2 text-gray-400"/>{p.fullName}{p.isResponsible && <span className="ml-2 text-xs bg-green-500/50 text-green-200 px-2 rounded-full">Marcador</span>}</li>))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400">Nenhum grupo criado para este torneio ainda.</p>}
          </div>

          <form onSubmit={handleCreateGroup} className="p-6 bg-gray-700/50 rounded-lg space-y-6">
            <h3 className="text-lg font-bold text-green-400">2. Criar Novo Grupo (Apenas Jogadores com Pagamento Confirmado)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="groupCategory" className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
                <select id="groupCategory" value={groupCategory} onChange={(e) => setGroupCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md">
                  <option value="Male">Masculina</option>
                  <option value="Female">Feminina</option>
                </select>
              </div>
              <div>
                <label htmlFor="startHole" className="block text-sm font-medium text-gray-300 mb-1">Buraco de Início</label>
                <input type="number" id="startHole" value={startHole} onChange={e => setStartHole(e.target.value)} min="1" max="18" required className="w-24 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Selecione Jogadores Disponíveis</label>
              <input type="text" placeholder="Buscar por nome ou CPF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-2/3 mb-4 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {filteredPlayers.map((player) => (
                  <div key={player.id} className="p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center">
                      <input type="checkbox" id={`cb-${player.id}`} checked={!!selectedPlayers[player.id]} onChange={() => handlePlayerToggle(player)} className="h-4 w-4"/>
                      <label htmlFor={`cb-${player.id}`} className="ml-3 flex-grow font-medium text-white">{player.fullName}</label>
                      <input type="radio" name="responsiblePlayer" id={`rb-${player.id}`} disabled={!selectedPlayers[player.id]} checked={responsiblePlayerId === player.id.toString()} onChange={() => setResponsiblePlayerId(player.id.toString())} className="h-4 w-4"/>
                    </div>
                    {selectedPlayers[player.id] && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <label className="text-xs text-gray-400">Tee de Saída</label>
                        <select value={selectedPlayers[player.id].teeColor} onChange={(e) => handlePlayerSelectionChange(player.id.toString(), "teeColor", e.target.value)} required className="w-full mt-1 px-2 py-1.5 border border-gray-600 bg-gray-900 text-white rounded-md text-sm">
                          <option value="">-- Cor --</option>
                          {availableTees.map((tee: any) => (<option key={tee.color} value={tee.color}>{tee.color}</option>))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
                 {availablePlayers.length === 0 && (<p className="text-gray-400 text-center py-4">Nenhum jogador com pagamento confirmado encontrado.</p>)}
                 {filteredPlayers.length === 0 && availablePlayers.length > 0 && (<p className="text-gray-400 text-center py-4">Nenhum jogador encontrado para a sua pesquisa.</p>)}
              </div>
            </div>
            <Button type="submit">Criar Grupo</Button>
            {generatedCode && (<div className="mt-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-center"><p className="text-green-300">Grupo criado com sucesso! Compartilhe o código com o marcador:</p><p className="text-3xl font-bold font-mono tracking-widest text-white mt-2 bg-gray-900 inline-block px-4 py-2 rounded">{generatedCode}</p></div>)}
          </form>
        </>
      )}
      
      {/* MODAL DE EDIÇÃO DE GRUPO */}
      {isEditModalOpen && editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleUpdateGroup} className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <h3 className="text-2xl font-bold text-white mb-4">Editar Grupo (Cód: {editingGroup.accessCode})</h3>
                <div className="flex-grow overflow-y-auto pr-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
                            <select value={editingGroup.category} onChange={(e) => setEditingGroup({...editingGroup, category: e.target.value, selectedPlayers: {}, responsiblePlayerId: null})} className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md">
                                <option value="Male">Masculina</option>
                                <option value="Female">Feminina</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Buraco de Início</label>
                            <input type="number" value={editingGroup.startHole} onChange={(e) => setEditingGroup({...editingGroup, startHole: e.target.value})} min="1" max="18" required className="w-24 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Jogadores</label>
                        <input type="text" placeholder="Buscar por nome..." value={editSearchTerm} onChange={e => setEditSearchTerm(e.target.value)} className="w-full mb-2 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
                        <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-700 p-2 rounded-md">
                            {editingGroup.availablePlayersForEdit
                               .filter((p: any) => p.gender === editingGroup.category && p.fullName.toLowerCase().includes(editSearchTerm.toLowerCase()))
                               .map((player: any) => (
                                <div key={player.id} className="p-3 bg-gray-700 rounded-lg">
                                    <div className="flex items-center">
                                        <input type="checkbox" id={`edit-cb-${player.id}`} checked={!!editingGroup.selectedPlayers[player.id]} onChange={() => handleEditingPlayerToggle(player)} className="h-4 w-4"/>
                                        <label htmlFor={`edit-cb-${player.id}`} className="ml-3 flex-grow font-medium text-white">{player.fullName}</label>
                                        <input type="radio" name="editResponsiblePlayer" id={`edit-rb-${player.id}`} disabled={!editingGroup.selectedPlayers[player.id]} checked={editingGroup.responsiblePlayerId === player.id.toString()} onChange={() => setEditingGroup({...editingGroup, responsiblePlayerId: player.id.toString()})} className="h-4 w-4"/>
                                    </div>
                                    {editingGroup.selectedPlayers[player.id] && (
                                        <div className="mt-3 pt-3 border-t border-gray-700">
                                            <label className="text-xs text-gray-400">Tee de Saída</label>
                                            <select value={editingGroup.selectedPlayers[player.id].teeColor} onChange={(e) => setEditingGroup({...editingGroup, selectedPlayers: {...editingGroup.selectedPlayers, [player.id]: {...editingGroup.selectedPlayers[player.id], teeColor: e.target.value}}})} required className="w-full mt-1 px-2 py-1.5 border border-gray-600 bg-gray-900 text-white rounded-md text-sm">
                                                <option value="">-- Cor --</option>
                                                {availableTees.map((tee: any) => (<option key={tee.color} value={tee.color}>{tee.color}</option>))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-gray-700">
                    <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                    <Button type="submit">Salvar Alterações</Button>
                </div>
            </form>
        </div>
      )}
    </div>
  );
};

export default ManageGroups;