// screens/AdminDashboardScreen.tsx - VERSÃO COM GESTÃO UNIFICADA

import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ManageCourses from '../components/admin/ManageCourses';
import ManageTournaments from '../components/admin/ManageTournaments';
import ManageGroups from '../components/admin/ManageGroups';
import ManageRegistrations from '../components/admin/ManageRegistrations';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import { AdminCourse } from '../data/mockDatabase';

interface AdminDashboardScreenProps {
  onBack: () => void;
}

type AdminView = 'TABS' | 'REGISTRATIONS';
type AdminTab = 'courses' | 'tournaments' | 'groups';

const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onBack }) => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [view, setView] = useState<AdminView>('TABS');
    const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<AdminTab>('tournaments');
    const [courses, setCourses] = useState<AdminCourse[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);

    const fetchCoursesForPanel = useCallback(async () => {
        if (!user) return;
        setLoadingCourses(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/courses`, {
                params: { adminId: user.id }
            });
            setCourses(response.data);
        } catch (error) {
            console.error("Erro ao buscar campos para o painel:", error);
        } finally {
            setLoadingCourses(false);
        }
    }, [user]);

    useEffect(() => {
        fetchCoursesForPanel();
    }, [fetchCoursesForPanel]);

    const handleManageTournament = (tournament: any) => {
        setSelectedTournament(tournament);
        setView('REGISTRATIONS');
    };

    const handleBackToTabs = () => {
        setSelectedTournament(null);
        setView('TABS');
        // Re-busca os torneios caso alguma informação tenha sido alterada
        fetchCoursesForPanel(); 
    };

    const TabButton: React.FC<{ tabName: AdminTab; label: string }> = ({ tabName, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tabName ? 'bg-green-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
        >
            {label}
        </button>
    );

    if (view === 'REGISTRATIONS' && selectedTournament) {
        return (
            <ManageRegistrations
                tournament={selectedTournament}
                onBack={handleBackToTabs}
            />
        );
    }

    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl space-y-6">
            <div className="flex items-center">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
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
                        onCourseCreated={fetchCoursesForPanel}
                        adminUser={user}
                    />
                )}
                {activeTab === 'tournaments' && (
                    loadingCourses ? <p>A carregar campos...</p> :
                        <ManageTournaments
                            courses={courses}
                            adminUser={user}
                            onManageTournament={handleManageTournament}
                        />
                )}
                {activeTab === 'groups' && (
                    <ManageGroups />
                )}
            </div>
        </div>
    );
};

export default AdminDashboardScreen;