// ─────────────────────────────────────────────────────────────────────────────
// Hooks React Query da camada de dados (Fase 4a). Cada recurso tem um query +
// mutations que invalidam o cache no sucesso.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Terminal, Entity, OccurrenceStatus } from '@/lib/types';
import { terminalsApi } from './terminals';
import { usersApi, UserInput } from './users';
import { entitiesApi } from './entities';
import { permissionsApi } from './permissions';
import { notificationRulesApi, NotificationRuleInput } from './notification-rules';
import { occurrencesApi, OccurrenceInput, TimelineEventInput } from './occurrences';
import { dashboardApi } from './dashboard';

const TERMINALS_KEY = ['terminals'];
const USERS_KEY = ['users'];
const ENTITIES_KEY = ['entities'];
const PERMISSIONS_KEY = ['permissions'];
const NOTIFICATION_RULES_KEY = ['notification-rules'];
const OCCURRENCES_KEY = ['occurrences'];
const DASHBOARD_KEY = ['dashboard'];

/* ── Terminais ─────────────────────────────────────────────────────────────── */

export function useTerminals() {
  return useQuery({ queryKey: TERMINALS_KEY, queryFn: terminalsApi.list });
}

export function useTerminalMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: TERMINALS_KEY });
  return {
    create: useMutation({ mutationFn: (form: Omit<Terminal, 'id'>) => terminalsApi.create(form), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; form: Omit<Terminal, 'id'> }) => terminalsApi.update(v.id, v.form), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => terminalsApi.remove(id), onSuccess }),
  };
}

/* ── Usuários ──────────────────────────────────────────────────────────────── */

export function useUsers(enabled = true) {
  return useQuery({ queryKey: USERS_KEY, queryFn: usersApi.list, enabled });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: USERS_KEY });
  return {
    create: useMutation({ mutationFn: (input: UserInput) => usersApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: UserInput }) => usersApi.update(v.id, v.input), onSuccess }),
    setStatus: useMutation({ mutationFn: (v: { id: string; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' }) => usersApi.setStatus(v.id, v.status), onSuccess }),
  };
}

/* ── Entidades ─────────────────────────────────────────────────────────────── */

export function useEntities() {
  return useQuery({ queryKey: ENTITIES_KEY, queryFn: entitiesApi.list });
}

export function useEntityMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ENTITIES_KEY });
  return {
    create: useMutation({ mutationFn: (form: Omit<Entity, 'id'>) => entitiesApi.create(form), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; form: Omit<Entity, 'id'> }) => entitiesApi.update(v.id, v.form), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => entitiesApi.remove(id), onSuccess }),
  };
}

/* ── Permissões ────────────────────────────────────────────────────────────── */

export function usePermissions() {
  return useQuery({ queryKey: PERMISSIONS_KEY, queryFn: permissionsApi.list });
}

export function usePermissionMutations() {
  const qc = useQueryClient();
  return {
    set: useMutation({
      mutationFn: (v: { entityId: string; terminalIds: string[] }) => permissionsApi.set(v.entityId, v.terminalIds),
      onSuccess: () => qc.invalidateQueries({ queryKey: PERMISSIONS_KEY }),
    }),
  };
}

/* ── Ocorrências (Fase 2) ──────────────────────────────────────────────────── */

export function useOccurrences() {
  return useQuery({ queryKey: OCCURRENCES_KEY, queryFn: occurrencesApi.list });
}

/** Emergências ativas (banner global, badge da sidebar, painel mobile). */
export function useActiveEmergencies() {
  const { data: occurrences = [], ...rest } = useOccurrences();
  return { emergencies: occurrences.filter(o => o.status === 'emergência ativa'), occurrences, ...rest };
}

export function useOccurrence(id: string | undefined) {
  return useQuery({
    queryKey: [...OCCURRENCES_KEY, id],
    queryFn: () => occurrencesApi.get(id!),
    enabled: !!id,
  });
}

export function useOccurrenceMutations() {
  const qc = useQueryClient();
  // Toda mutação invalida a lista, o detalhe e os agregados do dashboard/COP.
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: OCCURRENCES_KEY });
    qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };
  return {
    create: useMutation({ mutationFn: (input: OccurrenceInput) => occurrencesApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: Partial<OccurrenceInput> }) => occurrencesApi.update(v.id, v.input), onSuccess }),
    setStatus: useMutation({
      mutationFn: (v: { id: string; status: OccurrenceStatus; comment?: string }) => occurrencesApi.setStatus(v.id, v.status, v.comment),
      onSuccess,
    }),
    addTimeline: useMutation({
      mutationFn: (v: { id: string; input: TimelineEventInput }) => occurrencesApi.addTimeline(v.id, v.input),
      onSuccess,
    }),
    addChecklistItem: useMutation({
      mutationFn: (v: { id: string; text: string }) => occurrencesApi.addChecklistItem(v.id, v.text),
      onSuccess,
    }),
    toggleChecklistItem: useMutation({
      mutationFn: (v: { id: string; itemId: string; done: boolean }) => occurrencesApi.toggleChecklistItem(v.id, v.itemId, v.done),
      onSuccess,
    }),
    addEvidence: useMutation({
      mutationFn: (v: { id: string; filename: string; type?: string; description?: string }) =>
        occurrencesApi.addEvidence(v.id, { filename: v.filename, type: v.type, description: v.description }),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => occurrencesApi.remove(id), onSuccess }),
  };
}

/* ── Dashboard / COP (Fase 2) ──────────────────────────────────────────────── */

export function useDashboardKpis(terminalId?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'kpis', terminalId ?? 'all'],
    queryFn: () => dashboardApi.kpis(terminalId),
  });
}

export function useCopIndicators(terminalId?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'cop', terminalId ?? 'all'],
    queryFn: () => dashboardApi.copIndicators(terminalId),
    refetchInterval: 30_000, // COP é "tempo quase-real" até o Socket.IO (Fase 3)
  });
}

/* ── Acionamento de Entidades (regras) ─────────────────────────────────────── */

export function useNotificationRules() {
  return useQuery({ queryKey: NOTIFICATION_RULES_KEY, queryFn: notificationRulesApi.list });
}

export function useNotificationRuleMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: NOTIFICATION_RULES_KEY });
  return {
    create: useMutation({ mutationFn: (input: NotificationRuleInput) => notificationRulesApi.create(input), onSuccess }),
    setMandatory: useMutation({ mutationFn: (v: { id: string; mandatory: boolean }) => notificationRulesApi.setMandatory(v.id, v.mandatory), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => notificationRulesApi.remove(id), onSuccess }),
  };
}
