import React, { useState, useMemo, createContext, useContext } from 'react';

export const AuthContext = createContext({
  user: null,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (email) => {
    // Lógica de login SIMULADA. Substitua pela sua chamada de API real.
    // Com base no e-mail, definimos um usuário de teste.
    if (email === 'admin@pinehillscore.com') {
      setUser({
        fullName: 'Admin User',
        email: 'admin@pinehillscore.com',
        role: 'admin',
      });
    } else {
       setUser({
        fullName: 'Jordan Spieth',
        email: 'scorer@pinehillscore.com',
        role: 'player',
      });
    }
  };

  const logout = () => {
    // Lógica de logout SIMULADA.
    setUser(null);
  };

  // O uso de useMemo evita recriações desnecessárias do objeto de contexto
  const authContextValue = useMemo(() => ({
    user,
    login,
    logout,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook customizado para facilitar o acesso ao contexto de autenticação
export const useAuth = () => {
    return useContext(AuthContext);
}