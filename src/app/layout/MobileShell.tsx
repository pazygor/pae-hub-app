import { Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Siren } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { headerLabelForPath } from '@/lib/nav-config';
import { PageLoader } from '@/components/common/PageLoader';
import { useActiveEmergencies } from '@/api';
import { ConsentTermsModal } from './ConsentTermsModal';

/**
 * Chrome mobile (Fase 1.D): envolve as telas abertas a partir do painel de
 * ações em telas <780px, mantendo a experiência mobile do protótipo — sem
 * sidebar nem header desktop. "← Painel" retorna ao painel de ações (`/`).
 */
export function MobileShell() {
  const { user } = useAuth();
  const { emergencies: activeEmergencies } = useActiveEmergencies();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;
  const title = headerLabelForPath(location.pathname) || 'M1 PAE Hub';
  const roleLabel = user.role === 'admin' ? 'ADMIN' : user.role === 'terminal' ? 'TERMINAL' : 'ENTIDADE';

  return (
    <div className="flex flex-col h-svh bg-background">
      {/* Termo de Consentimento (item 6): bloqueante também no mobile. */}
      <ConsentTermsModal />
      {/* Banner de emergência ativa (mesma linguagem do painel) */}
      {activeEmergencies.length > 0 && (
        <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-2 shrink-0 animate-pulse">
          <Siren size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">⚠ EMERGÊNCIA ATIVA ⚠</span>
        </div>
      )}

      {/* Header compacto */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-3 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 px-2 py-2 rounded-lg text-primary text-xs font-bold active:scale-[0.97] transition-transform"
        >
          <ChevronLeft size={18} />
          Painel
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-black text-primary shrink-0">M1</span>
          <span className="text-[10px] text-muted-foreground shrink-0">|</span>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {title}
          </h2>
        </div>
        <span className="text-[9px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider shrink-0">
          {roleLabel}
        </span>
      </header>

      {/* Conteúdo da tela */}
      <main className="flex-1 overflow-y-auto p-4">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
