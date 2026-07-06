// Chat da ocorrência (/occurrences/:id/chat) — Fase 3, ChatMessage do DER §6.1.
import { http } from './client';
import { ChatMessage } from '@/lib/types';

export const chatApi = {
  list: (occurrenceId: string): Promise<ChatMessage[]> =>
    http.get<ChatMessage[]>(`/occurrences/${occurrenceId}/chat`),
  send: (occurrenceId: string, message: string): Promise<ChatMessage> =>
    http.post<ChatMessage>(`/occurrences/${occurrenceId}/chat`, { message }),
};
