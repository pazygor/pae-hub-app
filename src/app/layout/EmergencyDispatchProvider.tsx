import { createContext, useContext, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { SeverityLevel } from '@/lib/types';
import { situationRoomPath } from '@/lib/nav-config';
import { useTerminals, useOccurrenceMutations } from '@/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

/**
 * Provider do fluxo de "Disparar Emergência" (Funcional §4.1) — Fases 2+3:
 * cria a ocorrência REAL na API (status 'emergência ativa', INC-#### do back,
 * checklist de 8 passos semeado). O acionamento das entidades é AUTOMÁTICO no
 * back (NotificationRule × Permission → EntityNotification + timeline) e chega
 * ao front via Socket.IO (RealtimeBridge).
 */

interface EmergencyDispatchContextType {
  openDispatch: () => void;
}

const EmergencyDispatchContext = createContext<EmergencyDispatchContextType>({
  openDispatch: () => {},
});

export function useEmergencyDispatch() {
  return useContext(EmergencyDispatchContext);
}

export function EmergencyDispatchProvider() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: terminals = [] } = useTerminals();
  const { create } = useOccurrenceMutations();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    description: '',
    severity: 'alta' as SeverityLevel,
    terminalId: '',
  });

  const visibleTerminals = !user
    ? []
    : user.role === 'admin'
      ? terminals
      : user.role === 'terminal' && user.linkId
        ? terminals.filter(t => t.id === user.linkId)
        : [];

  const openDispatch = () => {
    if (!user) return;
    setForm({
      description: '',
      severity: 'alta',
      terminalId: user.role === 'terminal' ? (user.linkId || '') : '',
    });
    setShowModal(true);
  };

  const handleDispatch = () => {
    if (!user || !form.description || create.isPending) return;
    const terminalId = form.terminalId || (user.role === 'terminal' ? user.linkId! : visibleTerminals[0]?.id);
    if (!terminalId) return;

    create.mutate(
      {
        type: 'Emergência',
        description: form.description,
        status: 'emergência ativa',
        // A criticidade segue o Grau de Severidade escolhido no despacho —
        // é ela que os badges das telas exibem (bug reportado em 07/07:
        // severidade "baixa" aparecia como "alta" por estar fixada aqui).
        criticality: form.severity,
        severity: form.severity,
        terminalId,
      },
      {
        onSuccess: (occ) => {
          setShowModal(false);
          setForm({ description: '', severity: 'alta', terminalId: '' });
          // A emergência nasce SEM plano ativado — o usuário escolhe qual plano de
          // ação ativar na Sala de Situação (Fase 10). O acionamento das entidades
          // já foi registrado automaticamente pelo back na criação.
          navigate(situationRoomPath(occ.id));
          toast.success(`Emergência ${occ.incNumber} disparada`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao disparar emergência'),
      },
    );
  };

  return (
    <EmergencyDispatchContext.Provider value={{ openDispatch }}>
      <Outlet />

      {/* Emergency Dispatch Modal (movido do PAESystem) */}
      <AnimatePresence>
        {showModal && user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-card border-2 border-primary/30 rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-primary px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-foreground/20 rounded-lg">
                    <Siren size={20} className="text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-primary-foreground uppercase tracking-wide">Disparar Emergência</h3>
                    <p className="text-[11px] text-primary-foreground/70">Criar ocorrência crítica com resposta imediata</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
                  <X size={18} className="text-primary-foreground" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
                  <Siren size={16} className="text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium">
                    Esta ação criará uma ocorrência com status <strong>Emergência Ativa</strong> e criticidade <strong className="capitalize">{form.severity}</strong> (conforme o grau escolhido abaixo). A Sala de Situação será aberta automaticamente.
                  </p>
                </div>

                {user.role === 'admin' && visibleTerminals.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Terminal</label>
                    <Select value={form.terminalId} onValueChange={v => setForm(f => ({ ...f, terminalId: v }))}>
                      <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione o terminal..." /></SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {visibleTerminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Descrição da emergência *</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descreva brevemente a situação de emergência..."
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Grau de Severidade *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['baixa', 'média', 'alta'] as SeverityLevel[]).map(sev => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, severity: sev }))}
                        className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                          form.severity === sev
                            ? sev === 'alta'
                              ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30'
                              : sev === 'média'
                                ? 'bg-warning text-warning-foreground border-warning shadow-lg shadow-warning/30'
                                : 'bg-success text-success-foreground border-success shadow-lg shadow-success/30'
                            : 'bg-secondary text-secondary-foreground border-border hover:border-muted-foreground'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold hover:bg-secondary/80 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDispatch}
                    disabled={!form.description || create.isPending || (user.role === 'admin' && visibleTerminals.length > 1 && !form.terminalId)}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-black uppercase tracking-wider shadow-lg shadow-primary/30 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Siren size={16} />}
                    {create.isPending ? 'Disparando...' : 'Disparar Emergência'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </EmergencyDispatchContext.Provider>
  );
}
