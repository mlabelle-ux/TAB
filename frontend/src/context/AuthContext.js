import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('admin');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(!!admin);

  useEffect(() => {
    if (admin) {
      localStorage.setItem('admin', JSON.stringify(admin));
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('admin');
      setIsAuthenticated(false);
    }
  }, [admin]);

  const login = (adminData) => {
    setAdmin(adminData);
  };

  const logout = () => {
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
