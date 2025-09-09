// src/screens/AdminDashboardScreen.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../data/mockDatabase.js'; // Usaremos os dados mockados para o que ainda não vem da API
import ManageCourses from '../components/admin/ManageCourses.jsx';
import ManageTournaments from '../components/admin/ManageTournaments.jsx';
import ManageGroups from '../components/admin/ManageGroups.jsx';
import Button from '../components/Button.jsx';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon.jsx';

const AdminDashboardScreen = () => {
  const navigate = useNavigate();

  // Estados para gerir os dados (ainda usaremos alguns dados mockados)
  const [holes, setHoles] = useState(db.holes);
  const [tees, setTees] = useState(db.tees);
  const [tournaments, setTournaments] = useState(db.tournaments);
  const [players, setPlayers] = useState(db.players);
  const [groups, setGroups] = useState(db.groups);
  const [groupPlayers, setGroupPlayers] = useState(db.groupPlayers);
  
  // Lógica para o sistema de abas
  const [activeTab, setActiveTab] = useState('courses');

  // Funções de exemplo para criação (não as vamos ligar à API ainda)
  const handleCreateCourse = (courseData, imageFile, holesData) => {
    console.log("Criar curso (simulado):", courseData);
  };
  const handleCreateTeesForHole = (holeId, teeData) => {
     console.log("Criar tee (simulado):", teeData);
  };
  const handleCreateTournament = (tournamentData) => {
     console.log("Criar torneio (simulado):", tournamentData);
  };
  const handleCreateGroup = (data) => {
    console.log("Criar grupo (simulado):", data);
    return "MOCKCODE";
  };

  const TabButton = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        activeTab === tabName
          ? 'bg-green-600 text-white'
          : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl space-y-6">
      <div className="flex items-center">
        <Button onClick={() => navigate('/')} variant="secondary" size="icon" className="mr-4">
          <ChevronLeftIcon className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">Painel de Administração</h1>
          <p className="text-gray-400">Gerencie os dados do seu torneio.</p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 border-b border-gray-700 pb-3">
        <TabButton tabName="courses" label="Gerenciar Campos" />
        <TabButton tabName="tournaments" label="Gerenciar Torneios" />
        <TabButton tabName="groups" label="Gerenciar Grupos" />
      </div>

      <div>
        {activeTab === 'courses' && (
          <ManageCourses
            // Note que já não passamos a prop "courses"
            holes={holes}
            tees={tees}
            onCreateCourse={handleCreateCourse}
            onCreateTeeForHole={handleCreateTeesForHole}
          />
        )}
        {activeTab === 'tournaments' && (
            <ManageTournaments
                tournaments={tournaments}
                // Esta prop é necessária para o componente ManageTournaments
                courses={db.courses} // Temporariamente usamos o mock aqui
                onCreateTournament={handleCreateTournament}
            />
        )}
        {activeTab === 'groups' && (
            <ManageGroups
                tournaments={tournaments}
                players={players}
                groups={groups}
                groupPlayers={groupPlayers}
                holes={holes}
                tees={tees}
                onCreateGroup={handleCreateGroup}
            />
        )}
      </div>
    </div>
  );
};

export default AdminDashboardScreen;