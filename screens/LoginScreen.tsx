// essercodestudio/birdify-app/birdify-app-5edd58081f645dcc34f897e15210f0f29db5dc87/screens/LoginScreen.tsx
// VERSÃO COMPLETA E FINAL COM CORREÇÃO VISUAL DIRETA

import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import { User } from '../types';

const LoginScreen: React.FC = () => {
    const [view, setView] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>('LOGIN');
    
    // Estados dos formulários
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState('Male'); 
    
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useContext(AuthContext);

    // COMENTÁRIO: Estilo de input definido como uma constante para garantir consistência e forçar o tema escuro.
    const inputStyle = "appearance-none block w-full px-4 py-2.5 border border-[#2E4A37] bg-[#0D1B12] text-[#E6F5E6] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent sm:text-sm rounded-lg transition-colors";

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, { email, password });
            if (response.data.success) {
                login(response.data.user as User);
            } else {
                setError(response.data.error || 'Ocorreu um erro.');
            }
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
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/players`, { fullName, email, password, gender, club: '' });
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, { email, password });
            login(response.data.user as User);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Não foi possível realizar o registo.');
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

    const getTitle = () => {
        if (view === 'REGISTER') return 'Crie a sua Conta';
        if (view === 'FORGOT_PASSWORD') return 'Recuperar Senha';
        return 'Bem-vindo de Volta';
    };

    const renderForm = () => {
        if (view === 'FORGOT_PASSWORD') {
            return (
                <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
                    <p className="text-center text-[#C7D1C9]">Insira o seu email para receber um link de redefinição de senha.</p>
                    <input name="email" type="email" autoComplete="email" required className={inputStyle} placeholder="Endereço de e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <div><Button type="submit" className="w-full" isLoading={isLoading}>Enviar Link</Button></div>
                </form>
            );
        }

        if (view === 'REGISTER') {
            return (
                <form className="mt-8 space-y-4" onSubmit={handleRegister}>
                    <input name="fullName" type="text" required className={inputStyle} placeholder="Nome Completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    <select value={gender} onChange={e => setGender(e.target.value)} className={inputStyle}>
                        <option value="Male">Masculino</option>
                        <option value="Female">Feminino</option>
                    </select>
                    <input name="email" type="email" autoComplete="email" required className={inputStyle} placeholder="Endereço de e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input name="password" type="password" autoComplete="new-password" required className={inputStyle} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <div className="flex items-start text-sm pt-2">
                        <input id="terms" name="terms" type="checkbox" required className="h-4 w-4 mt-1 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500" />
                        <label htmlFor="terms" className="ml-2 text-slate-400">Eu li e concordo com os <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Termos de Uso</a> e a <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Política de Privacidade</a>.</label>
                    </div>
                    <div className="pt-2"><Button type="submit" className="w-full" isLoading={isLoading}>Criar Conta</Button></div>
                </form>
            );
        }

        return ( // LOGIN View
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                <input name="email" type="email" autoComplete="email" required className={inputStyle} placeholder="Endereço de e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input name="password" type="password" autoComplete="current-password" required className={inputStyle} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="text-right text-sm">
                    <button type="button" onClick={() => { setView('FORGOT_PASSWORD'); setError(null); }} className="font-semibold text-[#22C55E] hover:text-[#15803D] transition-colors">
                        Esqueceu a senha?
                    </button>
                </div>
                <div><Button type="submit" className="w-full" isLoading={isLoading}>Entrar</Button></div>
            </form>
        );
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="w-full max-w-md p-8 space-y-6 card">
                <div className="text-center">
                    <img src="/logoapp.png" alt="Birdify Logo" className="mx-auto h-20 w-auto mb-4" />
                    <h2 className="mt-4 text-3xl font-extrabold text-white">{getTitle()}</h2>
                    <p className="mt-2 text-[#C7D1C9]">
                        {view === 'LOGIN' && 'Insira as suas credenciais para aceder.'}
                        {view === 'REGISTER' && 'Preencha os seus dados para começar.'}
                        {view === 'FORGOT_PASSWORD' && 'Insira o seu email para recuperar o acesso.'}
                    </p>
                </div>

                {error && <p className="text-sm text-red-400 text-center bg-red-900/50 p-3 rounded-lg">{error}</p>}
                {successMessage && <p className="text-sm text-green-400 text-center bg-green-900/50 p-3 rounded-lg">{successMessage}</p>}
                
                {renderForm()}
                
                <div className="text-center text-sm pt-4 border-t border-[#2E4A37]">
                    {view === 'LOGIN' ? (
                        <p className="text-[#C7D1C9]">
                            Não tem uma conta?{' '}
                            <button onClick={() => { setView('REGISTER'); setError(null); }} className="font-semibold text-[#22C55E] hover:text-[#15803D] transition-colors">
                                Cadastre-se
                            </button>
                        </p>
                    ) : (
                        <p className="text-[#C7D1C9]">
                            Já tem uma conta?{' '}
                            <button onClick={() => { setView('LOGIN'); setError(null); }} className="font-semibold text-[#22C55E] hover:text-[#15803D] transition-colors">
                                Fazer Login
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;