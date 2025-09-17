// screens/ResetPasswordScreen.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/Button';

const ResetPasswordScreen: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas não correspondem.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/reset-password`, { token, password });
            setSuccessMessage(response.data.message + ' Você será redirecionado para o login em 5 segundos.');
            setTimeout(() => { navigate('/login'); }, 5000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ocorreu um erro ao redefinir a senha.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg">
                <div className="text-center">
                    <img src="/logoapp.png" alt="Birdify Logo" className="mx-auto h-20 w-auto mb-6" />
                    <h2 className="mt-6 text-3xl font-extrabold text-white">Crie a sua Nova Senha</h2>
                </div>
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                {successMessage && <p className="text-sm text-green-400 text-center">{successMessage}</p>}
                {!successMessage && (
                    <form className="mt-8 space-y-4" onSubmit={handleResetPassword}>
                        <input id="password" name="password" type="password" required
                            className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md"
                            placeholder="Nova Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <input id="confirm-password" name="confirmPassword" type="password" required
                            className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md"
                            placeholder="Confirme a Nova Senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                        <div>
                            <Button type="submit" className="w-full" isLoading={isLoading}>Redefinir Senha</Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
export default ResetPasswordScreen;