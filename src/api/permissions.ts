// Endpoints de Permissões entidade × terminais (/permissions) — Fase 4b.
import { http } from './client';
import { Permission } from '@/lib/types';

export const permissionsApi = {
  list: (): Promise<Permission[]> => http.get<Permission[]>('/permissions'),
  set: (entityId: string, terminalIds: string[]): Promise<Permission> =>
    http.put<Permission>(`/permissions/${entityId}`, { terminalIds }),
};
