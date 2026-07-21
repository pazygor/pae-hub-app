// ─────────────────────────────────────────────────────────────────────────────
// Hooks React Query da camada de dados (Fase 4a). Cada recurso tem um query +
// mutations que invalidam o cache no sucesso.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Terminal, Entity, OccurrenceStatus, EntityNotificationStatus } from '@/lib/types';
import { terminalsApi } from './terminals';
import { usersApi, UserInput } from './users';
import { entitiesApi } from './entities';
import { permissionsApi } from './permissions';
import { notificationRulesApi, NotificationRuleInput } from './notification-rules';
import { occurrencesApi, OccurrenceInput, TimelineEventInput } from './occurrences';
import { dashboardApi } from './dashboard';
import { entityNotificationsApi } from './entity-notifications';
import { chatApi, SendChatInput } from './chat';
import { risksApi, RiskInput, plansApi, PlanInput, mapElementsApi, MapElementInput, documentsApi, DocumentInput } from './pae-resources';
import { trainingsApi, TrainingInput, AssignTrainingInput, episApi, EpiInput, DeliverEpiInput, complianceApi, ComplianceInput } from './safety';
import { EPIUsageStatus } from '@/lib/types';

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
    updateModules: useMutation({ mutationFn: (v: { id: string; activeModules: string[]; activeSafetySubModules: string[] }) => terminalsApi.updateModules(v.id, { activeModules: v.activeModules, activeSafetySubModules: v.activeSafetySubModules }), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => terminalsApi.remove(id), onSuccess }),
    hardDelete: useMutation({ mutationFn: (id: string) => terminalsApi.hardDelete(id), onSuccess }),
  };
}

/* ── Usuários ──────────────────────────────────────────────────────────────── */

export function useUsers(enabled = true) {
  return useQuery({ queryKey: USERS_KEY, queryFn: usersApi.list, enabled });
}

/** Crachá do PAE — contatos para comunicação rápida (qualquer papel). */
export function useUserContacts() {
  return useQuery({ queryKey: ['user-contacts'], queryFn: usersApi.contacts });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: USERS_KEY });
  return {
    create: useMutation({ mutationFn: (input: UserInput) => usersApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: UserInput }) => usersApi.update(v.id, v.input), onSuccess }),
    setStatus: useMutation({ mutationFn: (v: { id: string; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' }) => usersApi.setStatus(v.id, v.status), onSuccess }),
    hardDelete: useMutation({ mutationFn: (id: string) => usersApi.hardDelete(id), onSuccess }),
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
    hardDelete: useMutation({ mutationFn: (id: string) => entitiesApi.hardDelete(id), onSuccess }),
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
    activatePlan: useMutation({
      mutationFn: (v: { id: string; planId: string }) => occurrencesApi.activatePlan(v.id, v.planId),
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

/* ── Fase 5a — Riscos, Planos, Mapa e Documentos ───────────────────────────── */

const RISKS_KEY = ['risks'];
const PLANS_KEY = ['plans'];
const MAP_ELEMENTS_KEY = ['map-elements'];
const DOCUMENTS_KEY = ['documents'];

export function useRisks() {
  return useQuery({ queryKey: RISKS_KEY, queryFn: risksApi.list });
}

export function useRiskMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: RISKS_KEY });
  return {
    create: useMutation({ mutationFn: (input: RiskInput) => risksApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: Partial<RiskInput> }) => risksApi.update(v.id, v.input), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => risksApi.remove(id), onSuccess }),
  };
}

export function usePlans() {
  return useQuery({ queryKey: PLANS_KEY, queryFn: plansApi.list });
}

export function usePlanMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: PLANS_KEY });
  return {
    create: useMutation({ mutationFn: (input: PlanInput) => plansApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: Partial<PlanInput> }) => plansApi.update(v.id, v.input), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => plansApi.remove(id), onSuccess }),
  };
}

export function useMapElements() {
  return useQuery({ queryKey: MAP_ELEMENTS_KEY, queryFn: mapElementsApi.list });
}

export function useMapElementMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: MAP_ELEMENTS_KEY });
  return {
    create: useMutation({ mutationFn: (input: MapElementInput) => mapElementsApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: Partial<MapElementInput> }) => mapElementsApi.update(v.id, v.input), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => mapElementsApi.remove(id), onSuccess }),
  };
}

export function useDocuments() {
  return useQuery({ queryKey: DOCUMENTS_KEY, queryFn: documentsApi.list });
}

export function useDocumentMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: DOCUMENTS_KEY });
  return {
    create: useMutation({ mutationFn: (input: DocumentInput) => documentsApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: Partial<DocumentInput> }) => documentsApi.update(v.id, v.input), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => documentsApi.remove(id), onSuccess }),
  };
}

