import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppUser, AppData } from './types';
import { INITIAL_DATA } from './data';

interface AuthContextType {
  user: AppUser | null;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [data, setData] = useState<AppData>(INITIAL_DATA);

  const login = useCallback((email: string, password: string) => {
    const found = data.users.find(u => u.email === email && u.password === password);
    if (found) {
      setUser(found);
      return true;
    }
    return false;
  }, [data.users]);

  const logout = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, data, setData, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
