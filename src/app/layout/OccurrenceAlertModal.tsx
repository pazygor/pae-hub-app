import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, X, MapPin, ArrowRight, Bell } from 'lucide-react';
import { useNotifications, severityClasses } from '@/lib/notifications';
import { startRingtone, stopRingtone } from '@/lib/ringtone';
import { authApi } from '@/api';

/**
 * Modal de alerta de NOVA OCORRÊNCIA (som + destaque) — chama atenção imediata,
 * no mesmo espírito do modal de pendências. Cor pelo grau de severidade.
 * Disparado pelo RealtimeBridge (tempo real) e pelo MissedAlertsBridge (login).
 */
export function OccurrenceAlertModal() {
  const { alert, dismissAlert } = useNotifications();
  const navigate = useNavigate();

  // Som toca em loop enquanto o modal está aberto; para ao fechar (ou desmontar).
  useEffect(() => {
    if (alert) startRingtone();
    return () => stopRingtone();
  }, [alert]);

  const c = severityClasses(alert?.level);
  // Fechar o alerta = "vi" — grava o alertsSeenAt no back para o próximo login
  // só re-alertar o que vier depois (fire-and-forget; falha não bloqueia a UI).
  const closeAlert = () => { authApi.markAlertsSeen().catch(() => {}); dismissAlert(); };
  const goToOccurrence = () => { closeAlert(); navigate('/ocorrencias'); };

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeAlert}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`w-full max-w-md bg-card border-2 ${c.border} rounded-2xl shadow-2xl overflow-hidden`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header colorido pela severidade */}
            <div className={`${c.bg} px-6 py-4 flex items-center gap-3 border-b ${c.border}`}>
              <div className={`p-2 rounded-lg ${c.bg}`}>
                <Siren size={20} className={`${c.text} animate-pulse`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-black uppercase tracking-wide ${c.text}`}>Nova Ocorrência</h3>
                <p className="text-[11px] text-muted-foreground">Requer atenção imediata</p>
              </div>
              <button onClick={closeAlert} className="ml-auto p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Corpo — dados da ocorrência */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {alert.incNumber && (
                  <span className="text-[11px] font-mono bg-secondary text-secondary-foreground px-2.5 py-1 rounded font-bold">{alert.incNumber}</span>
                )}
                {alert.level && (
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${c.bg} ${c.text} capitalize`}>{alert.level}</span>
                )}
                {alert.mandatory && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary">Obrigatório</span>
                )}
              </div>

              {alert.type && <h4 className="text-base font-bold text-foreground leading-snug">{alert.type}</h4>}

              {alert.terminalName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin size={12} className="shrink-0" /> {alert.terminalName}
                </div>
              )}

              {alert.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 bg-secondary/40 rounded-lg p-3">
                  {alert.description}
                </p>
              )}

              {/* Alertas perdidos (login): além desta, há outras não vistas no sino */}
              {(alert.extraCount ?? 0) > 0 && (
                <div className={`flex items-center gap-2 text-xs font-bold ${c.text} ${c.bg} rounded-lg px-3 py-2`}>
                  <Bell size={14} className="shrink-0" />
                  <span>
                    + {alert.extraCount} outra{alert.extraCount! > 1 ? 's' : ''} ocorrência{alert.extraCount! > 1 ? 's' : ''} enquanto
                    você esteve fora — confira no sino de notificações.
                  </span>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={goToOccurrence}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-primary-foreground bg-primary shadow-lg shadow-primary/25 hover:brightness-110 transition-all flex items-center justify-center gap-1.5`}
              >
                Ver ocorrência <ArrowRight size={14} />
              </button>
              <button
                onClick={closeAlert}
                className="px-4 py-2.5 bg-secondary text-muted-foreground rounded-xl text-xs font-bold hover:bg-secondary/80 transition-colors"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
