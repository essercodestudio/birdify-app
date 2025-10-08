// components/admin/ManageTournaments.tsx - VERSÃO CORRIGIDA

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AdminCourse } from '../../data/mockDatabase';
import Button from '../Button';
import { User } from '../../types';

interface ManageTournamentsProps {
  courses: AdminCourse[];
  adminUser: User | null;
  onManageTournament: (tournament: any) => void; 
}

const ManageTournaments: React.FC<ManageTournamentsProps> = ({ courses, adminUser, onManageTournament }) => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentDate, setNewTournamentDate] = useState('');
  const [newTournamentTime, setNewTournamentTime] = useState('08:30');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newTournamentModality, setNewTournamentModality] = useState('Golf');

  // A função fetchTournaments foi envolvida em useCallback para otimização
  const fetchTournaments = useCallback(async () => {
    if (!adminUser) return;
    setLoading(true); // Inicia o loading aqui
    try {
      // --- ALTERAÇÃO PRINCIPAL AQUI ---
      // Agora passamos o adminId como um parâmetro na requisição GET
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments`, {
          params: { adminId: adminUser.id }
      });
      setTournaments(response.data);
    } catch (error) {
      console.error("Erro ao buscar torneios", error);
    } finally {
      setLoading(false);
    }
  }, [adminUser]); // A função depende do adminUser

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]); // O useEffect agora chama a função memorizada

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTournamentName.trim() && newTournamentDate && selectedCourseId && adminUser) {
      const newTournamentData = {
        name: newTournamentName,
        date: newTournamentDate,
        courseId: parseInt(selectedCourseId, 10),
        startTime: newTournamentTime,
        adminId: adminUser.id,
        modality: newTournamentModality,
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

  return (
    <div className="space-y-8">
      {/* Formulário de Criação de Torneio */}
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Criar Novo Torneio</h3>
        <form onSubmit={handleCreateTournament} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <div className="lg:col-span-2"><input type="text" value={newTournamentName} onChange={e => setNewTournamentName(e.target.value)} placeholder="Nome do Torneio" required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/></div>
            <div><input type="date" value={newTournamentDate} onChange={e => setNewTournamentDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/></div>
            <div><select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"><option value="">-- Campo --</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><select value={newTournamentModality} onChange={e => setNewTournamentModality(e.target.value)} className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"><option value="Golf">Golf</option><option value="Footgolf">Footgolf</option></select></div>
            <Button type="submit" className="w-full">Criar</Button>
        </form>
      </div>

      {/* Tabela de Torneios Existentes */}
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Torneios Criados</h3>
        <div className="overflow-x-auto">
          {loading ? <p>A carregar...</p> : (
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
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3">{new Date(t.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                    <td className="px-4 py-3 text-center space-x-2">
                        <Button size="sm" onClick={() => onManageTournament(t)}>Gerenciar Torneio</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteTournament(t.id)}>Excluir</Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="text-center text-gray-400 py-6">Nenhum torneio criado ainda.</td>
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