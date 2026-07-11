// Ponte de tempo real (Fase 3): assina o Socket.IO do back e invalida os caches
// do React Query — COP/Dashboard/banner/Orquestração/chat atualizam sem refresh.
// Também dispara as NOTIFICAÇÕES (sino + modal + som) por relevância ao usuário.
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useNotifications, NotifLevel } from '@/lib/notifications';
import { tokenStore, BASE_URL } from './client';

// http://localhost:3001/api → http://localhost:3001 (namespace raiz do gateway)
const SOCKET_URL = BASE_URL.replace(/\/api\/?$/, '');

/** Payload enriquecido de occurrence:created / notification:created (back). */
interface OccurrencePush {
  occurrenceId: string;
  incNumber?: string | null;
  actorId?: string | null;
  type?: string | null;
  description?: string | null;
  severity?: string | null;
  criticality?: string | null;
  terminalId?: string | null;
  terminalName?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  mandatory?: boolean;
}

const levelOf = (p: OccurrencePush): NotifLevel | null =>
  (p.severity || p.criticality || null) as NotifLevel | null;

export function RealtimeBridge() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { add, showAlert } = useNotifications();

  useEffect(() => {
    if (!user) return;

    const socket: Socket = io(SOCKET_URL, {
      auth: { token: tokenStore.getAccess() },
      transports: ['websocket', 'polling'],
    });

    const invalidateOccurrences = () => {
      qc.invalidateQueries({ queryKey: ['occurrences'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    };

    // Terminais que o usuário enxerga (relevância da notificação):
    // - admin: todos; terminal: casa + adicionais; entity: terminais da Permissão
    //   (chegam no user.allowedTerminals via login/getMe).
    const seesTerminal = (terminalId?: string | null): boolean => {
      if (!terminalId) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'terminal') {
        return terminalId === user.linkId || (user.allowedTerminals?.includes(terminalId) ?? false);
      }
      // entity
      return user.allowedTerminals?.includes(terminalId) ?? false;
    };

    // Nova ocorrência (QUALQUER tipo) → admin, time do terminal E entidades com
    // permissão no terminal. Dispara sino + modal + som (menos para quem criou).
    socket.on('occurrence:created', (p: OccurrencePush) => {
      invalidateOccurrences();
      if (!(user.role === 'admin' || seesTerminal(p.terminalId))) return;
      const level = levelOf(p);
      const subtitle = [p.type, p.terminalName].filter(Boolean).join(' · ') || (p.incNumber ?? '');
      add({
        occurrenceId: p.occurrenceId, incNumber: p.incNumber,
        title: `Nova ocorrência ${p.incNumber ?? ''}`.trim(), subtitle, level, kind: 'occurrence',
      });
      // Modal + som só para quem NÃO criou (o autor já vê o toast de sucesso).
      // O som (loop) é iniciado/parado pelo próprio modal, conforme ele abre/fecha.
      if (p.actorId !== user.id) {
        showAlert({
          occurrenceId: p.occurrenceId, incNumber: p.incNumber, type: p.type,
          description: p.description, terminalName: p.terminalName, level, mandatory: p.mandatory,
        });
      }
    });

    socket.on('occurrence:updated', invalidateOccurrences);
    socket.on('occurrence:status_changed', invalidateOccurrences);
    socket.on('timeline:added', invalidateOccurrences);
    socket.on('checklist:updated', invalidateOccurrences);

    // Acionamento formal (NotificationRule × Permission) — a notificação visual da
    // entidade já vem por occurrence:created; aqui só sincroniza os caches.
    socket.on('notification:created', () => {
      qc.invalidateQueries({ queryKey: ['entity-notifications'] });
      invalidateOccurrences();
    });
    socket.on('notification:updated', () => qc.invalidateQueries({ queryKey: ['entity-notifications'] }));
    socket.on('chat:message', (d: { occurrenceId?: string }) => {
      qc.invalidateQueries({ queryKey: ['chat', d?.occurrenceId] });
    });

    return () => {
      socket.disconnect();
    };
    // Reconecta ao trocar de usuário (token novo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, qc, add, showAlert]);

  return null;
}
