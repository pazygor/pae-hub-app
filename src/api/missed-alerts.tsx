// Alertas perdidos (re-hidratação no login): o RealtimeBridge só cobre quem está
// com o app aberto quando a ocorrência é criada (Socket.IO). Este bridge cobre o
// resto — ao logar, compara as ocorrências (já escopadas por papel/terminal no
// back) com o `alertsSeenAt` do usuário e re-alerta as NÃO RESOLVIDAS que ele
// ainda não viu: todas entram no sino e o modal mostra a mais crítica.
// O `alertsSeenAt` é atualizado pelo OccurrenceAlertModal ao fechar o alerta.
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNotifications, NotifLevel } from '@/lib/notifications';
import { occurrencesApi, ApiOccurrence } from './occurrences';

const CRITICALITY_ORDER: Record<string, number> = { 'crítica': 3, 'alta': 2, 'média': 1, 'baixa': 0 };

const levelOf = (o: ApiOccurrence): NotifLevel | null =>
  (o.severity || o.criticality || null) as NotifLevel | null;

export function MissedAlertsBridge() {
  const { user } = useAuth();
  const { add, showAlert } = useNotifications();
  // Roda uma vez por sessão de usuário (reseta no logout para cobrir re-login na mesma aba).
  const processedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { processedFor.current = null; return; }
    if (processedFor.current === user.id) return;
    processedFor.current = user.id;

    let cancelled = false;
    (async () => {
      try {
        const occurrences = await occurrencesApi.list();
        if (cancelled) return;

        // alertsSeenAt nulo = nunca marcou → alerta tudo que segue em aberto.
        const seenAt = user.alertsSeenAt ? new Date(user.alertsSeenAt).getTime() : 0;
        const missed = occurrences.filter(o =>
          o.status !== 'resolvido' &&
          o.reportedByUserId !== user.id &&
          new Date(o.dateTime).getTime() > seenAt,
        );
        if (missed.length === 0) return;

        // Todas para o sino (add() dedupa por ocorrência)…
        for (const o of missed) {
          add({
            occurrenceId: o.id, incNumber: o.incNumber,
            title: `Nova ocorrência ${o.incNumber ?? ''}`.trim(),
            subtitle: [o.type, o.terminalName].filter(Boolean).join(' · ') || (o.incNumber ?? ''),
            level: levelOf(o), kind: 'occurrence',
          });
        }

        // …e o modal mostra a mais crítica (desempate: mais recente).
        const top = [...missed].sort((a, b) =>
          (CRITICALITY_ORDER[b.criticality] ?? 0) - (CRITICALITY_ORDER[a.criticality] ?? 0) ||
          new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
        )[0];
        showAlert({
          occurrenceId: top.id, incNumber: top.incNumber, type: top.type,
          description: top.description, terminalName: top.terminalName,
          level: levelOf(top), extraCount: missed.length - 1,
        });
      } catch {
        // Silencioso: sem API o login segue normal; o realtime cobre dali em diante.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, add, showAlert]);

  return null;
}
