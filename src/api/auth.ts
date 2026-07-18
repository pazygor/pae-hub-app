// ─────────────────────────────────────────────────────────────────────────────
// Endpoints de autenticação (/auth/*). Usado a partir da Fase 1 pelo AuthContext.
// ─────────────────────────────────────────────────────────────────────────────

import { http, tokenStore } from './client';

/** Usuário como o back-end (pae-api) o devolve — contrato alinhado ao DER
 *  (Fase 1 do guia de alinhamento). A tradução para o tipo do front (AppUser)
 *  acontece em src/api/adapters.ts. */
export interface ApiAuthUser {
  id: string;
  name: string;
  email: string;
  role: string; // 'admin' | 'terminal' | 'entity'
  accessLevel: string | null; // 'estratégico' | 'tático' | 'operacional'
  status?: string;
  linkId: string | null;
  terminalName?: string;
  tacticalManagerId?: string | null;
  organizationId: string;
  organizationName?: string;
  avatarUrl: string | null;
  alertsSeenAt?: string | null;
  allowedModules?: string[];
  allowedTerminals?: string[];
  allowedOccurrenceTypes?: string[];
  modules?: { active: string[]; safetySubModules: string[] };
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

  /** Marca os alertas de ocorrência como vistos — o próximo login só re-alerta o que vier depois. */
  markAlertsSeen: () => http.post<{ alertsSeenAt: string }>('/auth/alerts-seen', {}),

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
