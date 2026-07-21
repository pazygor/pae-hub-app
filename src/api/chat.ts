// Chat da ocorrência (/occurrences/:id/chat) — Fase 3, ChatMessage do DER §6.1.
// Item 10: mensagem pode levar texto (legenda) e/ou anexo (fileId de um FileAsset).
import { http } from './client';
import { ChatMessage } from '@/lib/types';

export interface SendChatInput {
  message?: string;
  fileId?: string;
}

export const chatApi = {
  list: (occurrenceId: string): Promise<ChatMessage[]> =>
    http.get<ChatMessage[]>(`/occurrences/${occurrenceId}/chat`),
  send: (occurrenceId: string, input: SendChatInput): Promise<ChatMessage> =>
    http.post<ChatMessage>(`/occurrences/${occurrenceId}/chat`, input),
};
