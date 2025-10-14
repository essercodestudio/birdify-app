// essercodestudio/birdify-app/birdify-app-5edd58081f645dcc34f897e15210f0f29db5dc87/components/admin/ManageTournaments.tsx
// VERSÃO COMPLETA E CORRIGIDA

import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { AdminCourse } from '../../data/mockDatabase';
import Button from '../Button';
import { User } from '../../types';
import { AuthContext } from '../../context/AuthContext';
import Spinner from '../Spinner'; // Certifique-se que o Spinner está a ser importado

interface ManageTournamentsProps {
  courses: AdminCourse[];
  onManageTournament: (tournament: any) => void; 
}

const ManageTournaments: React.FC<ManageTournamentsProps> = ({ courses, onManageTournament }) => {
  const { user: adminUser } = useContext(AuthContext);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentDate, setNewTournamentDate] = useState('');
  const [newTournamentTime, setNewTournamentTime] = useState('08:30');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const fetchTournaments = useCallback(async () => {
    if (!adminUser) return;
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments`, {
          params: { adminId: adminUser.id }
      });
      // Filtra para mostrar apenas torneios com status diferente de 'completed'
      setTournaments(response.data.filter((t: any) => t.status !== 'completed'));
    } catch (error) {
      console.error("Erro ao buscar torneios", error);
    } finally {
      setLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTournamentName.trim() && newTournamentDate && selectedCourseId && adminUser) {
      const newTournamentData = {
        name: newTournamentName,
        date: newTournamentDate,
        courseId: parseInt(selectedCourseId, 10),
        startTime: newTournamentTime,
        adminId: adminUser.id,
        categories: [], 
      };
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/tournaments`, newTournamentData);
        setNewTournamentName('');
        setNewTournamentDate('');
        setSelectedCourseId('');
        fetchTournaments();
      } catch (error) {
        alert('Falha ao criar o torneio.');
      }
    }
  };
  
    const handleFinishTournament = async (tournamentId: number) => {
      if (window.confirm('Tem a certeza de que quer finalizar este torneio? Após finalizado, ele será movido para o histórico e não poderá mais ser editado.')) {
          try {
              await axios.post(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}/finish`);
              alert('Torneio finalizado com sucesso!');
              fetchTournaments(); // Atualiza a lista
          } catch (error) {
              alert('Não foi possível finalizar o torneio.');
              console.error(error);
          }
      }
  };
  
  const handleDeleteTournament = async (tournamentId: number) => {
      if (window.confirm('Tem a certeza de que quer apagar este torneio? Esta ação é irreversível e apagará todos os grupos e inscrições associadas.')) {
          try {
              await axios.delete(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournamentId}`);
              fetchTournaments();
          } catch (error) {
              alert('Não foi possível apagar o torneio.');
          }
      }
  };
  
  const inputStyle = "w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";


  return (
    <div className="space-y-8">
      <div className="p-6 bg-gray-800 rounded-lg shadow-xl">
        <h3 className="text-xl font-bold text-green-400 mb-4">Criar Novo Torneio de Golf</h3>
        <form onSubmit={handleCreateTournament} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="lg:col-span-1"><input type="text" value={newTournamentName} onChange={e => setNewTournamentName(e.target.value)} placeholder="Nome do Torneio" required className={inputStyle}/></div>
            <div><input type="date" value={newTournamentDate} onChange={e => setNewTournamentDate(e.target.value)} required className={inputStyle}/></div>
            <div><select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} required className={inputStyle}><option value="">-- Campo --</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <Button type="submit" className="w-full">Criar</Button>
        </form>
      </div>

      <div className="p-6 bg-gray-800 rounded-lg shadow-xl">
        <h3 className="text-xl font-bold text-green-400 mb-4">Torneios Ativos</h3>
        <div className="overflow-x-auto">
          {loading ? (
            <Spinner />
          ) : (
            <table className="min-w-full divide-y divide-gray-600">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Data</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-600">
                {tournaments.length > 0 ? tournaments.map(t => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                    <td className="px-4 py-3 text-gray-300">{new Date(t.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                    <td className="px-4 py-3 text-center space-x-2">
                        <Button size="sm" onClick={() => onManageTournament(t)}>
                          Gerenciar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleFinishTournament(t.id)}>
                            Finalizar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteTournament(t.id)}>
                            Excluir
                        </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="text-center text-gray-400 py-6">Nenhum torneio ativo.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageTournaments;