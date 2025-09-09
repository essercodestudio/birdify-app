import React, { useState } from 'react';
import Button from '../Button.jsx';

const ManageTournaments = ({ tournaments, courses, onCreateTournament }) => {
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentDate, setNewTournamentDate] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const handleCreateTournament = (e) => {
    e.preventDefault();
    if (newTournamentName.trim() && newTournamentDate && selectedCourseId) {
      onCreateTournament({
        name: newTournamentName,
        date: newTournamentDate,
        courseId: selectedCourseId,
      });
      setNewTournamentName('');
      setNewTournamentDate('');
      setSelectedCourseId('');
    }
  };
  
  const getCourseName = (courseId) => {
    return courses.find(c => c.id === courseId)?.name || 'Campo Desconhecido';
  }

  return (
    <div className="space-y-8">
      {/* Create Tournament Section */}
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Criar Novo Torneio</h3>
        <form onSubmit={handleCreateTournament} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="lg:col-span-1">
            <label htmlFor="tournamentName" className="block text-sm font-medium text-gray-300 mb-1">Nome do Torneio</label>
            <input
              id="tournamentName"
              type="text"
              value={newTournamentName}
              onChange={(e) => setNewTournamentName(e.target.value)}
              placeholder="Ex: Campeonato Aberto"
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>
          <div className="lg:col-span-1">
            <label htmlFor="tournamentDate" className="block text-sm font-medium text-gray-300 mb-1">Data</label>
            <input
              id="tournamentDate"
              type="date"
              value={newTournamentDate}
              onChange={(e) => setNewTournamentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>
           <div className="lg:col-span-1">
            <label htmlFor="tournamentCourse" className="block text-sm font-medium text-gray-300 mb-1">Campo</label>
            <select
              id="tournamentCourse"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Selecione --</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="lg:col-span-1">
            <Button type="submit" className="w-full">Criar Torneio</Button>
          </div>
        </form>
      </div>

      {/* Existing Tournaments List */}
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Torneios Existentes</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-600">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Data</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Campo</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-600">
              {tournaments.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">{new Date(t.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                  <td className="px-4 py-3 text-gray-300">{getCourseName(t.courseId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tournaments.length === 0 && <p className="text-center text-gray-400 py-4">Nenhum torneio criado ainda.</p>}
        </div>
      </div>
    </div>
  );
};

export default ManageTournaments;