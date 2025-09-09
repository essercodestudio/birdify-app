// components/admin/ManageTournaments.tsx - VERSÃO COM BOTÃO DE FINALIZAR

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AdminCourse } from '../../data/mockDatabase';
import Button from '../Button';

interface ManageTournamentsProps {
  courses: AdminCourse[];
}

const ManageTournaments: React.FC<ManageTournamentsProps> = ({ courses }) => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentDate, setNewTournamentDate] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const fetchTournaments = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/tournaments');
      setTournaments(response.data);
    } catch (error) {
      console.error("Erro ao buscar torneios", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTournamentName.trim() && newTournamentDate && selectedCourseId) {
      const newTournamentData = {
        name: newTournamentName,
        date: newTournamentDate,
        courseId: parseInt(selectedCourseId, 10),
      };
      try {
        await axios.post('http://localhost:3001/api/tournaments', newTournamentData);
        setNewTournamentName('');
        setNewTournamentDate('');
        setSelectedCourseId('');
        fetchTournaments();
      } catch (error) {
        alert('Falha ao criar o torneio.');
        console.error(error);
      }
    }
  };
  
  // NOVA FUNÇÃO para finalizar um torneio
  const handleFinishTournament = async (tournamentId: number) => {
    if(window.confirm('Tem a certeza de que quer finalizar este torneio? Esta ação não pode ser desfeita.')) {
        try {
            await axios.post(`http://localhost:3001/api/tournaments/${tournamentId}/finish`);
            fetchTournaments(); // Recarrega a lista para mostrar o novo status
        } catch (error) {
            alert('Não foi possível finalizar o torneio.');
        }
    }
  };
  
  const handleDeleteTournament = async (tournamentId: number) => {
      if (window.confirm('Tem a certeza de que quer apagar este torneio?')) {
          try {
              await axios.delete(`http://localhost:3001/api/tournaments/${tournamentId}`);
              fetchTournaments();
          } catch (error) {
              alert('Não foi possível apagar o torneio.');
              console.error(error);
          }
      }
  };

  return (
    <div className="space-y-8">
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Criar Novo Torneio</h3>
        <form onSubmit={handleCreateTournament} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="tournamentName" className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input id="tournamentName" type="text" value={newTournamentName} onChange={(e) => setNewTournamentName(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
          </div>
          <div>
            <label htmlFor="tournamentDate" className="block text-sm font-medium text-gray-300 mb-1">Data</label>
            <input id="tournamentDate" type="date" value={newTournamentDate} onChange={(e) => setNewTournamentDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
          </div>
          <div>
            <label htmlFor="tournamentCourse" className="block text-sm font-medium text-gray-300 mb-1">Campo</label>
            <select id="tournamentCourse" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md">
              <option value="">-- Selecione --</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Button type="submit" className="w-full">Criar Torneio</Button>
        </form>
      </div>

      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Torneios Existentes</h3>
        <div className="overflow-x-auto">
          {loading ? <p>A carregar...</p> : (
            <table className="min-w-full divide-y divide-gray-600">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Campo</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Status</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-600">
                {tournaments.map(t => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3">{new Date(t.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                    <td className="px-4 py-3 text-gray-300">{t.courseName}</td>
                    <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${t.status === 'completed' ? 'bg-gray-600 text-gray-200' : 'bg-green-600 text-white'}`}>
                            {t.status === 'completed' ? 'Finalizado' : 'Ativo'}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-center space-x-2">
                        {t.status === 'active' && (
                            <Button size="sm" onClick={() => handleFinishTournament(t.id)}>
                                Finalizar
                            </Button>
                        )}
                        <Button variant="danger" size="sm" onClick={() => handleDeleteTournament(t.id)}>
                            Apagar
                        </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageTournaments;