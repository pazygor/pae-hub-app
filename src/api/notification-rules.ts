// Endpoints de Acionamento de Entidades (/notification-rules) — Fase 4b.
import { http } from './client';
import { NotificationRule } from '@/lib/types';

export interface NotificationRuleInput {
  occurrenceType: string;
  entityId: string;
  mandatory?: boolean;
}

export const notificationRulesApi = {
  list: (): Promise<NotificationRule[]> => http.get<NotificationRule[]>('/notification-rules'),
  create: (input: NotificationRuleInput): Promise<NotificationRule> =>
    http.post<NotificationRule>('/notification-rules', input),
  setMandatory: (id: string, mandatory: boolean): Promise<NotificationRule> =>
    http.put<NotificationRule>(`/notification-rules/${id}`, { mandatory }),
  remove: (id: string): Promise<unknown> => http.del(`/notification-rules/${id}`),
};
