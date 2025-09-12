import React, { useState, useMemo, useEffect } from "react";
import { User } from "./types";
import { AuthContext } from "./context/AuthContext";
import LoginScreen from "./screens/LoginScreen";
import MainScreen from "./screens/MainScreen";
import Layout from "./components/Layout";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    // Ao carregar, tenta ler o utilizador do localStorage
    try {
      const storedUser = localStorage.getItem("birdifyUser");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      return null;
    }
  });

  // Este efeito sincroniza o estado 'user' com o localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem("birdifyUser", JSON.stringify(user));
    } else {
      localStorage.removeItem("birdifyUser");
    }
  }, [user]);

  const authContextValue = useMemo(
    () => ({
      user,
      login: (loggedInUser: User) => setUser(loggedInUser),
      logout: () => setUser(null),
    }),
    [user]
  );

  return (
    <AuthContext.Provider value={authContextValue}>
      <Layout>{user ? <MainScreen /> : <LoginScreen />}</Layout>
    </AuthContext.Provider>
  );
};

export default App;
