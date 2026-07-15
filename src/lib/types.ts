import { TerminalModuleConfig } from './modules';

export type UserRole = 'admin' | 'terminal' | 'entity';
export type AccessLevel = 'estratégico' | 'operacional' | 'tático';

export const ALL_MODULES = [
  'cop', 'dashboard', 'terminals', 'entities', 'users', 'permissions',
  'risks', 'plans', 'occurrences', 'map', 'documents', 'badge', 'about', 'orchestration',
  'safety', 'trainings', 'epis', 'compliance',
] as const;
export type ModuleId = typeof ALL_MODULES[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  cop: 'Centro de Operações',
  dashboard: 'Dashboard',
  terminals: 'Terminais',
  entities: 'Entidades',
  users: 'Usuários',
  permissions: 'Permissões',
  risks: 'Riscos',
  plans: 'Planos de Ação',
  occurrences: 'Ocorrências',
  map: 'Mapa de Emergência',
  documents: 'Documentos',
  badge: 'Crachá do PAE',
  about: 'Sobre o Sistema',
  orchestration: 'Orquestração de Emergência',
  safety: 'Segurança Operacional',
  trainings: 'Treinamentos',
  epis: 'EPIs',
  compliance: 'Conformidade',
};

export interface Terminal {
  id: string;
  name: string;
  responsible: string;
  contact: string;
  location: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  status: 'Ativo' | 'Inativo' | 'Revisão';
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  contact: string;
  status: 'Ativo' | 'Inativo';
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  linkId: string | null;
  accessLevel?: AccessLevel;
  tacticalManagerId?: string;
  phone?: string;
  /** Último "visto" dos alertas de ocorrência (re-hidratação no login). */
  alertsSeenAt?: string | null;
  allowedModules?: string[];
  allowedTerminals?: string[];
  allowedOccurrenceTypes?: string[];
}

export interface Permission {
  entityId: string;
  terminalIds: string[];
}

export interface NotificationRule {
  id: string;
  occurrenceType: string;
  entityId: string;
  mandatory: boolean;
}

export type EntityNotificationStatus = 'Notificada' | 'Confirmada' | 'Pendente' | 'Em Atendimento';

export interface EntityNotification {
  id: string;
  occurrenceId: string;
  entityId: string;
  dateTime: string;
  status: EntityNotificationStatus;
  mandatory: boolean;
  confirmedAt?: string;
  respondingAt?: string;
  dispatchedBy?: string;
}

export type RiskLevel = 'baixo' | 'médio' | 'alto';
export type PlanStatus = 'ativo' | 'inativo' | 'em revisão';
export type OccurrenceStatus = 'aberto' | 'em atendimento' | 'emergência ativa' | 'resolvido';
export type OccurrenceCriticality = 'baixa' | 'média' | 'alta' | 'crítica';

export type TimelineEventType =
  | 'ocorrência registrada'
  | 'equipe acionada'
  | 'plano de emergência ativado'
  | 'entidade notificada'
  | 'ação executada'
  | 'atualização de status'
  | 'ocorrência resolvida';

export interface TimelineEvent {
  id: string;
  dateTime: string;
  type: TimelineEventType;
  description: string;
  userName: string;
  attachment?: string; // file name placeholder
}

