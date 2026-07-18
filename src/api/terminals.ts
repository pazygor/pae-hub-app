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
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  lat: number | null;
  lng: number | null;
  status: string;
  activeModules?: string[];
  activeSafetySubModules?: string[];
}

/** O back já devolve no formato do front (lat/lng); só normaliza nulos. */
function adapt(t: ApiTerminal): Terminal {
  return {
    id: t.id,
    name: t.name,
    responsible: t.responsible ?? '',
    contact: t.contact ?? '',
    location: t.location ?? '',
    cep: t.cep ?? '',
    street: t.street ?? '',
    number: t.number ?? '',
    neighborhood: t.neighborhood ?? '',
    city: t.city ?? '',
    state: t.state ?? '',
    lat: t.lat ?? 0,
    lng: t.lng ?? 0,
    status: (t.status as Terminal['status']) ?? 'Ativo',
    activeModules: t.activeModules ?? [],
    activeSafetySubModules: t.activeSafetySubModules ?? [],
  };
}

function toInput(form: Omit<Terminal, 'id'>) {
  return {
    name: form.name,
    responsible: form.responsible || undefined,
    contact: form.contact || undefined,
    cep: form.cep || undefined,
    street: form.street || undefined,
    number: form.number || undefined,
    neighborhood: form.neighborhood || undefined,
    city: form.city || undefined,
    state: form.state || undefined,
    latitude: form.lat || undefined,
    longitude: form.lng || undefined,
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
  /** Item 7 — configura pacotes/módulos do terminal (Conformidade derivada no back). */
  updateModules: async (id: string, input: { activeModules: string[]; activeSafetySubModules: string[] }): Promise<Terminal> =>
    adapt(await http.put<ApiTerminal>(`/terminals/${id}/modules`, input)),
  remove: (id: string): Promise<unknown> => http.del(`/terminals/${id}`),
  /** Exclusão permanente (admin) — a API bloqueia (409) se houver dados vinculados. */
  hardDelete: (id: string): Promise<unknown> => http.del(`/terminals/${id}/permanent`),
};
