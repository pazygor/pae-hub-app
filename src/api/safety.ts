// Endpoints da Segurança Operacional (Fase 5b):
// Treinamentos (/trainings), EPIs (/epis) e Conformidade (/compliance).
// Datas são normalizadas para YYYY-MM-DD (formato que as telas exibem).
import { http } from './client';
import { Training, UserTraining, EPI, UserEPI, ComplianceItem, EPIUsageStatus, ComplianceStatus } from '@/lib/types';

const day = (v?: string | null): any => (v ? String(v).slice(0, 10) : v ?? null);

/* ── Treinamentos ── */

export interface TrainingInput {
  name: string;
  description?: string;
  mandatory?: boolean;
  materialFileName?: string;
  videoUrl?: string;
  terminalIds?: string[];
}

export interface AssignTrainingInput {
  userIds: string[];
  completedDate?: string;
  expiryDate?: string;
  certificate?: string;
}

const adaptUserTraining = (ut: any): UserTraining => ({
  ...ut,
  completedDate: day(ut.completedDate),
  expiryDate: day(ut.expiryDate),
});

export const trainingsApi = {
  list: (): Promise<Training[]> => http.get<Training[]>('/trainings'),
  assignments: async (): Promise<UserTraining[]> =>
    (await http.get<any[]>('/trainings/assignments')).map(adaptUserTraining),
  create: (input: TrainingInput): Promise<Training> => http.post<Training>('/trainings', input),
  update: (id: string, input: Partial<TrainingInput>): Promise<Training> =>
    http.put<Training>(`/trainings/${id}`, input),
  remove: (id: string): Promise<unknown> => http.del(`/trainings/${id}`),
  assign: async (id: string, input: AssignTrainingInput): Promise<UserTraining[]> =>
    (await http.post<any[]>(`/trainings/${id}/assignments`, input)).map(adaptUserTraining),
  removeAssignment: (assignmentId: string): Promise<unknown> =>
    http.del(`/trainings/assignments/${assignmentId}`),
};

/* ── EPIs ── */

export interface EpiInput {
  name: string;
  description?: string;
  epiType: EPI['epiType'];
  expiryDate?: string;
  terminalIds?: string[];
}

export interface DeliverEpiInput {
  userIds: string[];
  deliveryDate?: string;
  expiryDate?: string;
  responsible?: string;
  observations?: string;
}

const adaptEpi = (e: any): EPI => ({ ...e, expiryDate: day(e.expiryDate) });
const adaptDelivery = (ue: any): UserEPI => ({
  ...ue,
  deliveryDate: day(ue.deliveryDate),
  expiryDate: day(ue.expiryDate),
  returnDate: ue.returnDate ? day(ue.returnDate) : undefined,
});

export const episApi = {
  list: async (): Promise<EPI[]> => (await http.get<any[]>('/epis')).map(adaptEpi),
  deliveries: async (): Promise<UserEPI[]> =>
    (await http.get<any[]>('/epis/deliveries')).map(adaptDelivery),
  create: async (input: EpiInput): Promise<EPI> => adaptEpi(await http.post<any>('/epis', input)),
  update: async (id: string, input: Partial<EpiInput>): Promise<EPI> =>
    adaptEpi(await http.put<any>(`/epis/${id}`, input)),
  remove: (id: string): Promise<unknown> => http.del(`/epis/${id}`),
  deliver: async (id: string, input: DeliverEpiInput): Promise<UserEPI[]> =>
    (await http.post<any[]>(`/epis/${id}/deliveries`, input)).map(adaptDelivery),
  updateDelivery: async (
    deliveryId: string,
    input: { usageStatus?: EPIUsageStatus; expiryDate?: string; observations?: string },
  ): Promise<UserEPI> => adaptDelivery(await http.put<any>(`/epis/deliveries/${deliveryId}`, input)),
  removeDelivery: (deliveryId: string): Promise<unknown> => http.del(`/epis/deliveries/${deliveryId}`),
};

/* ── Conformidade ── */

export interface ComplianceInput {
  name: string;
  responsible: string;
  status?: ComplianceStatus;
  expiryDate?: string;
  userId?: string;
  notes?: string;
  terminalIds?: string[];
  area?: string;
  verificationDate?: string;
}

const adaptCompliance = (i: any): ComplianceItem => ({
  ...i,
  expiryDate: day(i.expiryDate),
  verificationDate: day(i.verificationDate),
});

export const complianceApi = {
  list: async (): Promise<ComplianceItem[]> => (await http.get<any[]>('/compliance')).map(adaptCompliance),
  create: async (input: ComplianceInput): Promise<ComplianceItem> =>
    adaptCompliance(await http.post<any>('/compliance', input)),
  update: async (id: string, input: Partial<ComplianceInput>): Promise<ComplianceItem> =>
    adaptCompliance(await http.put<any>(`/compliance/${id}`, input)),
  remove: (id: string): Promise<unknown> => http.del(`/compliance/${id}`),
};
