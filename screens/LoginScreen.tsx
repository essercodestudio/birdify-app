// screens/LoginScreen.tsx - VERSÃO FINAL E COMPLETA

import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import { User } from '../types';

const LoginScreen: React.FC = () => {
    const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>('LOGIN');
    
    // Estados do formulário
    const [modality, setModality] = useState<'Golf' | 'Footgolf'>('Golf');
    const [club, setClub] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState('Male'); 

    const [clubList, setClubList] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useContext(AuthContext);

    useEffect(() => {
        const fetchClubs = async () => {
            if (view !== 'REGISTER') return;
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/clubs`, {
                    params: { modality }
                });
                setClubList(response.data.map((item: { name: string }) => item.name));
            } catch (error) {
                console.error("Erro ao buscar a lista de clubes", error);
                setClubList([]);
            }
        };
        fetchClubs();
    }, [modality, view]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, { email, password });
            login(response.data.user);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Não foi possível conectar ao servidor.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        const newPlayerData = { fullName, email, password, gender, modality, club };
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/players`, newPlayerData);
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, { email, password });
            login(response.data.user);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Não foi possível conectar ao servidor.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/forgot-password`, { email });
            setSuccessMessage(response.data.message);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ocorreu um erro.');
        } finally {
            setIsLoading(false);
        }
    };

    // Função que renderiza o formulário correto
    const renderForm = () => {
        if (view === 'FORGOT_PASSWORD') {
            return (
                <form className="mt-8 space-y-4" onSubmit={handleForgotPassword}>
                    <p className="text-center text-gray-300">Por favor, insira o seu email para receber um link de redefinição de senha.</p>
                    <input id="email-address" name="email" type="email" autoComplete="email" required className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md" placeholder="Endereço de e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <div><Button type="submit" className="w-full" isLoading={isLoading}>Enviar Link</Button></div>
                </form>
            );
        }

        if (view === 'REGISTER') {
            return (
                <form className="mt-8 space-y-4" onSubmit={handleRegister}>
                    <input id="full-name" name="fullName" type="text" required className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md" placeholder="Nome Completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Modalidade</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <button type="button" onClick={() => setModality('Golf')} className={`flex-1 px-4 py-2 text-sm rounded-l-md transition-colors ${modality === 'Golf' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Golf</button>
                            <button type="button" onClick={() => setModality('Footgolf')} className={`flex-1 px-4 py-2 text-sm rounded-r-md transition-colors ${modality === 'Footgolf' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Footgolf</button>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="club" className="block text-sm font-medium text-gray-400">Clube (Opcional)</label>
                        <select id="club" value={club} onChange={e => setClub(e.target.value)} className="mt-1 block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white rounded-md">
                            <option value="">-- Selecione o seu clube --</option>
                            {clubList.map(clubName => (<option key={clubName} value={clubName}>{clubName}</option>))}
                            <option value="Outro">Outro (Não listado)</option>
                        </select>
                    </div>
                    <input id="email-address" name="email" type="email" autoComplete="email" required className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md" placeholder="Endereço de e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input id="password" name="password" type="password" autoComplete="new-password" required className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <div className="flex items-start text-sm">
                        <input id="terms" name="terms" type="checkbox" required className="h-4 w-4 mt-1 rounded border-gray-600 bg-gray-700 text-green-600 focus:ring-green-500" />
                        <label htmlFor="terms" className="ml-2 text-gray-400">Eu li e concordo com os <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Termos de Uso</a> e a <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Política de Privacidade</a>.</label>
                    </div>
                    <div><Button type="submit" className="w-full" isLoading={isLoading}>Cadastrar</Button></div>
                </form>
            );
        }

        return ( // LOGIN View
            <form className="mt-8 space-y-4" onSubmit={handleLogin}>
                <input id="email-address" name="email" type="email" autoComplete="email" required className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md" placeholder="Endereço de e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input id="password" name="password" type="password" autoComplete="current-password" required className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="text-right text-sm"><button type="button" onClick={() => setView('FORGOT_PASSWORD')} className="font-medium text-green-400 hover:text-green-300">Esqueceu a senha?</button></div>
                <div><Button type="submit" className="w-full" isLoading={isLoading}>Entrar</Button></div>
            </form>
        );
    };

    const getTitle = () => {
        if (view === 'REGISTER') return 'Crie a sua Conta';
        if (view === 'FORGOT_PASSWORD') return 'Redefinir Senha';
        return 'Acesse o Birdify';
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg">
                <div className="text-center">
                    <img src="/logoapp.png" alt="Birdify Logo" className="mx-auto h-20 w-auto mb-6" />
                    <h2 className="mt-6 text-3xl font-extrabold text-white">{getTitle()}</h2>
                </div>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                {successMessage && <p className="text-sm text-green-400 text-center">{successMessage}</p>}
                {renderForm()}
                <div className="text-center text-sm">
                    {view !== 'LOGIN' && (<button onClick={() => { setView('LOGIN'); setError(null); }} className="font-medium text-green-400 hover:text-green-300 mr-4">Fazer Login</button>)}
                    {view !== 'REGISTER' && (<button onClick={() => { setView('REGISTER'); setError(null); }} className="font-medium text-green-400 hover:text-green-300">Não tem uma conta? Cadastre-se</button>)}
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;