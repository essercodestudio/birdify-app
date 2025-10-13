import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// import "./ManageTournamentDetailsScreen.css";

interface Tournament {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  max_participants: number;
  sport_type: string;
}

interface Player {
  id: number;
  fullName: string;
  email: string;
  phone: string;
}

interface Registration {
  id: number;
  player_id: number;
  tournament_id: number;
  payment_status: string;
  registration_date: string;
  player: Player;
  answers?: Answer[];
}

interface Answer {
  question_text: string;
  answer_text: string;
}

interface ManageTournamentDetailsScreenProps {
  tournament: Tournament;
  onBack: () => void;
}

const ManageTournamentDetailsScreen: React.FC<ManageTournamentDetailsScreenProps> = ({ tournament, onBack }) => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tournament?.id) {
      fetchRegistrations(tournament.id);
    }
  }, [tournament]);

 const fetchRegistrations = async (tournamentId: number) => {
    try {
      console.log('🔄 Buscando inscrições para torneio:', tournamentId);
      const response = await axios.get(`http://localhost:3001/api/tournaments/${tournamentId}/registrations`);
      console.log('✅ Resposta da API:', response.data);
      setRegistrations(response.data);
    } catch (error: any) {
      console.error('❌ ERRO COMPLETO:', error);
      console.error('❌ Response data:', error.response?.data);
      setError('Erro ao carregar inscrições: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleExportRegistrations = async () => {
    try {
      if (!tournament) return;

      const response = await axios.get(
        `http://localhost:3001/api/tournaments/${tournament.id}/export-registrations`,
        {
          responseType: 'blob',
        }
      );

      // Criar URL para download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inscritos_torneio_${tournament.id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      
      // Limpar
      link.remove();
      window.URL.revokeObjectURL(url);

      alert('Exportação realizada com sucesso!');

    } catch (error: any) {
      console.error('Erro ao exportar inscrições:', error);
      alert('Erro ao exportar inscrições: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePaymentStatusToggle = async (registrationId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'confirmed' ? 'pending' : 'confirmed';
      
      await axios.patch(`http://localhost:3001/api/registrations/${registrationId}/status`, {
        status: newStatus
      });

      // Atualizar lista local
      setRegistrations(prev => prev.map(reg => 
        reg.id === registrationId 
          ? { ...reg, payment_status: newStatus }
          : reg
      ));

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status de pagamento');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) return <div className="loading">Carregando...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!tournament) return <div className="error">Torneio não encontrado</div>;

  return (
    <div className="manage-tournament-details">
      <div className="header">
        <h1>{tournament.name}</h1>
        <div className="actions">
          <button 
            className="export-button"
            onClick={handleExportRegistrations}
            disabled={!tournament?.id}
          >
            📊 Exportar Inscritos
          </button>
          <button 
            className="back-button"
            onClick={onBack}
          >
            Voltar
          </button>
        </div>
      </div>

      <div className="tournament-info">
        <p><strong>Descrição:</strong> {tournament.description}</p>
        <p><strong>Data:</strong> {formatDate(tournament.start_date)} até {formatDate(tournament.end_date)}</p>
        <p><strong>Local:</strong> {tournament.location}</p>
        <p><strong>Esporte:</strong> {tournament.sport_type}</p>
        <p><strong>Máximo de participantes:</strong> {tournament.max_participants}</p>
      </div>

      <div className="registrations-section">
        <h2>Inscrições ({registrations.length})</h2>
        
        {registrations.length === 0 ? (
          <p>Nenhuma inscrição encontrada.</p>
        ) : (
          <div className="table-container">
            <table className="registrations-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Telefone</th>
                  <th>Data Inscrição</th>
                  <th>Status Pagamento</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(registration => (
                  <tr key={registration.id}>
                    <td>{registration.player.fullName}</td>
                    <td>{registration.player.email}</td>
                    <td>{registration.player.phone}</td>
                    <td>{formatDate(registration.registration_date)}</td>
                    <td>
                      <span className={`status ${registration.payment_status}`}>
                        {registration.payment_status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`payment-toggle ${registration.payment_status}`}
                        onClick={() => handlePaymentStatusToggle(registration.id, registration.payment_status)}
                      >
                        {registration.payment_status === 'confirmed' ? '✅' : '❌'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageTournamentDetailsScreen;