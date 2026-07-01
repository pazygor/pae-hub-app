// Module licensing configuration
// Defines which menu items belong to which product module

export type ProductModule = 'emergency_management' | 'operational_safety';
export type SafetySubModule = 'trainings' | 'epis' | 'compliance';

export const ALL_SAFETY_SUBMODULES: SafetySubModule[] = ['trainings', 'epis', 'compliance'];

export const SAFETY_SUBMODULE_LABELS: Record<SafetySubModule, string> = {
  trainings: 'Treinamentos',
  epis: 'EPIs',
  compliance: 'Conformidade',
};

export const PRODUCT_MODULES: Record<ProductModule, { label: string; brandName: string; description: string }> = {
  emergency_management: {
    label: 'Response',
    brandName: 'M1 PAE Hub | Response',
    description: 'Controle e resposta a emergências em tempo real',
  },
  operational_safety: {
    label: 'Safety',
    brandName: 'M1 PAE Hub | Safety',
    description: 'Gestão preventiva e conformidade operacional',
  },
};

export const COMMAND_BRAND = {
  label: 'Command',
  brandName: 'M1 PAE Hub | Command',
  description: 'Plataforma completa integrada de gestão de emergências e segurança operacional',
};

export function getPackageName(activeModules: ProductModule[]): string {
  const hasEmergency = activeModules.includes('emergency_management');
  const hasSafety = activeModules.includes('operational_safety');
  if (hasEmergency && hasSafety) return COMMAND_BRAND.brandName;
  if (hasEmergency) return PRODUCT_MODULES.emergency_management.brandName;
  if (hasSafety) return PRODUCT_MODULES.operational_safety.brandName;
  return 'M1 PAE Hub';
}

export function getPackageLabel(activeModules: ProductModule[]): string {
  const hasEmergency = activeModules.includes('emergency_management');
  const hasSafety = activeModules.includes('operational_safety');
  if (hasEmergency && hasSafety) return 'Command';
  if (hasEmergency) return 'Response';
  if (hasSafety) return 'Safety';
  return 'PAE Hub';
}

// Map each menu item ID to its product module
export const MODULE_MENU_MAP: Record<string, ProductModule> = {
  cop: 'emergency_management',
  orchestration: 'emergency_management',
  risks: 'emergency_management',
  plans: 'emergency_management',
  occurrences: 'emergency_management',
  map: 'emergency_management',
  documents: 'emergency_management',
  badge: 'emergency_management',
  'notification-rules': 'emergency_management',
  'ai-command': 'emergency_management',

  safety: 'operational_safety',
  trainings: 'operational_safety',
  epis: 'operational_safety',
  compliance: 'operational_safety',
};

// Map safety menu items to their sub-module
export const SAFETY_MENU_SUBMODULE_MAP: Record<string, SafetySubModule> = {
  trainings: 'trainings',
  epis: 'epis',
  compliance: 'compliance',
};

export interface TerminalModuleConfig {
  terminalId: string;
  activeModules: ProductModule[];
  activeSafetySubModules?: SafetySubModule[];
}

export function isMenuItemAccessible(
  menuId: string,
  activeModules: ProductModule[],
  activeSafetySubModules?: SafetySubModule[]
): boolean {
  const requiredModule = MODULE_MENU_MAP[menuId];
  if (!requiredModule) return true;
  if (!activeModules.includes(requiredModule)) return false;

  // Check sub-module level for safety items
  const subModule = SAFETY_MENU_SUBMODULE_MAP[menuId];
  if (subModule) {
    const subs = activeSafetySubModules ?? ALL_SAFETY_SUBMODULES;
    return subs.includes(subModule);
  }

  // 'safety' overview: visible if at least one sub-module is active
  if (menuId === 'safety') {
    const subs = activeSafetySubModules ?? ALL_SAFETY_SUBMODULES;
    return subs.length > 0;
  }

  return true;
}

export function getDefaultModules(): ProductModule[] {
  return ['emergency_management', 'operational_safety'];
}

export function getDefaultSafetySubModules(): SafetySubModule[] {
  return [...ALL_SAFETY_SUBMODULES];
}
