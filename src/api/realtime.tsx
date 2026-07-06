// Ponte de tempo real (Fase 3): assina o Socket.IO do back e invalida os caches
// do React Query — COP/Dashboard/banner/Orquestração/chat atualizam sem refresh.
// O Socket.IO completa o polling de 30s do COP (que permanece como fallback).
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { tokenStore, BASE_URL } from './client';

// http://localhost:3001/api → http://localhost:3001 (namespace raiz do gateway)
const SOCKET_URL = BASE_URL.replace(/\/api\/?$/, '');

export function RealtimeBridge() {
  const { user } = useAuth();
  const qc = useQueryClient();

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

    socket.on('occurrence:created', invalidateOccurrences);
    socket.on('occurrence:updated', invalidateOccurrences);
    socket.on('occurrence:status_changed', invalidateOccurrences);
    socket.on('timeline:added', invalidateOccurrences);
    socket.on('checklist:updated', invalidateOccurrences);
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
  }, [user?.id, qc]);

  return null;
}
