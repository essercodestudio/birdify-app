
import React, { useState, useMemo } from 'react';
import { User } from './types';
import { AuthContext } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import Layout from './components/Layout';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  const authContextValue = useMemo(() => ({
    user,
    login: (loggedInUser: User) => setUser(loggedInUser),
    logout: () => setUser(null),
  }), [user]);

  return (
    <AuthContext.Provider value={authContextValue}>
      <Layout>
        {user ? <MainScreen /> : <LoginScreen />}
      </Layout>
    </AuthContext.Provider>
  );
};

export default App;
