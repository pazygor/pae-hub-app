// ─────────────────────────────────────────────────────────────────────────────
// Endpoints de autenticação (/auth/*). Usado a partir da Fase 1 pelo AuthContext.
// ─────────────────────────────────────────────────────────────────────────────

import { http, tokenStore } from './client';

/** Usuário como o back-end (pae-api) o devolve. A tradução para o tipo do
 *  front (AppUser) acontece na camada de adapters (Fase 1). */
export interface ApiAuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  terminalId: string | null;
  terminalName?: string;
  organizationId: string;
  organizationName?: string;
  avatarUrl: string | null;
  permissions: string[];
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: ApiAuthUser;
}

export const authApi = {
  /** Faz login, persiste os tokens e devolve o usuário autenticado. */
  login: async (email: string, password: string): Promise<ApiAuthUser> => {
    const res = await http.post<LoginResponse>('/auth/login', { email, password }, { auth: false });
    tokenStore.set(res.accessToken, res.refreshToken);
    return res.user;
  },

  /** Retorna o perfil do usuário do token atual (usado para reidratar a sessão). */
  me: () => http.get<ApiAuthUser>('/auth/me'),

  /** Revoga o refresh token no back e limpa os tokens locais. */
  logout: async (): Promise<void> => {
    const refreshToken = tokenStore.getRefresh();
    try {
      await http.post('/auth/logout', { refreshToken });
    } finally {
      tokenStore.clear();
    }
  },
};
