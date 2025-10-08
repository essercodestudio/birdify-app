import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ManageTournamentDetailsScreen.css';

const ManageTournamentDetailsScreen: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Buscar dados do torneio
  useEffect(() => {
    const fetchTournamentData = async () => {
      try {
        setLoading(true);
        
        // Buscar detalhes do torneio
        const tournamentResponse = await axios.get(`/api/tournaments/${tournamentId}`);
        setTournament(tournamentResponse.data);

        // Buscar perguntas do torneio
        const questionsResponse = await axios.get(`/api/tournaments/${tournamentId}/questions`);
        setQuestions(questionsResponse.data);

        // Buscar inscrições com respostas
        const registrationsResponse = await axios.get(`/api/tournaments/${tournamentId}/registrations-with-answers`);
        setRegistrations(registrationsResponse.data);

      } catch (err) {
        console.error('Erro ao carregar dados do torneio:', err);
        setError('Erro ao carregar dados do torneio');
      } finally {
        setLoading(false);
      }
    };

    if (tournamentId) {
      fetchTournamentData();
    }
  }, [tournamentId]);

  // Função para exportar inscritos para Excel
  const handleExportRegistrations = async () => {
    try {
      const response = await axios.get(`/api/tournaments/${tournamentId}/export-registrations`, {
        responseType: 'blob'
      });
      
      // Criar URL para download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Inscricoes_Torneio_${tournamentId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert('Exportação realizada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar inscrições:', error);
      alert('Erro ao exportar inscrições.');
    }
  };

  // Função para alternar status de pagamento (confirmar/desfazer)
  const handleTogglePaymentStatus = async (registrationId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'confirmed' ? 'pending' : 'confirmed';
      
      await axios.patch(`/api/registrations/${registrationId}/status`, {
        status: newStatus
      });
      
      // Atualizar a lista local
      setRegistrations(prev => prev.map(reg => 
        reg.id === registrationId 
          ? { ...reg, paymentStatus: newStatus }
          : reg
      ));
      
      alert(`Pagamento ${newStatus === 'confirmed' ? 'confirmado' : 'marcado como pendente'} com sucesso!`);
    } catch (error) {
      console.error('Erro ao atualizar status do pagamento:', error);
      alert('Erro ao atualizar status do pagamento.');
    }
  };

  // Função para adicionar nova pergunta
  const handleAddQuestion = async () => {
    const questionText = prompt('Digite a pergunta:');
    if (!questionText) return;

    const questionType = prompt('Tipo da pergunta (TEXT, NUMBER, MULTIPLE_CHOICE):', 'TEXT');
    const isRequired = confirm('A pergunta é obrigatória?');

    try {
      await axios.post(`/api/tournaments/${tournamentId}/questions`, {
        questionText,
        questionType: questionType || 'TEXT',
        isRequired
      });
      
      // Recarregar perguntas
      const questionsResponse = await axios.get(`/api/tournaments/${tournamentId}/questions`);
      setQuestions(questionsResponse.data);
      
      alert('Pergunta adicionada com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar pergunta:', error);
      alert('Erro ao adicionar pergunta.');
    }
  };

  // Função para apagar pergunta
  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm('Tem certeza que deseja apagar esta pergunta?')) return;

    try {
      await axios.delete(`/api/questions/${questionId}`);
      
      // Recarregar perguntas
      const questionsResponse = await axios.get(`/api/tournaments/${tournamentId}/questions`);
      setQuestions(questionsResponse.data);
      
      alert('Pergunta apagada com sucesso!');
    } catch (error) {
      console.error('Erro ao apagar pergunta:', error);
      alert('Erro ao apagar pergunta.');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/admin/tournaments')} className="btn btn-secondary">
          Voltar para Torneios
        </button>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container">
        <div className="error">Torneio não encontrado</div>
        <button onClick={() => navigate('/admin/tournaments')} className="btn btn-secondary">
          Voltar para Torneios
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Cabeçalho */}
      <div className="header">
        <button onClick={() => navigate('/admin/tournaments')} className="btn btn-secondary">
          ← Voltar
        </button>
        <h1>{tournament.name}</h1>
        <div className="tournament-info">
          <p><strong>Data:</strong> {new Date(tournament.date).toLocaleDateString('pt-BR')}</p>
          <p><strong>Campo:</strong> {tournament.courseName}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="tabs">
        <div className="tab active">Inscrições</div>
        <div className="tab">Perguntas</div>
        <div className="tab">Configurações</div>
      </div>

      {/* Conteúdo - Inscrições */}
      <div className="tab-content">
        <div className="section-header">
          <h2>Inscrições ({registrations.length})</h2>
          <div className="actions">
            <button onClick={handleExportRegistrations} className="btn btn-primary">
              📊 Exportar Inscritos
            </button>
          </div>
        </div>

        {registrations.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma inscrição encontrada para este torneio.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="registrations-table">
              <thead>
                <tr>
                  <th>Nome do Jogador</th>
                  <th>Status Pagamento</th>
                  {/* Cabeçalhos dinâmicos para perguntas */}
                  {questions.map(question => (
                    <th key={question.id}>{question.questionText}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registrations.map(registration => (
                  <tr key={registration.id}>
                    <td>{registration.fullName}</td>
                    <td>
                      <button 
                        onClick={() => handleTogglePaymentStatus(registration.id, registration.paymentStatus)}
                        className={`payment-btn ${registration.paymentStatus === 'confirmed' ? 'confirmed' : 'pending'}`}
                        title={registration.paymentStatus === 'confirmed' ? 'Clique para marcar como pendente' : 'Clique para confirmar pagamento'}
                      >
                        {registration.paymentStatus === 'confirmed' ? '✅ Pago' : '❌ Pendente'}
                      </button>
                    </td>
                    {/* Respostas dinâmicas */}
                    {questions.map(question => {
                      const answer = registration.answers?.find((a: any) => a.questionText === question.questionText);
                      return (
                        <td key={question.id}>
                          {answer ? answer.answer : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conteúdo - Perguntas (aba secundária) */}
      <div className="tab-content" style={{ display: 'none' }}>
        <div className="section-header">
          <h2>Perguntas do Formulário ({questions.length})</h2>
          <button onClick={handleAddQuestion} className="btn btn-primary">
            ➕ Adicionar Pergunta
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma pergunta configurada para este torneio.</p>
            <p>Adicione perguntas para personalizar o formulário de inscrição.</p>
          </div>
        ) : (
          <div className="questions-list">
            {questions.map(question => (
              <div key={question.id} className="question-card">
                <div className="question-header">
                  <h3>{question.questionText}</h3>
                  <button 
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="btn btn-danger btn-sm"
                    title="Apagar pergunta"
                  >
                    🗑️
                  </button>
                </div>
                <div className="question-details">
                  <span className="question-type">{question.questionType}</span>
                  <span className={`question-required ${question.isRequired ? 'required' : 'optional'}`}>
                    {question.isRequired ? 'Obrigatório' : 'Opcional'}
                  </span>
                </div>
                {question.options && question.options.length > 0 && (
                  <div className="question-options">
                    <strong>Opções:</strong>
                    <ul>
                      {question.options.map((option: any, index: number) => (
                        <li key={index}>{option.optionText}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo - Configurações (aba secundária) */}
      <div className="tab-content" style={{ display: 'none' }}>
        <div className="section-header">
          <h2>Configurações do Torneio</h2>
        </div>
        
        <div className="settings-form">
          <div className="form-group">
            <label>URL do Banner:</label>
            <input 
              type="text" 
              defaultValue={tournament.bannerImageUrl || ''}
              placeholder="https://exemplo.com/banner.jpg"
            />
          </div>
          
          <div className="form-group">
            <label>Instruções de Pagamento:</label>
            <textarea 
              defaultValue={tournament.paymentInstructions || ''}
              placeholder="Instruções para os jogadores realizarem o pagamento..."
              rows={4}
            />
          </div>
          
          <button className="btn btn-primary">
            💾 Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageTournamentDetailsScreen;