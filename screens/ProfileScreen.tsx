// screens/ProfileScreen.tsx - NOVO FICHEIRO

import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';

const ProfileScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { user, logout, login } = useContext(AuthContext);
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/users/me`, {
                userId: user.id,
                fullName: fullName,
            });
            // Atualiza o utilizador no contexto para refletir a mudança
            const updatedUser = { ...user, fullName: fullName };
            login(updatedUser);
            setSuccess('Nome atualizado com sucesso!');
        } catch (err) {
            setError('Não foi possível atualizar o perfil.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm('Tem a certeza de que quer apagar a sua conta? Esta ação é irreversível.')) {
            try {
                await axios.delete(`${import.meta.env.VITE_API_URL}/api/users/me`, {
                    data: { userId: user.id }
                });
                alert('A sua conta foi apagada com sucesso.');
                logout();
            } catch (error) {
                alert('Não foi possível apagar a sua conta.');
            }
        }
    };

    return (
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl space-y-6">
            <div className="flex items-center">
                <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
                    <ChevronLeftIcon className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-white">Meu Perfil</h1>
                    <p className="text-gray-400">Edite as suas informações ou gira a sua conta.</p>
                </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4 border-t border-gray-700">
                <h2 className="text-xl font-bold text-green-400">Informações Pessoais</h2>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-400">Email</label>
                    <input id="email" type="email" value={user?.email || ''} disabled
                        className="mt-1 w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-400 rounded-md cursor-not-allowed" />
                </div>
                <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-400">Nome Completo</label>
                    <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                        className="mt-1 w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md" />
                </div>
                {success && <p className="text-sm text-green-400">{success}</p>}
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="text-right">
                    <Button type="submit" isLoading={isLoading}>Salvar Alterações</Button>
                </div>
            </form>
            
            <div className="pt-4 border-t border-gray-700">
                <h2 className="text-xl font-bold text-red-400">Zona de Perigo</h2>
                <p className="text-gray-400 mt-2 mb-4">Apagar a sua conta é uma ação permanente e removerá todos os seus dados.</p>
                <Button onClick={handleDeleteAccount} variant="danger">
                    Apagar Minha Conta
                </Button>
            </div>
        </div>
    );
};

export default ProfileScreen;