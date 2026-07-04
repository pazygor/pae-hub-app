// ─────────────────────────────────────────────────────────────────────────────
// Endpoints de Terminais (/terminals) + adapter ApiTerminal → Terminal (front).
// ─────────────────────────────────────────────────────────────────────────────

import { http } from './client';
import { Terminal } from '@/lib/types';

interface ApiTerminal {
  id: string;
  name: string;
  code?: string;
  responsible: string;
  contact: string;
  location: string;
  lat: number | null;
  lng: number | null;
  status: string;
}

/** O back já devolve no formato do front (lat/lng); só normaliza nulos. */
function adapt(t: ApiTerminal): Terminal {
  return {
    id: t.id,
    name: t.name,
    responsible: t.responsible ?? '',
    contact: t.contact ?? '',
    location: t.location ?? '',
    lat: t.lat ?? 0,
    lng: t.lng ?? 0,
    status: (t.status as Terminal['status']) ?? 'Ativo',
  };
}

function toInput(form: Omit<Terminal, 'id'>) {
  return {
    name: form.name,
    responsible: form.responsible || undefined,
    contact: form.contact || undefined,
    location: form.location || undefined,
    latitude: form.lat,
    longitude: form.lng,
    status: form.status,
  };
}

export const terminalsApi = {
  list: async (): Promise<Terminal[]> => {
    const items = await http.get<ApiTerminal[]>('/terminals');
    return items.map(adapt);
  },
  create: async (form: Omit<Terminal, 'id'>): Promise<Terminal> =>
    adapt(await http.post<ApiTerminal>('/terminals', toInput(form))),
  update: async (id: string, form: Omit<Terminal, 'id'>): Promise<Terminal> =>
    adapt(await http.put<ApiTerminal>(`/terminals/${id}`, toInput(form))),
  remove: (id: string): Promise<unknown> => http.del(`/terminals/${id}`),
};
