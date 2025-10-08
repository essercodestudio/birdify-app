import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ManageGroups.css';

interface Tournament {
  id: number;
  name: string;
  date: string;
  courseId: number;
}

interface Player {
  playerId: number;
  registrationId: number;
  fullName: string;
  gender: string;
  paymentStatus: string;
}

interface Group {
  id: number;
  tournamentId: number;
  startHole: number;
  accessCode: string;
  players: Player[];
}

const ManageGroups: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [confirmedPlayers, setConfirmedPlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [startHole, setStartHole] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [adminId, setAdminId] = useState<string>('');

  // Buscar ID do admin do localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setAdminId(user.id);
    }
  }, []);

  // Buscar torneios do admin
  useEffect(() => {
    const fetchTournaments = async () => {
      if (!adminId) return;
      
      try {
        setLoading(true);
        const response = await axios.get(`/api/tournaments?adminId=${adminId}`);
        setTournaments(response.data);
      } catch (error) {
        console.error('Erro ao buscar torneios:', error);
        alert('Erro ao carregar torneios');
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [adminId]);

  // Buscar jogadores confirmados quando selecionar um torneio
  useEffect(() => {
    const fetchConfirmedPlayers = async () => {
      if (!selectedTournament) {
        setConfirmedPlayers([]);
        setGroups([]);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(`/api/tournaments/${selectedTournament}/confirmed-players`);
        setConfirmedPlayers(response.data);
        
        // Buscar grupos existentes
        const groupsResponse = await axios.get(`/api/tournaments/${selectedTournament}/groups`);
        setGroups(groupsResponse.data);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        setConfirmedPlayers([]);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchConfirmedPlayers();
  }, [selectedTournament]);

  // Buscar grupos do torneio
  const fetchGroups = async () => {
    if (!selectedTournament) return;
    
    try {
      const response = await axios.get(`/api/tournaments/${selectedTournament}/groups`);
      setGroups(response.data);
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
    }
  };

  // Alternar seleção de jogador
  const togglePlayerSelection = (playerId: number) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  // Criar novo grupo
  const handleCreateGroup = async () => {
    if (selectedPlayers.length === 0) {
      alert('Selecione pelo menos um jogador para criar o grupo');
      return;
    }

    if (!startHole || startHole < 1 || startHole > 18) {
      alert('Selecione um buraco de início válido (1-18)');
      return;
    }

    try {
      const playersData = selectedPlayers.map(playerId => {
        const player = confirmedPlayers.find(p => p.playerId === playerId);
        return {
          id: playerId,
          teeColor: 'white' // Cor padrão, pode ser ajustada depois
        };
      });

      const response = await axios.post('/api/groups', {
        tournamentId: selectedTournament,
        startHole: startHole,
        players: playersData,
        responsiblePlayerId: selectedPlayers[0], // Primeiro jogador como responsável
        category: 'default'
      });

      alert(`Grupo criado com sucesso! Código de acesso: ${response.data.accessCode}`);
      
      // Limpar seleção e recarregar grupos
      setSelectedPlayers([]);
      fetchGroups();
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      alert('Erro ao criar grupo');
    }
  };

  // Apagar grupo
  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Tem certeza que deseja apagar este grupo?')) return;

    try {
      await axios.delete(`/api/groups/${groupId}`);
      alert('Grupo apagado com sucesso!');
      fetchGroups();
    } catch (error) {
      console.error('Erro ao apagar grupo:', error);
      alert('Erro ao apagar grupo');
    }
  };

  // Finalizar grupo
  const handleFinishGroup = async (groupId: number) => {
    try {
      await axios.post('/api/groups/finish', { groupId });
      alert('Grupo finalizado com sucesso!');
      fetchGroups();
    } catch (error) {
      console.error('Erro ao finalizar grupo:', error);
      alert('Erro ao finalizar grupo');
    }
  };

  return (
    <div className="manage-groups-container">
      <div className="header">
        <h1>Gerenciar Grupos</h1>
        <p>Crie e gerencie grupos de jogadores para os torneios</p>
      </div>

      {/* Seleção de Torneio */}
      <div className="section-card">
        <h2>1. Selecionar Torneio</h2>
        <div className="form-group">
          <label htmlFor="tournament-select">Torneio: </label>
          <select 
            id="tournament-select"
            value={selectedTournament} 
            onChange={(e) => setSelectedTournament(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Selecione um torneio --</option>
            {tournaments.map(tournament => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name} - {new Date(tournament.date).toLocaleDateString('pt-BR')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTournament && (
        <>
          {/* Jogadores Confirmados */}
          <div className="section-card">
            <h2>2. Jogadores com Pagamento Confirmado ({confirmedPlayers.length})</h2>
            {loading ? (
              <div className="loading">Carregando jogadores...</div>
            ) : confirmedPlayers.length > 0 ? (
              <div className="players-grid">
                {confirmedPlayers.map(player => (
                  <div 
                    key={player.registrationId}
                    className={`player-card ${selectedPlayers.includes(player.playerId) ? 'selected' : ''}`}
                    onClick={() => togglePlayerSelection(player.playerId)}
                  >
                    <div className="player-info">
                      <strong>{player.fullName}</strong>
                      <span className="player-gender">{player.gender === 'Male' ? '♂' : '♀'}</span>
                    </div>
                    <div className="player-status confirmed">
                      ✅ Confirmado
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Nenhum jogador com pagamento confirmado para este torneio.</p>
                <p>Os jogadores aparecerão aqui após confirmarem o pagamento.</p>
              </div>
            )}
          </div>

          {/* Criar Novo Grupo */}
          {confirmedPlayers.length > 0 && (
            <div className="section-card">
              <h2>3. Criar Novo Grupo</h2>
              <div className="create-group-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Buraco de Início:</label>
                    <select 
                      value={startHole}
                      onChange={(e) => setStartHole(Number(e.target.value))}
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => (
                        <option key={hole} value={hole}>
                          Buraco {hole}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Jogadores Selecionados:</label>
                    <div className="selected-count">
                      {selectedPlayers.length} jogador(es) selecionado(s)
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleCreateGroup}
                  disabled={selectedPlayers.length === 0}
                  className="btn btn-primary"
                >
                  ➕ Criar Grupo
                </button>
              </div>
            </div>
          )}

          {/* Grupos Existentes */}
          <div className="section-card">
            <h2>Grupos do Torneio ({groups.length})</h2>
            {groups.length > 0 ? (
              <div className="groups-list">
                {groups.map(group => (
                  <div key={group.id} className="group-card">
                    <div className="group-header">
                      <h3>Grupo #{group.id}</h3>
                      <div className="group-actions">
                        <span className="access-code">Código: {group.accessCode}</span>
                        <button 
                          onClick={() => handleFinishGroup(group.id)}
                          className="btn btn-success btn-sm"
                          title="Finalizar grupo"
                        >
                          ✅ Finalizar
                        </button>
                        <button 
                          onClick={() => handleDeleteGroup(group.id)}
                          className="btn btn-danger btn-sm"
                          title="Apagar grupo"
                        >
                          🗑️ Apagar
                        </button>
                      </div>
                    </div>
                    
                    <div className="group-details">
                      <div className="group-info">
                        <span><strong>Buraco:</strong> {group.startHole}</span>
                        <span><strong>Jogadores:</strong> {group.players?.length || 0}</span>
                        <span className={`status ${group.status === 'completed' ? 'completed' : 'active'}`}>
                          {group.status === 'completed' ? '✅ Finalizado' : '🟢 Ativo'}
                        </span>
                      </div>

                      {group.players && group.players.length > 0 && (
                        <div className="group-players">
                          <h4>Jogadores:</h4>
                          <ul>
                            {group.players.map(player => (
                              <li key={player.playerId}>
                                {player.fullName} 
                                {player.isResponsible && <span className="responsible"> 👑</span>}
                                <span className={`tee-color ${player.teeColor?.toLowerCase()}`}>
                                  ({player.teeColor})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Nenhum grupo criado para este torneio.</p>
                <p>Selecione jogadores acima para criar o primeiro grupo.</p>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedTournament && tournaments.length === 0 && !loading && (
        <div className="empty-state">
          <p>Nenhum torneio encontrado.</p>
          <p>Crie torneios primeiro para poder gerenciar grupos.</p>
        </div>
      )}
    </div>
  );
};

export default ManageGroups;