export interface Risk {
  id: string;
  terminalId: string;
  type: string;
  description: string;
  level: RiskLevel;
  affectedArea: string;
  date: string;
  lat?: number;
  lng?: number;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface EmergencyPlan {
  id: string;
  terminalId: string;
  name: string;
  description: string;
  responsible: string;
  checklist: { text: string; done: boolean }[];
  status: PlanStatus;
  riskIds?: string[];
}

export type SeverityLevel = 'baixa' | 'média' | 'alta';

export interface Occurrence {
  id: string;
  incNumber: string;
  terminalId: string;
  dateTime: string;
  type: string;
  description: string;
  status: OccurrenceStatus;
  criticality: OccurrenceCriticality;
  severity?: SeverityLevel;
  responsible: string;
  team: string;
  timeline: TimelineEvent[];
}

export type DocumentType = 'Plano de Ação de Emergência' | 'Rotas de evacuação' | 'Contatos de emergência' | 'Plantas operacionais' | 'Procedimentos operacionais' | 'Outros';

export interface PAEDocument {
  id: string;
  title: string;
  docType: DocumentType;
  description: string;
  fileName: string;
  terminalId: string;
  uploadDate: string;
  userName: string;
}

export type MapLayerType = 'fire_equipment' | 'hydrant' | 'evacuation_route' | 'risk_area' | 'meeting_point';

export interface MapElement {
  id: string;
  name: string;
  layerType: MapLayerType;
  lat: number;
  lng: number;
  description: string;
  terminalId: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface ChatMessage {
  id: string;
  occurrenceId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  message: string;
  dateTime: string;
}

/* ── Treinamentos ── */
export interface Training {
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
  materialFileName?: string;
  videoUrl?: string;
  terminalId?: string;
}

export interface UserTraining {
  id: string;
  trainingId: string;
  userId: string;
  completedDate: string;
  expiryDate: string;
  certificate?: string;
}

/* ── EPIs ── */
export type EPIType = 'proteção_cabeça' | 'proteção_ocular' | 'proteção_auditiva' | 'proteção_respiratória' | 'proteção_mãos' | 'proteção_pés' | 'proteção_corpo' | 'proteção_quedas' | 'outro';

export const EPI_TYPE_LABELS: Record<EPIType, string> = {
  proteção_cabeça: 'Proteção da Cabeça',
  proteção_ocular: 'Proteção Ocular/Facial',
  proteção_auditiva: 'Proteção Auditiva',
  proteção_respiratória: 'Proteção Respiratória',
  proteção_mãos: 'Proteção das Mãos',
  proteção_pés: 'Proteção dos Pés',
  proteção_corpo: 'Proteção do Corpo',
  proteção_quedas: 'Proteção contra Quedas',
  outro: 'Outro',
};

export type EPIUsageStatus = 'entregue' | 'em_uso' | 'devolvido' | 'vencido' | 'substituido';

export const EPI_USAGE_LABELS: Record<EPIUsageStatus, string> = {
  entregue: 'Entregue',
  em_uso: 'Em Uso',
  devolvido: 'Devolvido',
  vencido: 'Vencido',
  substituido: 'Substituído',
};

export interface EPI {
  id: string;
  name: string;
  description: string;
  epiType: EPIType;
  expiryDate: string | null;
  terminalId?: string;
}

export interface UserEPI {
  id: string;
  epiId: string;
  userId: string;
  deliveryDate: string;
  expiryDate: string | null;
  responsible: string;
  observations: string;
  usageStatus: EPIUsageStatus;
  returnDate?: string;
}

export interface EPITimelineEvent {
  id: string;
  userEpiId: string;
  type: 'entrega' | 'renovação' | 'vencimento' | 'em_uso' | 'devolução' | 'troca';
  date: string;
  description: string;
}

export type ComplianceStatus = 'conforme' | 'atencao' | 'nao_conforme';

export interface ComplianceItem {
  id: string;
  name: string;
  responsible: string;
  status: ComplianceStatus;
  expiryDate: string | null;
  userId: string | null;
  notes: string;
  terminalId: string | null;
  area: string;
  verificationDate: string | null;
}

export interface AppData {
  terminals: Terminal[];
  entities: Entity[];
  users: AppUser[];
  permissions: Permission[];
  notificationRules: NotificationRule[];
  entityNotifications: EntityNotification[];
  risks: Risk[];
  plans: EmergencyPlan[];
  occurrences: Occurrence[];
  documents: PAEDocument[];
  mapElements: MapElement[];
  chatMessages: ChatMessage[];
  trainings: Training[];
  userTrainings: UserTraining[];
  epis: EPI[];
  userEPIs: UserEPI[];
  complianceItems: ComplianceItem[];
  terminalModules: TerminalModuleConfig[];
}