/* ── Fase 5b — Segurança Operacional ───────────────────────────────────────── */

const TRAININGS_KEY = ['trainings'];
const TRAINING_ASSIGNMENTS_KEY = ['training-assignments'];
const EPIS_KEY = ['epis'];
const EPI_DELIVERIES_KEY = ['epi-deliveries'];
const COMPLIANCE_KEY = ['compliance'];

export function useTrainings() {
  return useQuery({ queryKey: TRAININGS_KEY, queryFn: trainingsApi.list });
}

export function useTrainingAssignments() {
  return useQuery({ queryKey: TRAINING_ASSIGNMENTS_KEY, queryFn: trainingsApi.assignments });
}

export function useTrainingMutations() {
  const qc = useQueryClient();
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: TRAININGS_KEY });
    qc.invalidateQueries({ queryKey: TRAINING_ASSIGNMENTS_KEY });
  };
  return {
    create: useMutation({ mutationFn: (input: TrainingInput) => trainingsApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: Partial<TrainingInput> }) => trainingsApi.update(v.id, v.input), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => trainingsApi.remove(id), onSuccess }),
    assign: useMutation({ mutationFn: (v: { id: string; input: AssignTrainingInput }) => trainingsApi.assign(v.id, v.input), onSuccess }),
    removeAssignment: useMutation({ mutationFn: (assignmentId: string) => trainingsApi.removeAssignment(assignmentId), onSuccess }),
  };
}

export function useEpis() {
  return useQuery({ queryKey: EPIS_KEY, queryFn: episApi.list });
}

export function useEpiDeliveries() {
  return useQuery({ queryKey: EPI_DELIVERIES_KEY, queryFn: episApi.deliveries });
}

export function useEpiMutations() {
  const qc = useQueryClient();
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: EPIS_KEY });
    qc.invalidateQueries({ queryKey: EPI_DELIVERIES_KEY });
  };
  return {
    create: useMutation({ mutationFn: (input: EpiInput) => episApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: Partial<EpiInput> }) => episApi.update(v.id, v.input), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => episApi.remove(id), onSuccess }),
    deliver: useMutation({ mutationFn: (v: { id: string; input: DeliverEpiInput }) => episApi.deliver(v.id, v.input), onSuccess }),
    updateDelivery: useMutation({
      mutationFn: (v: { deliveryId: string; input: { usageStatus?: EPIUsageStatus; expiryDate?: string; observations?: string } }) =>
        episApi.updateDelivery(v.deliveryId, v.input),
      onSuccess,
    }),
    removeDelivery: useMutation({ mutationFn: (deliveryId: string) => episApi.removeDelivery(deliveryId), onSuccess }),
  };
}

export function useCompliance() {
  return useQuery({ queryKey: COMPLIANCE_KEY, queryFn: complianceApi.list });
}

export function useComplianceMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: COMPLIANCE_KEY });
  return {
    create: useMutation({ mutationFn: (input: ComplianceInput) => complianceApi.create(input), onSuccess }),
    update: useMutation({ mutationFn: (v: { id: string; input: Partial<ComplianceInput> }) => complianceApi.update(v.id, v.input), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => complianceApi.remove(id), onSuccess }),
  };
}

/* ── Acionamento operacional (EntityNotification — Fase 3) ─────────────────── */

const ENTITY_NOTIFICATIONS_KEY = ['entity-notifications'];

export function useEntityNotifications(occurrenceId?: string) {
  return useQuery({
    queryKey: [...ENTITY_NOTIFICATIONS_KEY, occurrenceId ?? 'all'],
    queryFn: () => entityNotificationsApi.list(occurrenceId),
  });
}

export function useEntityNotificationMutations() {
  const qc = useQueryClient();
  return {
    setStatus: useMutation({
      mutationFn: (v: { id: string; status: EntityNotificationStatus }) =>
        entityNotificationsApi.setStatus(v.id, v.status),
      onSuccess: () => qc.invalidateQueries({ queryKey: ENTITY_NOTIFICATIONS_KEY }),
    }),
  };
}

/* ── Chat da ocorrência (ChatMessage — Fase 3) ─────────────────────────────── */

export function useOccurrenceChat(occurrenceId: string | undefined) {
  return useQuery({
    queryKey: ['chat', occurrenceId],
    queryFn: () => chatApi.list(occurrenceId!),
    enabled: !!occurrenceId,
  });
}

export function useChatMutations(occurrenceId: string | undefined) {
  const qc = useQueryClient();
  return {
    send: useMutation({
      mutationFn: (input: SendChatInput) => chatApi.send(occurrenceId!, input),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', occurrenceId] }),
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
