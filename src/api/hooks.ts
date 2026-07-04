// ─────────────────────────────────────────────────────────────────────────────
// Hooks React Query da camada de dados (Fase 4a). Cada recurso tem um query +
// mutations que invalidam o cache no sucesso.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Terminal, Entity } from '@/lib/types';
import { terminalsApi } from './terminals';
import { usersApi, UserInput } from './users';
import { entitiesApi } from './entities';
import { permissionsApi } from './permissions';
import { notificationRulesApi, NotificationRuleInput } from './notification-rules';

const TERMINALS_KEY = ['terminals'];
const USERS_KEY = ['users'];
const ENTITIES_KEY = ['entities'];
const PERMISSIONS_KEY = ['permissions'];
const NOTIFICATION_RULES_KEY = ['notification-rules'];

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

export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: usersApi.list });
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
