// Endpoints de Ocorrências (/occurrences) — Fase 2.
// O back já fala o vocabulário pt-BR do DER; o adapter só ajusta shape (datas → string).
import { http } from './client';
import { Occurrence, OccurrenceStatus, TimelineEvent } from '@/lib/types';

export interface ApiChecklistItem {
  id: string;
  text: string;
  done: boolean;
  completedAt?: string;
  completedBy?: string;
  order: number;
}

export interface ApiEvidence {
  id: string;
  filename: string;
  type: string; // foto | vídeo | documento | áudio | outro
  description?: string;
  createdAt: string;
}

/** Occurrence + campos extras que a API expõe (lista e detalhe). */
export interface ApiOccurrence extends Occurrence {
  terminalName?: string;
  location?: string;
  resolvedAt?: string;
}

export interface OccurrenceDetail extends ApiOccurrence {
  checklist: ApiChecklistItem[];
  evidences: ApiEvidence[];
}

export interface OccurrenceInput {
  type: string;
  description: string;
  status?: OccurrenceStatus;
  criticality?: string;
  severity?: string;
  responsible?: string;
  team?: string;
  location?: string;
  terminalId?: string; // obrigatório para admin
}

export interface TimelineEventInput {
  type: TimelineEvent['type'];
  description: string;
  attachment?: string;
}

const adapt = (o: any): ApiOccurrence => ({
  ...o,
  dateTime: o.dateTime ?? o.createdAt,
  timeline: (o.timeline ?? []) as TimelineEvent[],
});

const adaptDetail = (o: any): OccurrenceDetail => ({
  ...adapt(o),
  checklist: o.checklist ?? [],
  evidences: o.evidences ?? [],
});

export const occurrencesApi = {
  list: async (): Promise<ApiOccurrence[]> => {
    const items = await http.get<any[]>('/occurrences?limit=200');
    return items.map(adapt);
  },
  get: async (id: string): Promise<OccurrenceDetail> =>
    adaptDetail(await http.get<any>(`/occurrences/${id}`)),
  create: async (input: OccurrenceInput): Promise<OccurrenceDetail> =>
    adaptDetail(await http.post<any>('/occurrences', input)),
  update: async (id: string, input: Partial<OccurrenceInput>): Promise<ApiOccurrence> =>
    adapt(await http.put<any>(`/occurrences/${id}`, input)),
  setStatus: async (id: string, status: OccurrenceStatus, comment?: string): Promise<ApiOccurrence> =>
    adapt(await http.put<any>(`/occurrences/${id}/status`, { status, comment })),
  addTimeline: (id: string, input: TimelineEventInput): Promise<TimelineEvent> =>
    http.post<TimelineEvent>(`/occurrences/${id}/timeline`, input),
  addChecklistItem: (id: string, text: string): Promise<ApiChecklistItem> =>
    http.post<ApiChecklistItem>(`/occurrences/${id}/checklist`, { text }),
  toggleChecklistItem: (id: string, itemId: string, done: boolean): Promise<ApiChecklistItem> =>
    http.put<ApiChecklistItem>(`/occurrences/${id}/checklist/${itemId}`, { done }),
  addEvidence: (id: string, input: { filename: string; type?: string; description?: string }): Promise<ApiEvidence> =>
    http.post<ApiEvidence>(`/occurrences/${id}/evidences`, input),
  remove: (id: string): Promise<unknown> => http.del(`/occurrences/${id}`),
};
