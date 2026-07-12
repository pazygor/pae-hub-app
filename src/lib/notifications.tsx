// ─────────────────────────────────────────────────────────────────────────────
// Central de notificações (sino do header) — guarda as notificações da sessão
// disparadas pelo RealtimeBridge quando uma ocorrência é criada ou uma entidade
// é acionada. A cor segue o grau de severidade (linguagem visual do sistema).
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type NotifLevel = 'baixa' | 'média' | 'alta' | 'crítica';

export interface AppNotification {
  id: string;
  occurrenceId: string;
  incNumber?: string | null;
  title: string;              // ex.: "Nova ocorrência" / "Entidade acionada"
  subtitle?: string | null;   // ex.: "Vazamento · Terminal X"
  level?: NotifLevel | null;  // grau de severidade → cor
  kind: 'occurrence' | 'entity';
  createdAt: number;
  read: boolean;
}

/** Ocorrência exibida no modal de alerta (som + destaque) — chama atenção imediata. */
export interface OccurrenceAlert {
  occurrenceId: string;
  incNumber?: string | null;
  type?: string | null;
  description?: string | null;
  terminalName?: string | null;
  level?: NotifLevel | null;
  mandatory?: boolean;
  /** Alertas perdidos (login): quantas OUTRAS ocorrências não vistas além desta. */
  extraCount?: number;
}

interface NotificationsCtx {
  notifications: AppNotification[];
  unreadCount: number;
  add: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
  alert: OccurrenceAlert | null;
  showAlert: (a: OccurrenceAlert) => void;
  dismissAlert: () => void;
}

const noop = () => {};
const NotificationsContext = createContext<NotificationsCtx>({
  notifications: [], unreadCount: 0, add: noop, markAllRead: noop, remove: noop, clear: noop,
  alert: null, showAlert: noop, dismissAlert: noop,
});

const MAX = 50;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [alert, setAlert] = useState<OccurrenceAlert | null>(null);
  const showAlert = useCallback((a: OccurrenceAlert) => setAlert(a), []);
  const dismissAlert = useCallback(() => setAlert(null), []);

  const add = useCallback((n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    setNotifications(prev => {
      // Dedupe: mesma ocorrência + mesmo tipo de notificação (evita duplicar no reconnect).
      if (prev.some(p => p.occurrenceId === n.occurrenceId && p.kind === n.kind)) return prev;
      const item: AppNotification = { ...n, id: `${n.kind}-${n.occurrenceId}-${Date.now()}`, createdAt: Date.now(), read: false };
      return [item, ...prev].slice(0, MAX);
    });
  }, []);

  const markAllRead = useCallback(
    () => setNotifications(prev => (prev.some(p => !p.read) ? prev.map(p => ({ ...p, read: true })) : prev)),
    [],
  );
  const remove = useCallback((id: string) => setNotifications(prev => prev.filter(p => p.id !== id)), []);
  const clear = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.reduce((acc, p) => acc + (p.read ? 0 : 1), 0);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, add, markAllRead, remove, clear, alert, showAlert, dismissAlert }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

/** Classes de cor por grau de severidade — mesma linguagem visual do sistema
 *  (verde = baixa, amarelo = média, vermelho = alta/crítica). */
export function severityClasses(level?: NotifLevel | null): {
  dot: string; text: string; bg: string; border: string;
} {
  switch (level) {
    case 'baixa':
      return { dot: 'bg-success', text: 'text-success', bg: 'bg-success/10', border: 'border-success/30' };
    case 'média':
      return { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' };
    case 'alta':
    case 'crítica':
      return { dot: 'bg-primary', text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' };
    default:
      return { dot: 'bg-muted-foreground', text: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' };
  }
}
