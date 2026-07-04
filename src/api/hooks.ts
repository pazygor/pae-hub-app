// ─────────────────────────────────────────────────────────────────────────────
// Hooks React Query da camada de dados (Fase 4a). Cada recurso tem um query +
// mutations que invalidam o cache no sucesso.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Terminal } from '@/lib/types';
import { terminalsApi } from './terminals';
import { usersApi, UserInput } from './users';

const TERMINALS_KEY = ['terminals'];
const USERS_KEY = ['users'];

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
