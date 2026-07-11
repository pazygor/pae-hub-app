import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Occurrence, TimelineEvent, EmergencyPlan } from '@/lib/types';
import { ShieldAlert, CheckCircle, Circle, AlertTriangle, Phone, ClipboardList, Clock } from 'lucide-react';

interface EmergencyAction {
  id: string;
  text: string;
  done: boolean;
}

const DEFAULT_ACTIONS: Omit<EmergencyAction, 'id'>[] = [
  { text: 'Notificar equipe do terminal', done: false },
  { text: 'Registrar acionamento da autoridade portuária', done: false },
  { text: 'Iniciar checklist de resposta', done: false },
  { text: 'Registrar atualização na linha do tempo', done: false },
];

interface Props {
  occurrence: Occurrence;
  plans: EmergencyPlan[];
  onActivate: (occId: string, planName: string) => void;
  onActionComplete: (occId: string, actionText: string) => void;
}

export function EmergencyResponseSection({ occurrence, plans, onActivate, onActionComplete }: Props) {
  const { user } = useAuth();
  const [actions, setActions] = useState<EmergencyAction[]>(() =>
    DEFAULT_ACTIONS.map((a, i) => ({ ...a, id: `ea-${i}` }))
  );

  if (!user) return null;

  const isEmergencyActive = occurrence.status === 'emergência ativa';
  const canActivate = user.role === 'admin' || user.role === 'terminal';
  const canInteract = canActivate; // entity can only watch
  const terminalPlans = plans.filter(p => p.terminalId === occurrence.terminalId && p.status === 'ativo');

  const handleActivate = () => {
    const planName = terminalPlans.length > 0 ? terminalPlans[0].name : 'Plano de Emergência';
    onActivate(occurrence.id, planName);
  };

  const toggleAction = (action: EmergencyAction) => {
    if (!canInteract || action.done) return;
    setActions(prev => prev.map(a => a.id === action.id ? { ...a, done: true } : a));
    onActionComplete(occurrence.id, action.text);
  };

  // Ocorrência resolvida não oferece resposta de emergência (nada a acionar).
  if (occurrence.status === 'resolvido') return null;
  if (!isEmergencyActive && !canActivate) return null;

  return (
    <div className="border-t border-border bg-background/50">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={16} className="text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Resposta de Emergência</h4>
        </div>

        {!isEmergencyActive && canActivate && (
          <div className="space-y-2">
            {terminalPlans.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Plano disponível: <span className="font-bold text-foreground">{terminalPlans[0].name}</span>
              </p>
            )}
            <button
              onClick={handleActivate}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity animate-pulse"
            >
              <ShieldAlert size={14} />
              Ativar Plano de Emergência
            </button>
          </div>
        )}

        {isEmergencyActive && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <AlertTriangle size={14} className="text-primary" />
              <span className="text-xs font-bold text-primary">EMERGÊNCIA ATIVA</span>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Ações de Resposta</p>
              {actions.map(action => (
                <button
                  key={action.id}
                  onClick={() => toggleAction(action)}
                  disabled={action.done || !canInteract}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                    action.done
                      ? 'bg-success/10 text-success'
                      : canInteract
                        ? 'bg-card border border-border text-foreground hover:bg-secondary/50 cursor-pointer'
                        : 'bg-card border border-border text-muted-foreground'
                  }`}
                >
                  {action.done
                    ? <CheckCircle size={14} className="shrink-0" />
                    : <Circle size={14} className="shrink-0 text-muted-foreground" />
                  }
                  <span className={action.done ? 'line-through' : ''}>{action.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
