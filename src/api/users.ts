// ─────────────────────────────────────────────────────────────────────────────
// Endpoints de Usuários (/users) + adapter ApiUser → AppUser (front).
// Usado pelas telas de Administração (Usuários, Organograma, Níveis de Acesso).
// ─────────────────────────────────────────────────────────────────────────────

import { http } from './client';
import { AppUser, UserRole, AccessLevel } from '@/lib/types';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  accessLevel: string | null;
  status?: string;
  terminalId: string | null;
  tacticalManagerId?: string | null;
  allowedModules?: string[];
  allowedTerminals?: string[];
  allowedOccurrenceTypes?: string[];
  phone?: string | null;
  department?: string | null;
}

function adapt(u: ApiUser): AppUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    password: '',
    role: u.role as UserRole,
    linkId: u.terminalId ?? null,
    accessLevel: (u.accessLevel as AccessLevel | null) ?? undefined,
    tacticalManagerId: u.tacticalManagerId ?? undefined,
    allowedModules: u.allowedModules,
    allowedTerminals: u.allowedTerminals,
    allowedOccurrenceTypes: u.allowedOccurrenceTypes,
  };
}

/** Campos aceitos pelo back no create/update de usuário. */
export interface UserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  accessLevel?: string | null;
  terminalId?: string;
  tacticalManagerId?: string | null;
  phone?: string;
  department?: string;
  allowedModules?: string[];
  allowedTerminals?: string[];
  allowedOccurrenceTypes?: string[];
}

export const usersApi = {
  list: async (): Promise<AppUser[]> => {
    const res = await http.get<{ data: ApiUser[] } | ApiUser[]>('/users?limit=200');
    // /users devolve { data, meta } (paginado); o client desembrulha o 1º nível.
    const items = Array.isArray(res) ? res : res.data;
    return items.map(adapt);
  },
  create: async (input: UserInput): Promise<AppUser> =>
    adapt(await http.post<ApiUser>('/users', input)),
  update: async (id: string, input: UserInput): Promise<AppUser> =>
    adapt(await http.put<ApiUser>(`/users/${id}`, input)),
  // Não há delete de usuário no back; inativação é via status (soft delete).
  setStatus: (id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): Promise<unknown> =>
    http.put(`/users/${id}/status`, { status }),
};
