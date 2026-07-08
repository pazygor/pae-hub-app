import { NavLink } from 'react-router-dom';
import { LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { usePresentationMode, maskName, maskEmail } from '@/lib/presentation-mode';
import { isMenuItemAccessible, getPackageLabel } from '@/lib/modules';
import { isMenuAllowedForUser, getUserActiveConfig } from '@/lib/access-control';
import { NAV_CONFIG } from '@/lib/nav-config';
import { useActiveEmergencies } from '@/api';
import m1Logo from '@/assets/m1-logo.png';

interface Props {
  collapsed: boolean;
}

/** Itens de menu que exibem o badge pulsante durante emergência ativa. */
const EMERGENCY_MENU_IDS = new Set(['cop', 'occurrences', 'map', 'dashboard']);

export function AppSidebar({ collapsed }: Props) {
  const { user, data, logout } = useAuth();
  const { presentationMode } = usePresentationMode();
  const { emergencies } = useActiveEmergencies();
  if (!user) return null;

  const hasActiveEmergency = emergencies.length > 0;

  // Módulos ativos do terminal vinculado (licenciamento) — fonte única
  const { modules: activeModules, safetySubModules: activeSafetySubs } = getUserActiveConfig(user, data);

  const filtered = NAV_CONFIG.filter(item => {
    // Autoridade dos toggles de Níveis de Acesso (papel/nível para o resto)
    if (!isMenuAllowedForUser(user, item.id, item.roles)) return false;
    // Licenciamento do terminal (Pacotes do Sistema)
    if (user.role !== 'admin' && !isMenuItemAccessible(item.id, activeModules, activeSafetySubs)) return false;
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
          const prevItem = filtered[idx - 1];
          const showSection = item.section && (!prevItem || prevItem.section !== item.section);
          return (
            <div key={item.id}>
              {showSection && !collapsed && (
                <p className="text-[9px] font-bold text-sidebar-foreground uppercase tracking-widest px-3 pt-5 pb-1.5">{item.section}</p>
              )}
              {showSection && collapsed && <div className="border-t border-sidebar-border my-2" />}
              <NavLink
                to={item.path}
                end
                title={item.label}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'text-sidebar-foreground hover:bg-[hsl(0,0%,12%)] hover:text-sidebar-accent-foreground'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-foreground rounded-r-full" />
                    )}
                    <div className="relative shrink-0">
                      <item.icon size={18} />
                      {hasActiveEmergency && EMERGENCY_MENU_IDS.has(item.id) && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-[hsl(0,0%,6%)] animate-pulse" />
                      )}
                    </div>
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && isActive && <ChevronRight size={14} className="ml-auto" />}
                  </>
                )}
              </NavLink>
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
