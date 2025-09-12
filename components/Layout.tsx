// components/Layout.tsx - ATUALIZADO

import React, { ReactNode, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import GolfPinIcon from './icons/GolfPinIcon';
import Button from './Button';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <header className="bg-gray-800 shadow-lg sticky top-0 z-10">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
          <img src="/logoapp.png" alt="Birdify Logo" className="h-16 w-auto" />
              {/* NOME ALTERADO AQUI */}
              <span className="ml-3 text-2xl font-bold text-white">Birdify</span>
            </div>
            {user && (
              <div className="flex items-center space-x-4">
                 <span className="hidden sm:block text-gray-300">Bem-vindo, {user.fullName.split(' ')[0]}</span>
                 <Button onClick={logout} variant="secondary" size="sm">Sair</Button>
              </div>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="bg-gray-800 text-center py-4 text-sm text-gray-500">
        {/* NOME ALTERADO AQUI */}
        <p>&copy; 2024 Birdify. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default Layout;