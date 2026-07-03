import { createContext, useContext, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Occurrence, SeverityLevel, EntityNotification } from '@/lib/types';
import { situationRoomPath } from '@/lib/nav-config';

/**
 * Provider do fluxo de "Disparar Emergência" (lógica movida do PAESystem).
 * É uma layout-route: renderiza <Outlet/> + o modal global, e expõe
 * useEmergencyDispatch() para qualquer tela (header, painel mobile, etc.).
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
  const { user, data, setData } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    description: '',
    severity: 'alta' as SeverityLevel,
    terminalId: '',
  });

  const visibleTerminals = !user
    ? []
    : user.role === 'admin'
      ? data.terminals
      : user.role === 'terminal' && user.linkId
        ? data.terminals.filter(t => t.id === user.linkId)
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

  const generateIncNumber = () => {
    const existing = data.occurrences
      .map(o => o.incNumber)
      .filter(n => n && n.startsWith('INC-'))
      .map(n => parseInt(n.replace('INC-', ''), 10))
      .filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `INC-${next.toString().padStart(4, '0')}`;
  };

  const handleDispatch = () => {
    if (!user || !form.description) return;
    const terminalId = form.terminalId || (user.role === 'terminal' ? user.linkId! : visibleTerminals[0]?.id);
    if (!terminalId) return;
    const now = new Date().toISOString();
    const ts = Date.now();
    const incNumber = generateIncNumber();
    const occId = `o${ts}`;

    // Regras de acionamento para o tipo 'Emergência'
    const matchingRules = data.notificationRules.filter(r => r.occurrenceType === 'Emergência');

    const notificationEvents = matchingRules.map((rule, idx) => {
      const entityName = data.entities.find(e => e.id === rule.entityId)?.name || rule.entityId;
      const contact = data.entities.find(e => e.id === rule.entityId)?.contact || '';
      return {
        id: `tl${ts + 2 + idx}`,
        dateTime: now,
        type: 'entidade notificada' as const,
        description: `${entityName} notificada automaticamente${contact ? ` via ${contact}` : ''}${rule.mandatory ? ' [OBRIGATÓRIA]' : ''}`,
        userName: 'Sistema',
      };
    });

    const newNotifications: EntityNotification[] = matchingRules.map((rule, idx) => ({
      id: `en${ts + idx}`,
      occurrenceId: occId,
      entityId: rule.entityId,
      dateTime: now,
      status: 'Notificada' as const,
      mandatory: rule.mandatory,
    }));

    const newOcc: Occurrence = {
      id: occId,
      incNumber,
      terminalId,
      dateTime: now,
      type: 'Emergência',
      description: form.description,
      status: 'emergência ativa',
      criticality: 'alta',
      severity: form.severity,
      responsible: user.name,
      team: '',
      timeline: [
        { id: `tl${ts}`, dateTime: now, type: 'ocorrência registrada', description: `[DISPARO DE EMERGÊNCIA] ${form.description}`, userName: user.name },
        { id: `tl${ts + 1}`, dateTime: now, type: 'plano de emergência ativado', description: `Emergência disparada com severidade ${form.severity.toUpperCase()} — resposta imediata iniciada`, userName: user.name },
        ...notificationEvents,
      ],
    };
    setData(d => ({
      ...d,
      occurrences: [...d.occurrences, newOcc],
      entityNotifications: [...d.entityNotifications, ...newNotifications],
    }));
    setShowModal(false);
    setForm({ description: '', severity: 'alta', terminalId: '' });
    navigate(situationRoomPath(newOcc.id));
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
                    Esta ação criará uma ocorrência com criticidade <strong>Alta</strong> e status <strong>Emergência Ativa</strong>. A Sala de Situação será aberta automaticamente.
                  </p>
                </div>

                {user.role === 'admin' && visibleTerminals.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Terminal</label>
                    <select
                      value={form.terminalId}
                      onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecione o terminal...</option>
                      {visibleTerminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Descrição da emergência *</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descreva brevemente a situação de emergência..."
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
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
                    disabled={!form.description || (user.role === 'admin' && visibleTerminals.length > 1 && !form.terminalId)}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-black uppercase tracking-wider shadow-lg shadow-primary/30 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Siren size={16} />
                    Disparar Emergência
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
