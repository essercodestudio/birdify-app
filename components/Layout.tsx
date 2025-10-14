// essercodestudio/birdify-app/birdify-app-5edd58081f645dcc34f897e15210f0f29db5dc87/components/Layout.tsx

import React, { ReactNode, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Button from './Button';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <header className="bg-gray-800/80 backdrop-blur-sm shadow-md sticky top-0 z-20 border-b border-gray-700">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img src="/logoapp.png" alt="Birdify Logo" className="h-10 w-auto" />
              <span className="ml-3 text-2xl font-bold text-white tracking-tight">Birdify</span>
            </div>
            {user && (
              <div className="flex items-center space-x-4">
                 <span className="hidden sm:block text-gray-300">
                   Olá, <span className="font-semibold text-white">{user.fullName.split(' ')[0]}</span>
                 </span>
                 <Button onClick={logout} variant="secondary" size="sm">Sair</Button>
              </div>
            )}
          </div>
        </nav>
      </header>
      
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
            {children}
        </div>
      </main>
      
      <footer className="bg-gray-800 text-center py-4 text-sm text-gray-500 border-t border-gray-700">
        <p>&copy; {new Date().getFullYear()} Birdify. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default Layout;