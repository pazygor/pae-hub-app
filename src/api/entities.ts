// Endpoints de Entidades externas (/entities) — Fase 4b.
import { http } from './client';
import { Entity } from '@/lib/types';

interface ApiEntity {
  id: string;
  name: string;
  type: string;
  contact: string;
  status: string;
}

function adapt(e: ApiEntity): Entity {
  return { id: e.id, name: e.name, type: e.type, contact: e.contact ?? '', status: (e.status as Entity['status']) ?? 'Ativo' };
}

export const entitiesApi = {
  list: async (): Promise<Entity[]> => (await http.get<ApiEntity[]>('/entities')).map(adapt),
  create: async (form: Omit<Entity, 'id'>): Promise<Entity> => adapt(await http.post<ApiEntity>('/entities', form)),
  update: async (id: string, form: Omit<Entity, 'id'>): Promise<Entity> => adapt(await http.put<ApiEntity>(`/entities/${id}`, form)),
  remove: (id: string): Promise<unknown> => http.del(`/entities/${id}`),
};
