// screens/LoginScreen.tsx - ATUALIZADO

import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Button from '../components/Button';
import GolfPinIcon from '../components/icons/GolfPinIcon';
import { User } from '../types';

const LoginScreen: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [gender, setGender] = useState('Male'); 

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleLogin = async (e: React.FormEvent) => { 
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, { email, password });
      const loggedInUser: User = response.data.user;
      login(loggedInUser);
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Não foi possível conectar ao servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !cpf || !email || !password || !gender) { 
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const newPlayerData = { fullName, cpf, email, password, gender };
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/players`, newPlayerData);
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, { email, password });
      const loggedInUser: User = response.data.user;
      login(loggedInUser);
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Não foi possível conectar ao servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 11) {
      setCpf(value);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center">
            <GolfPinIcon className="mx-auto h-12 w-12 text-green-400" />
            <h2 className="mt-6 text-3xl font-extrabold text-white">
                {isRegistering ? 'Crie a sua Conta' : 'Acesse o Birdify'}
            </h2>
        </div>
        <form className="mt-8 space-y-4" onSubmit={isRegistering ? handleRegister : handleLogin}>
            {isRegistering && (
                 <>
                    <input
                        id="full-name"
                        name="fullName"
                        type="text"
                        required
                        className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md"
                        placeholder="Nome Completo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                     <input
                        id="cpf"
                        name="cpf"
                        type="text"
                        required
                        className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md"
                        placeholder="CPF (apenas números)"
                        value={cpf}
                        onChange={handleCpfChange}
                        maxLength={11}
                      />
                    <div>
                        <label htmlFor="gender" className="block text-sm font-medium text-gray-400">Categoria</label>
                        <select
                            id="gender"
                            name="gender"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-700 bg-gray-900 text-white focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                        >
                            <option value="Male">Masculina</option>
                            <option value="Female">Feminina</option>
                        </select>
                    </div>
                 </>
            )}
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md"
              placeholder="Endereço de e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              required
              className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 rounded-md"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <div>
            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isRegistering ? 'Cadastrar' : 'Entrar'}
            </Button>
          </div>
        </form>
         <div className="text-center text-sm">
             <button onClick={() => { setIsRegistering(!isRegistering); setError(null); }} className="font-medium text-green-400 hover:text-green-300">
                {isRegistering ? 'Já tem uma conta? Faça o login' : 'Não tem uma conta? Cadastre-se'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;