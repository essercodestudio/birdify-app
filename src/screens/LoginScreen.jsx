import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider.jsx';
import Button from '../components/Button.jsx';
import GolfPinIcon from '../components/icons/GolfPinIcon.jsx';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // A senha não é usada na lógica simulada
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Simula uma chamada de API
    setTimeout(() => {
      // Validação de e-mail simples para demonstração
      if (email === 'admin@pinehillscore.com' || email === 'scorer@pinehillscore.com') {
        login(email);
        navigate('/');
      } else {
        setError('Credenciais inválidas. Use "admin@pinehillscore.com" ou "scorer@pinehillscore.com".');
        setIsLoading(false);
      }
    }, 500);
  };

  const handlePresetLogin = (presetEmail) => {
    setEmail(presetEmail);
    setPassword('password'); // mock password
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center">
            <GolfPinIcon className="mx-auto h-12 w-12 text-green-400" />
            <h2 className="mt-6 text-3xl font-extrabold text-white">
                Acesse o Pine Hill Score
            </h2>
        </div>
        <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
              placeholder="Endereço de e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <div>
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Entrar
            </Button>
          </div>
        </form>
         <div className="text-center text-sm text-gray-400 pt-4 border-t border-gray-700">
            <p className="font-semibold">Use uma conta de demonstração:</p>
            <div className="flex justify-center space-x-4 mt-2">
                 <button onClick={() => handlePresetLogin('scorer@pinehillscore.com')} className="underline hover:text-green-400">Marcador (Player)</button>
                 <button onClick={() => handlePresetLogin('admin@pinehillscore.com')} className="underline hover:text-green-400">Admin</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;