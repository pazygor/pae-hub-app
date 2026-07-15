// Endpoints dos domínios de apoio à emergência (Fase 5a):
// Riscos (/risks), Planos (/plans), Mapa (/map-elements) e Documentos (/documents).
// O back devolve o shape exato dos tipos do front (vocabulário pt do DER).
import { http } from './client';
import { Risk, EmergencyPlan, MapElement, PAEDocument } from '@/lib/types';

/* ── Riscos ── */

export interface RiskInput {
  type: string;
  description: string;
  level?: Risk['level'];
  affectedArea?: string;
  date?: string;
  terminalId?: string; // obrigatório para admin
}

export const risksApi = {
  list: (): Promise<Risk[]> => http.get<Risk[]>('/risks'),
  create: (input: RiskInput): Promise<Risk> => http.post<Risk>('/risks', input),
  update: (id: string, input: Partial<RiskInput>): Promise<Risk> => http.put<Risk>(`/risks/${id}`, input),
  remove: (id: string): Promise<unknown> => http.del(`/risks/${id}`),
};

/* ── Planos de Ação ── */

export interface PlanInput {
  name: string;
  description: string;
  responsible?: string;
  checklist?: { text: string; done: boolean }[];
  status?: EmergencyPlan['status'];
  terminalId?: string;
}

export const plansApi = {
  list: (): Promise<EmergencyPlan[]> => http.get<EmergencyPlan[]>('/plans'),
  create: (input: PlanInput): Promise<EmergencyPlan> => http.post<EmergencyPlan>('/plans', input),
  update: (id: string, input: Partial<PlanInput>): Promise<EmergencyPlan> => http.put<EmergencyPlan>(`/plans/${id}`, input),
  remove: (id: string): Promise<unknown> => http.del(`/plans/${id}`),
};

/* ── Elementos do Mapa de Emergência ── */

export interface MapElementInput {
  name: string;
  layerType: MapElement['layerType'];
  lat: number;
  lng: number;
  description?: string;
  terminalId?: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export const mapElementsApi = {
  list: (): Promise<MapElement[]> => http.get<MapElement[]>('/map-elements'),
  create: (input: MapElementInput): Promise<MapElement> => http.post<MapElement>('/map-elements', input),
  update: (id: string, input: Partial<MapElementInput>): Promise<MapElement> => http.put<MapElement>(`/map-elements/${id}`, input),
  remove: (id: string): Promise<unknown> => http.del(`/map-elements/${id}`),
};

/* ── Documentos PAE (só metadados — arquivo real na Fase 6) ── */

export interface DocumentInput {
  title: string;
  docType: PAEDocument['docType'];
  description?: string;
  fileName: string;
  terminalId?: string;
}

export const documentsApi = {
  list: (): Promise<PAEDocument[]> => http.get<PAEDocument[]>('/documents'),
  create: (input: DocumentInput): Promise<PAEDocument> => http.post<PAEDocument>('/documents', input),
  update: (id: string, input: Partial<DocumentInput>): Promise<PAEDocument> => http.put<PAEDocument>(`/documents/${id}`, input),
  remove: (id: string): Promise<unknown> => http.del(`/documents/${id}`),
};
