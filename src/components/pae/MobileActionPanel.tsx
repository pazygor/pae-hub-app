import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Siren, IdCard, MapPin, Navigation, Clock, ChevronRight, AlertTriangle, Menu, LogOut, Shield } from 'lucide-react';
import { usePresentationMode, maskName } from '@/lib/presentation-mode';
import m1Logo from '@/assets/m1-logo.png';

interface Props {
  onDispatchEmergency: () => void;
  onOpenSituationRoom: (id: string) => void;
  onNavigate: (view: string) => void;
  onOpenFullSystem: () => void;
}

/* ── Rotating Banner ── */
const BANNER_SLIDES = [
  { title: 'M1 PAE Hub', subtitle: 'Centro de Comando de Emergências' },
  { title: 'Resposta Rápida', subtitle: 'Emergências operacionais em tempo real' },
  { title: 'Gestão Integrada', subtitle: 'Riscos, incidentes e planos de ação' },
];

function RotatingBanner() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % BANNER_SLIDES.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative h-20 flex items-center justify-center overflow-hidden bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(0,72%,40%)] to-[hsl(var(--primary))]">
      {BANNER_SLIDES.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-in-out"
          style={{
            opacity: i === idx ? 1 : 0,
            transform: i === idx ? 'translateY(0)' : 'translateY(12px)',
          }}
        >
          <h1 className="text-sm font-black tracking-widest text-[hsl(var(--primary-foreground))] uppercase">{s.title}</h1>
          <p className="text-[11px] text-[hsl(var(--primary-foreground))]/80 mt-0.5">{s.subtitle}</p>
        </div>
      ))}
      {/* Dots */}
      <div className="absolute bottom-2 flex gap-1.5">
        {BANNER_SLIDES.map((_, i) => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              background: i === idx ? 'hsl(var(--primary-foreground))' : 'hsl(var(--primary-foreground) / 0.35)',
              width: i === idx ? 12 : 6,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Hold-to-confirm Emergency Button ── */
const HOLD_DURATION = 2000;

function HoldEmergencyButton({ onConfirm }: { onConfirm: () => void }) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (!startRef.current) return;
    const elapsed = Date.now() - startRef.current;
    const pct = Math.min(elapsed / HOLD_DURATION, 1);
    setProgress(pct);
    if (pct >= 1) {
      setHolding(false);
      startRef.current = null;
      onConfirm();
      // haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(80);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onConfirm]);

  const start = useCallback(() => {
    startRef.current = Date.now();
    setHolding(true);
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const cancel = useCallback(() => {
    startRef.current = null;
    setHolding(false);
    setProgress(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const circumference = 2 * Math.PI * 28;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative">
        {/* SVG progress ring */}
        <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="28" fill="none" stroke="hsl(var(--primary) / 0.15)" strokeWidth="4" />
          <circle
            cx="36" cy="36" r="28"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="transition-none"
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
        </svg>
        <button
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onContextMenu={e => e.preventDefault()}
          className={`
            relative w-[72px] h-[72px] rounded-full flex items-center justify-center
            bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]
            shadow-xl shadow-[hsl(var(--primary)/0.4)]
            select-none touch-none
            transition-transform duration-200
            ${holding ? 'scale-95' : ''}
          `}
        >
          <Siren size={32} />
        </button>
      </div>
      <span className="text-xs font-black uppercase tracking-widest text-foreground">
        Disparar Emergência
      </span>
      <span className="text-[10px] text-muted-foreground -mt-2">
        {holding ? 'Segure para confirmar...' : 'Pressione e segure por 2s'}
      </span>
    </div>
  );
}

/* ── Main Panel ── */
export function MobileActionPanel({ onDispatchEmergency, onOpenSituationRoom, onNavigate, onOpenFullSystem }: Props) {
  const { user, data, logout } = useAuth();
  const { presentationMode } = usePresentationMode();
  if (!user) return null;

  const activeEmergencies = data.occurrences.filter(o => o.status === 'emergência ativa');
  const canDispatch = user.role === 'admin' || user.role === 'terminal';
  const roleLabel = user.role === 'admin' ? 'ADMIN' : user.role === 'terminal' ? 'TERMINAL' : 'ENTIDADE';

  return (
    <div className="flex flex-col h-svh bg-background">
      {/* Active Emergency Banner */}
      {activeEmergencies.length > 0 && (
        <div className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 flex items-center justify-center gap-2 shrink-0 animate-pulse">
          <Siren size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">⚠ EMERGÊNCIA ATIVA ⚠</span>
        </div>
      )}

      {/* Rotating Banner */}
      <RotatingBanner />

      {/* Role Badge */}
      <div className="flex items-center justify-center py-2 shrink-0">
        <span className="text-[9px] font-bold px-3 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">{roleLabel}</span>
      </div>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
        {/* Emergency Dispatch — hold to confirm */}
        {canDispatch && (
          <HoldEmergencyButton onConfirm={onDispatchEmergency} />
        )}

        {/* Quick Access Grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('badge')}
            className="flex flex-col items-center gap-2.5 py-6 bg-card border border-border rounded-2xl active:scale-[0.97] transition-transform shadow-sm"
          >
            <div className="p-3.5 bg-primary/10 rounded-xl">
              <IdCard size={28} className="text-primary" />
            </div>
            <span className="text-xs font-bold text-foreground">Crachá do PAE</span>
            <span className="text-[10px] text-muted-foreground">Contatos rápidos</span>
          </button>

          <button
            onClick={() => onNavigate('map')}
            className="flex flex-col items-center gap-2.5 py-6 bg-card border border-border rounded-2xl active:scale-[0.97] transition-transform shadow-sm"
          >
            <div className="p-3.5 bg-[hsl(var(--success)/0.1)] rounded-xl">
              <MapPin size={28} className="text-[hsl(var(--success))]" />
            </div>
            <span className="text-xs font-bold text-foreground">Mapa</span>
            <span className="text-[10px] text-muted-foreground">Emergência</span>
          </button>
        </div>

        {/* Active Emergencies */}
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-primary" />
            Emergências Ativas ({activeEmergencies.length})
          </h2>

          {activeEmergencies.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Shield size={32} className="text-[hsl(var(--success))] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-foreground">Nenhuma emergência ativa</p>
              <p className="text-[11px] text-muted-foreground mt-1">Todas as operações estão normais</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeEmergencies.map(occ => {
                const terminal = data.terminals.find(t => t.id === occ.terminalId);
                const elapsed = Math.floor((Date.now() - new Date(occ.dateTime).getTime()) / 60000);
                const elapsedLabel = elapsed < 60 ? `${elapsed}min` : `${Math.floor(elapsed / 60)}h${elapsed % 60}min`;

                return (
                  <div key={occ.id} className="bg-card border-2 border-primary/30 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-primary/10 px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Siren size={14} className="text-primary" />
                        <span className="text-xs font-black text-primary">{occ.incNumber}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold">
                        <Clock size={12} />
                        {elapsedLabel}
                      </div>
                    </div>

                    <div className="px-4 py-3 space-y-2.5">
                      <p className="text-sm font-bold text-foreground leading-snug">{occ.description}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <MapPin size={12} />
                        <span>{terminal?.name || 'Terminal'}</span>
                        <span className="text-[10px]">•</span>
                        <span className="uppercase font-bold text-primary">{occ.severity}</span>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => onOpenSituationRoom(occ.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-xl text-xs font-black uppercase active:scale-[0.97] transition-transform"
                        >
                          <Siren size={14} />
                          Sala de Situação
                        </button>
                      </div>

                      {terminal && (
                        <div className="flex gap-2">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${terminal.lat},${terminal.lng}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary/5 text-primary rounded-xl text-[11px] font-bold border border-primary/20 active:scale-[0.97] transition-transform"
                          >
                            <Navigation size={12} />
                            Google Maps
                          </a>
                          <a
                            href={`https://waze.com/ul?ll=${terminal.lat},${terminal.lng}&navigate=yes`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary/5 text-primary rounded-xl text-[11px] font-bold border border-primary/20 active:scale-[0.97] transition-transform"
                          >
                            <Navigation size={12} />
                            Waze
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Occurrences */}
        {data.occurrences.filter(o => o.status !== 'emergência ativa').length > 0 && (
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
              Ocorrências Recentes
            </h2>
            <div className="space-y-2">
              {data.occurrences
                .filter(o => o.status !== 'emergência ativa')
                .slice(0, 5)
                .map(occ => (
                  <button
                    key={occ.id}
                    onClick={() => onOpenSituationRoom(occ.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-xl text-left active:scale-[0.98] transition-transform shadow-sm"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      occ.status === 'resolvido' ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--warning))]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{occ.incNumber} — {occ.description}</p>
                      <p className="text-[10px] text-muted-foreground">{occ.status}</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </button>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Bar */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center gap-2">
        <button
          onClick={onOpenFullSystem}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-secondary text-foreground rounded-xl text-xs font-bold active:scale-[0.97] transition-transform"
        >
          <Menu size={16} />
          Sistema Completo
        </button>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 px-4 py-3.5 bg-secondary text-muted-foreground rounded-xl text-xs font-bold active:scale-[0.97] transition-transform"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
