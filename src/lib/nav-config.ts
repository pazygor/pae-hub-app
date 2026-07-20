// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de navegação: menu (sidebar), rotas, guards, busca global e
// títulos de página derivam DESTA lista. Substitui as 3 listas duplicadas
// (menuItems do sidebar, viewLabels do PAESystem e NAV_ITEMS do GlobalSearch).
// ─────────────────────────────────────────────────────────────────────────────

import {
  LayoutDashboard, Ship, Shield, Users, Lock, AlertTriangle, FileText, Siren,
  MapPin, Radio, FolderOpen, Info, IdCard, ShieldCheck, Bell, Activity,
  GraduationCap, HardHat, ClipboardCheck, Puzzle, UserCircle, Network, Brain, History,
} from 'lucide-react';
import { UserRole, AppUser } from '@/lib/types';

export interface NavItem {
  /** id legado da view — usado pelo access-control e licenciamento de módulos */
  id: string;
  /** rota (URL) da tela */
  path: string;
  /** rótulo do menu lateral e da busca */
  label: string;
  /** título exibido no header (quando difere do label) */
  headerLabel?: string;
  icon: React.ElementType;
  roles: UserRole[];
  section?: string;
}

export const NAV_CONFIG: NavItem[] = [
  { id: 'my-panel', path: '/meu-painel', label: 'Meu Painel', icon: UserCircle, roles: ['admin', 'terminal', 'entity'] },
  { id: 'cop', path: '/centro-de-operacoes', label: 'Centro de Operações', icon: Radio, roles: ['admin', 'terminal', 'entity'] },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'terminal', 'entity'] },
  { id: 'terminals', path: '/terminais', label: 'Terminais', icon: Ship, roles: ['admin', 'entity'] },
  { id: 'entities', path: '/entidades', label: 'Entidades', icon: Shield, roles: ['admin'] },
  { id: 'users', path: '/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
  { id: 'permissions', path: '/permissoes', label: 'Permissões', icon: Lock, roles: ['admin'] },
  { id: 'access-levels', path: '/niveis-de-acesso', label: 'Níveis de Acesso', icon: ShieldCheck, roles: ['admin'] },
  { id: 'notification-rules', path: '/acionamento-entidades', label: 'Acionamento Entidades', headerLabel: 'Acionamento de Entidades', icon: Bell, roles: ['admin'] },
  { id: 'orchestration', path: '/orquestracao', label: 'Orquestração', headerLabel: 'Orquestração de Emergência', icon: Activity, roles: ['admin', 'terminal'], section: 'PAE' },
  { id: 'ai-command', path: '/ai-command', label: 'AI Command', icon: Brain, roles: ['admin', 'terminal'], section: 'PAE' },
  { id: 'risks', path: '/riscos', label: 'Riscos', icon: AlertTriangle, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'plans', path: '/planos-de-acao', label: 'Planos de Ação', icon: FileText, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'occurrences', path: '/ocorrencias', label: 'Ocorrências', icon: Siren, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'map', path: '/mapa-de-emergencia', label: 'Mapa de Emergência', icon: MapPin, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'documents', path: '/documentos', label: 'Documentos', headerLabel: 'Biblioteca de Documentos', icon: FolderOpen, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'badge', path: '/cracha-do-pae', label: 'Crachá do PAE', icon: IdCard, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'safety', path: '/seguranca', label: 'Visão Geral', headerLabel: 'Centro de Segurança Operacional', icon: ShieldCheck, roles: ['admin'], section: 'Segurança Operacional' },
  { id: 'trainings', path: '/seguranca/treinamentos', label: 'Treinamentos', headerLabel: 'Centro de Segurança Operacional', icon: GraduationCap, roles: ['admin', 'terminal'], section: 'Segurança Operacional' },
  { id: 'epis', path: '/seguranca/epis', label: 'EPIs', headerLabel: 'Centro de Segurança Operacional', icon: HardHat, roles: ['admin', 'terminal'], section: 'Segurança Operacional' },
  { id: 'compliance', path: '/seguranca/conformidade', label: 'Conformidade', headerLabel: 'Centro de Segurança Operacional', icon: ClipboardCheck, roles: ['admin', 'terminal'], section: 'Segurança Operacional' },
  { id: 'modules', path: '/pacotes-do-sistema', label: 'Pacotes do Sistema', icon: Puzzle, roles: ['admin'] },
  { id: 'org-chart', path: '/organograma', label: 'Organograma', icon: Network, roles: ['admin'] },
  { id: 'audit', path: '/auditoria', label: 'Auditoria', headerLabel: 'Central de Auditoria', icon: History, roles: ['admin'] },
  { id: 'about', path: '/sobre', label: 'Sobre o Sistema', icon: Info, roles: ['admin', 'terminal', 'entity'] },
];

/** Rota da Sala de Situação de uma ocorrência (deep-link compartilhável). */
export function situationRoomPath(occurrenceId: string): string {
  return `/ocorrencias/${occurrenceId}/sala-de-situacao`;
}

const SITUATION_ROOM_RE = /^\/ocorrencias\/[^/]+\/sala-de-situacao$/;

/** Resolve a rota de um id legado de view (compatibilidade com callbacks antigos). */
export function pathForView(viewId: string): string {
  return NAV_CONFIG.find(i => i.id === viewId)?.path ?? '/';
}

/** Item de navegação correspondente à URL atual (match exato). */
export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_CONFIG.find(i => i.path === pathname);
}

/**
 * menuId (id legado de view) para a URL atual — usado pelo guard de acesso.
 * A Sala de Situação herda as regras de acesso de 'occurrences'.
 */
export function menuIdForPath(pathname: string): string | undefined {
  if (SITUATION_ROOM_RE.test(pathname)) return 'occurrences';
  return navItemForPath(pathname)?.id;
}

/** Título do header para a URL atual. */
export function headerLabelForPath(pathname: string): string {
  if (SITUATION_ROOM_RE.test(pathname)) return 'Sala de Situação';
  const item = navItemForPath(pathname);
  return item ? (item.headerLabel ?? item.label) : '';
}

/** Rota inicial por perfil (regra herdada do PAESystem). */
export function defaultPathForUser(user: AppUser | null): string {
  if (user && user.role !== 'admin' && user.accessLevel === 'operacional') return '/meu-painel';
  return '/dashboard';
}
