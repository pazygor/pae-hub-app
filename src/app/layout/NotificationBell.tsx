import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useNotifications, severityClasses } from '@/lib/notifications';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Sino de notificações no header — lista as notificações da sessão (toast + histórico),
 *  cor por severidade; clicar leva à tela de Ocorrências. */
export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, remove, clear } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen(o => { const next = !o; if (next) markAllRead(); return next; });
  const openItem = () => { setOpen(false); navigate('/ocorrencias'); };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        title="Notificações"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto z-50 bg-card border border-border rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-card">
              <span className="text-xs font-bold text-foreground">Notificações</span>
              {notifications.length > 0 && (
                <button onClick={clear} className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors">
                  Limpar
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center">Nenhuma notificação.</p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map(n => {
                  const c = severityClasses(n.level);
                  return (
                    <li
                      key={n.id}
                      onClick={openItem}
                      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary/50 cursor-pointer"
                    >
                      <span className={`mt-1 w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[11px] font-bold ${c.text}`}>{n.title}</p>
                        {n.subtitle && <p className="text-[11px] text-foreground truncate">{n.subtitle}</p>}
                        <p className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                        className="text-muted-foreground hover:text-primary shrink-0"
                        title="Remover"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
