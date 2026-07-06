// Endpoints de Acionamento operacional (/entity-notifications) — Fase 3.
// EntityNotification (DER §6.3): criada AUTOMATICAMENTE pelo back ao abrir uma
// ocorrência cujo tipo casa com NotificationRule × Permission.
import { http } from './client';
import { EntityNotification, EntityNotificationStatus } from '@/lib/types';

export interface ApiEntityNotification extends EntityNotification {
  entityName?: string;
  incNumber?: string;
}

export const entityNotificationsApi = {
  list: (occurrenceId?: string): Promise<ApiEntityNotification[]> =>
    http.get<ApiEntityNotification[]>(
      `/entity-notifications${occurrenceId ? `?occurrenceId=${occurrenceId}` : ''}`,
    ),
  setStatus: (id: string, status: EntityNotificationStatus): Promise<ApiEntityNotification> =>
    http.put<ApiEntityNotification>(`/entity-notifications/${id}/status`, { status }),
};
