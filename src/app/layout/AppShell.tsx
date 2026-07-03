import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Siren, Search, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { usePresentationMode, maskEmail } from '@/lib/presentation-mode';
import { useIsMobile } from '@/hooks/use-mobile';
import { GlobalSearch } from '@/components/pae/GlobalSearch';
import { AppSidebar } from './AppSidebar';
import { PendencyAlertModal } from './PendencyAlertModal';
import { useEmergencyDispatch } from './EmergencyDispatchProvider';
import { headerLabelForPath, pathForView, situationRoomPath } from './nav-config';

/**
 * Casca da aplicação (sidebar + header + banner de emergência + footer),
 * herdada do antigo PAESystem. O conteúdo de cada rota renderiza no <Outlet/>.
 */
export function AppShell() {
  const { user, data } = useAuth();
  const { presentationMode, togglePresentationMode } = usePresentationMode();
  const { openDispatch } = useEmergencyDispatch();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Atalho Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSearch(s => !s);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!user) return null;

  const canDispatchEmergency = user.role === 'admin' || user.role === 'terminal';
  const roleLabel = user.role === 'admin' ? 'ADMIN' : user.role === 'terminal' ? 'TERMINAL' : 'ENTIDADE';
  const headerTitle = headerLabelForPath(location.pathname) || 'M1 PAE Hub';

  return (
    <div className="flex h-svh bg-background overflow-hidden">
      <PendencyAlertModal />

      <GlobalSearch
        open={showSearch}
        onOpenChange={setShowSearch}
        onNavigate={(viewId) => navigate(pathForView(viewId))}
        onOpenSituationRoom={(id) => navigate(situationRoomPath(id))}
      />

      <AppSidebar collapsed={sidebarCollapsed} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Global Emergency Alert */}
        {data.occurrences.some(o => o.status === 'emergência ativa') && (
          <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-2 shrink-0 animate-pulse">
            <Siren size={16} />
            <span className="text-xs font-black uppercase tracking-widest">⚠ EMERGÊNCIA ATIVA ⚠</span>
            <span className="text-[10px] font-bold opacity-80">
              — {data.occurrences.filter(o => o.status === 'emergência ativa').map(o => {
                const t = data.terminals.find(t => t.id === o.terminalId);
                return t ? t.name : o.type;
              }).join(' | ')}
            </span>
          </div>
        )}

        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => navigate('/')}
                className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors text-[11px] font-bold"
              >
                ← Painel
              </button>
            )}
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-primary">M1</span>
              <span className="text-[10px] text-muted-foreground">|</span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {headerTitle}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePresentationMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg transition-colors border ${
                presentationMode
                  ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                  : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground'
              }`}
              title={presentationMode ? 'Desativar modo apresentação' : 'Ativar modo apresentação'}
            >
              {presentationMode ? <EyeOff size={14} /> : <Eye size={14} />}
              <span className="hidden sm:inline">{presentationMode ? 'Apresentação' : 'Apresentar'}</span>
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary text-muted-foreground text-[11px] rounded-lg hover:bg-secondary/80 hover:text-foreground transition-colors border border-border"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
            </button>
            {canDispatchEmergency && (
              <button
                onClick={openDispatch}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-lg shadow-lg shadow-primary/30 hover:brightness-110 transition-all animate-pulse hover:animate-none"
              >
                <Siren size={14} />
                <span className="hidden sm:inline">Disparar Emergência</span>
              </button>
            )}
            <span className="text-[9px] font-medium px-2 py-0.5 bg-accent/10 text-accent rounded-full border border-accent/20 hidden md:inline">DEMO</span>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">{roleLabel}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{presentationMode ? maskEmail(user.email) : user.email}</span>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </section>

        <footer className="h-10 border-t border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-primary">M1</span>
            <span className="text-[10px] text-muted-foreground">PAE Hub — Plataforma de Gestão de Emergências Operacionais</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">2026</span>
            <span className="text-[10px] text-muted-foreground">© M1 – Todos os direitos reservados</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
