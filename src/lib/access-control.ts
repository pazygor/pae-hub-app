import { AppUser, AccessLevel, AppData } from './types';
import { ProductModule, SafetySubModule, getDefaultModules, getDefaultSafetySubModules } from './modules';

/**
 * Módulos/submódulos ativos para o usuário, conforme o licenciamento do
 * terminal vinculado (admin enxerga tudo). Fonte única — usada por sidebar,
 * guards de rota e alerta de pendências.
 */
export function getUserActiveConfig(
  user: AppUser | null,
  _data?: AppData,
): { modules: ProductModule[]; safetySubModules: SafetySubModule[] } {
  // Fonte da verdade agora é o /auth/me (item 7): `user.modules` já traz a config
  // do terminal do usuário, com a Conformidade derivada. Fallback = tudo ligado.
  if (!user) return { modules: getDefaultModules(), safetySubModules: getDefaultSafetySubModules() };
  if (user.modules) {
    return {
      modules: user.modules.active as ProductModule[],
      safetySubModules: user.modules.safetySubModules as SafetySubModule[],
    };
  }
  return { modules: getDefaultModules(), safetySubModules: getDefaultSafetySubModules() };
}

/**
 * Returns the list of terminal IDs visible to the current user.
 * - Admin: all terminals
 * - Terminal role: only their linked terminal
 * - Entity role: terminals allowed via permissions matrix
 */
export function getVisibleTerminalIds(user: AppUser | null, data: AppData): string[] {
  if (!user) return [];
  if (user.role === 'admin') return data.terminals.map(t => t.id);
  if (user.role === 'terminal') return user.linkId ? [user.linkId] : [];
  if (user.role === 'entity') {
    return data.permissions.find(p => p.entityId === user.linkId)?.terminalIds || [];
  }
  return [];
}

/** Whether the user is locked to a single terminal (hide multi-terminal selector) */
export function isTerminalLocked(user: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return false;
  return true;
}

/**
 * Access control helpers based on user access level (Estratégico, Tático, Operacional).
 * 
 * - Estratégico: view ALL operational modules + dashboards. No global config. No CRUD.
 * - Tático: full CRUD on operational modules. Sees only their linked Operacional users.
 * - Operacional: personal view only (Meu Painel). No create/edit/delete.
 * - Admin role always has full access regardless of access level.
 */

/** Whether the user can create, edit, delete records in management modules */
export function canManage(user: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.accessLevel === 'operacional') return false;
  if (user.accessLevel === 'estratégico') return false;
  // Tático users can manage
  return true;
}

/** Whether the user can view management/admin screens (not just personal panel) */
export function canViewManagement(user: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.accessLevel === 'operacional') return false;
  return true;
}

/** Whether user is restricted to personal-only views */
export function isPersonalOnly(user: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return false;
  return user.accessLevel === 'operacional';
}

/** Menu items that operacional users can access */
export const OPERACIONAL_ALLOWED_MENUS = new Set([
  'my-panel',
  'about',
]);

/** Menu items accessible by estratégico level (full operational visibility, no global config) */
export const ESTRATEGICO_ALLOWED_MENUS = new Set([
  'my-panel',
  'cop',
  'dashboard',
  'trainings',
  'epis',
  'compliance',
  'risks',
  'plans',
  'occurrences',
  'map',
  'documents',
  'badge',
  'orchestration',
  'ai-command',
  'about',
]);

/** Menu items accessible by tático level (operational management, no global config) */
export const TATICO_ALLOWED_MENUS = new Set([
  'my-panel',
  'cop',
  'dashboard',
  'terminals',
  'trainings',
  'epis',
  'compliance',
  'risks',
  'plans',
  'occurrences',
  'map',
  'documents',
  'badge',
  'orchestration',
  'ai-command',
  'users',
  'about',
]);

/** Get allowed menu IDs for a given access level (non-admin users) */
export function getAccessLevelMenuFilter(user: AppUser | null): Set<string> | null {
  if (!user || user.role === 'admin') return null; // no filter
  if (user.accessLevel === 'operacional') return OPERACIONAL_ALLOWED_MENUS;
  if (user.accessLevel === 'estratégico') return ESTRATEGICO_ALLOWED_MENUS;
  if (user.accessLevel === 'tático') return TATICO_ALLOWED_MENUS;
  return null; // no additional filter
}

/**
 * Módulos que a tela "Níveis de Acesso" controla por usuário (allowedModules).
 * Precisa espelhar RESTRICTABLE_MODULES da AccessLevelsPage.
 */
export const RESTRICTABLE_MODULE_IDS = new Set<string>([
  'cop', 'dashboard', 'terminals', 'risks', 'plans', 'occurrences', 'map', 'documents', 'badge', 'about',
]);

/**
 * Decide se um item de menu é visível para o usuário (autoridade dos toggles).
 *
 * Regra (decisão do gestor, 2026-07-07 — "vale o que está em Níveis de Acesso"):
 * - admin vê tudo;
 * - para os módulos restringíveis, quando o usuário tem allowedModules preenchido,
 *   a lista É a autoridade — sobrepõe papel e conjunto do nível (ex.: liberar
 *   "Terminais" a um estratégico);
 * - para os demais itens (Meu Painel, Orquestração, AI Command, config de admin…),
 *   segue papel + conjunto do nível (a tela não os controla).
 */
export function isMenuAllowedForUser(user: AppUser | null, itemId: string, itemRoles: string[]): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const hasCustomModules = (user.allowedModules?.length ?? 0) > 0;
  if (hasCustomModules && RESTRICTABLE_MODULE_IDS.has(itemId)) {
    return user.allowedModules!.includes(itemId); // toggle manda
  }

  if (!itemRoles.includes(user.role)) return false;
  const levelFilter = getAccessLevelMenuFilter(user);
  return !levelFilter || levelFilter.has(itemId);
}

/**
 * Get users visible to the current user based on hierarchy:
 * - Admin: all users
 * - Estratégico: all users of the same terminal/entity
 * - Tático: only operacional users linked to them (tacticalManagerId)
 * - Operacional: only themselves
 */
export function getVisibleUsers(currentUser: AppUser | null, allUsers: AppUser[]): AppUser[] {
  if (!currentUser) return [];
  if (currentUser.role === 'admin') return allUsers;

  if (currentUser.accessLevel === 'estratégico') {
    // See all users linked to the same terminal
    return allUsers.filter(u => u.id === currentUser.id || u.linkId === currentUser.linkId);
  }

  if (currentUser.accessLevel === 'tático') {
    // See only operacional users managed by them + themselves
    return allUsers.filter(u =>
      u.id === currentUser.id ||
      (u.accessLevel === 'operacional' && u.tacticalManagerId === currentUser.id)
    );
  }

  // Operacional: only themselves
  return allUsers.filter(u => u.id === currentUser.id);
}
