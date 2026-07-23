import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppUser, AppData } from './types';
import { INITIAL_DATA } from './data';
import { authApi, tokenStore } from '@/api';
import { adaptAuthUser } from '@/api/adapters';

/**
 * Contexto de autenticação — Fase 1.C: o usuário é REAL (JWT via pae-api).
 *
 * Nota (strangler): `data`/`setData` continuam servindo o mock (INITIAL_DATA)
 * para as telas ainda não integradas à API. Migram por fase (2, 4, 5a–5d);
 * quando a última tela migrar, esse par sai daqui.
 */
interface AuthContextType {
  user: AppUser | null;
  /** true enquanto reidrata a sessão (token salvo → /auth/me) no load. */
  isLoading: boolean;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  /** Autentica na API. Lança ApiError em falha (401 = credenciais inválidas). */
  login: (email: string, password: string) => Promise<void>;
  /** Reidrata o usuário via /auth/me (ex.: após aceitar o Termo). */
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  // Só há o que reidratar se existir token salvo — evita "flash" de loader
  // para visitantes anônimos.
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !!(tokenStore.getAccess() || tokenStore.getRefresh()),
  );

  // Reidratação da sessão no load (sobrevive a F5/URL digitada).
  useEffect(() => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) return;
    let cancelled = false;
    authApi
      .me()
      .then(apiUser => {
        if (!cancelled) setUser(adaptAuthUser(apiUser));
      })
      .catch(() => {
        // Token inválido/expirado sem refresh possível → sessão limpa.
        tokenStore.clear();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const apiUser = await authApi.login(email, password);
    setUser(adaptAuthUser(apiUser));
  }, []);

  const refreshUser = useCallback(async () => {
    const apiUser = await authApi.me();
    setUser(adaptAuthUser(apiUser));
  }, []);

  const logout = useCallback(() => {
    // Revoga o refresh token no back sem bloquear a UI.
    authApi.logout().catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, data, setData, login, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
