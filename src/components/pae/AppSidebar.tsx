import { LayoutDashboard, Ship, Shield, Users, Lock, LogOut, ChevronRight, AlertTriangle, FileText, Siren, MapPin, Radio, FolderOpen, Info, IdCard, ShieldCheck, Bell, Activity, GraduationCap, HardHat, ClipboardCheck, Puzzle, UserCircle, Network, Brain } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { usePresentationMode, maskName, maskEmail } from '@/lib/presentation-mode';
import { UserRole } from '@/lib/types';
import { isMenuItemAccessible, getDefaultModules, getDefaultSafetySubModules, getPackageLabel, ProductModule, SafetySubModule } from '@/lib/modules';
import { getAccessLevelMenuFilter } from '@/lib/access-control';
import m1Logo from '@/assets/m1-logo.png';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  section?: string;
}

const menuItems: MenuItem[] = [
  { id: 'my-panel', label: 'Meu Painel', icon: UserCircle, roles: ['admin', 'terminal', 'entity'] },
  { id: 'cop', label: 'Centro de Operações', icon: Radio, roles: ['admin', 'terminal', 'entity'] },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'terminal', 'entity'] },
  { id: 'terminals', label: 'Terminais', icon: Ship, roles: ['admin', 'entity'] },
  { id: 'entities', label: 'Entidades', icon: Shield, roles: ['admin'] },
  { id: 'users', label: 'Usuários', icon: Users, roles: ['admin'] },
  { id: 'permissions', label: 'Permissões', icon: Lock, roles: ['admin'] },
  { id: 'access-levels', label: 'Níveis de Acesso', icon: ShieldCheck, roles: ['admin'] },
  { id: 'notification-rules', label: 'Acionamento Entidades', icon: Bell, roles: ['admin'] },
  { id: 'orchestration', label: 'Orquestração', icon: Activity, roles: ['admin', 'terminal'], section: 'PAE' },
  { id: 'ai-command', label: 'AI Command', icon: Brain, roles: ['admin', 'terminal'], section: 'PAE' },
  { id: 'risks', label: 'Riscos', icon: AlertTriangle, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'plans', label: 'Planos de Ação', icon: FileText, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'occurrences', label: 'Ocorrências', icon: Siren, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'map', label: 'Mapa de Emergência', icon: MapPin, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'documents', label: 'Documentos', icon: FolderOpen, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'badge', label: 'Crachá do PAE', icon: IdCard, roles: ['admin', 'terminal', 'entity'], section: 'PAE' },
  { id: 'safety', label: 'Visão Geral', icon: ShieldCheck, roles: ['admin'], section: 'Segurança Operacional' },
  { id: 'trainings', label: 'Treinamentos', icon: GraduationCap, roles: ['admin', 'terminal'], section: 'Segurança Operacional' },
  { id: 'epis', label: 'EPIs', icon: HardHat, roles: ['admin', 'terminal'], section: 'Segurança Operacional' },
  { id: 'compliance', label: 'Conformidade', icon: ClipboardCheck, roles: ['admin', 'terminal'], section: 'Segurança Operacional' },
  { id: 'modules', label: 'Pacotes do Sistema', icon: Puzzle, roles: ['admin'] },
  { id: 'org-chart', label: 'Organograma', icon: Network, roles: ['admin'] },
  { id: 'about', label: 'Sobre o Sistema', icon: Info, roles: ['admin', 'terminal', 'entity'] },
];

interface Props {
  currentView: string;
  setView: (v: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ currentView, setView, collapsed, onToggle }: Props) {
  const { user, data, logout } = useAuth();
  const { presentationMode } = usePresentationMode();
  if (!user) return null;

  const hasActiveEmergency = data.occurrences.some(o => o.status === 'emergência ativa');
  const emergencyMenuIds = new Set(['cop', 'occurrences', 'map', 'dashboard']);

  // Determine active modules for the user's linked terminal
  const getActiveConfig = (): { modules: ProductModule[]; safetySubModules: SafetySubModule[] } => {
    if (user.role === 'admin') return { modules: getDefaultModules(), safetySubModules: getDefaultSafetySubModules() };
    const terminalId = user.linkId;
    if (!terminalId) return { modules: getDefaultModules(), safetySubModules: getDefaultSafetySubModules() };
    const config = data.terminalModules?.find(tm => tm.terminalId === terminalId);
    return {
      modules: config ? config.activeModules : getDefaultModules(),
      safetySubModules: config?.activeSafetySubModules ?? getDefaultSafetySubModules(),
    };
  };
  const { modules: activeModules, safetySubModules: activeSafetySubs } = getActiveConfig();

  const accessLevelFilter = getAccessLevelMenuFilter(user);

  const filtered = menuItems.filter(item => {
    if (!item.roles.includes(user.role)) return false;
    if (user.role !== 'admin' && user.allowedModules && !user.allowedModules.includes(item.id)) return false;
    // Filter by active product modules and sub-modules
    if (user.role !== 'admin' && !isMenuItemAccessible(item.id, activeModules, activeSafetySubs)) return false;
    // Filter by access level (operacional sees only personal views, estratégico sees only dashboards)
    if (accessLevelFilter && !accessLevelFilter.has(item.id)) return false;
    return true;
  });

  return (
    <aside className={`${collapsed ? 'w-0 -ml-px overflow-hidden md:w-16' : 'w-64'} bg-[hsl(0,0%,6%)] flex flex-col transition-all duration-200 shrink-0`}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border bg-[hsl(0,0%,8%)]">
        <img src={m1Logo} alt="M1 Logo" className="h-[30px] w-auto object-contain shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="font-black text-sm tracking-tight text-sidebar-accent-foreground leading-none">PAE Hub</h1>
            <p className="text-[9px] text-sidebar-foreground tracking-wider uppercase mt-0.5">{getPackageLabel(activeModules)}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {filtered.map((item, idx) => {
          const active = currentView === item.id;
          const prevItem = filtered[idx - 1];
          const showSection = item.section && (!prevItem || prevItem.section !== item.section);
          return (
            <div key={item.id}>
              {showSection && !collapsed && (
                <p className="text-[9px] font-bold text-sidebar-foreground uppercase tracking-widest px-3 pt-5 pb-1.5">{item.section}</p>
              )}
              {showSection && collapsed && <div className="border-t border-sidebar-border my-2" />}
              <button
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-sidebar-foreground hover:bg-[hsl(0,0%,12%)] hover:text-sidebar-accent-foreground'
                }`}
                title={item.label}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-foreground rounded-r-full" />
                )}
                <div className="relative shrink-0">
                  <item.icon size={18} />
                  {hasActiveEmergency && emergencyMenuIds.has(item.id) && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-[hsl(0,0%,6%)] animate-pulse" />
                  )}
                </div>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && active && <ChevronRight size={14} className="ml-auto" />}
              </button>
            </div>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-sidebar-border p-2">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">{presentationMode ? maskName(user.name) : user.name}</p>
            <p className="text-[10px] text-sidebar-foreground truncate">{presentationMode ? maskEmail(user.email) : user.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          title="Sair"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="font-medium">Sair do Sistema</span>}
        </button>
      </div>
    </aside>
  );
}
