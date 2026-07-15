import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Occurrence, EmergencyPlan } from '@/lib/types';
import { ShieldAlert, ShieldCheck, ArrowRight } from 'lucide-react';
import { PlanActivationModal } from './PlanActivationModal';

interface Props {
  occurrence: Occurrence;
  plans: EmergencyPlan[];
  onActivatePlan: (occId: string, planId: string) => void;
  onOpenSituationRoom: (occId: string) => void;
  activating?: boolean;
}

/**
 * Bloco de "Resposta de Emergência" na lista de Ocorrências. Fase 10: a ativação
 * do plano passa por um modal de escolha (planos ativos do terminal) — não mais
 * fixo/mockado. O "plano ativo" é derivado da timeline (imutável), independente do
 * status: atender/encerrar a ocorrência não desativa o plano.
 */
export function EmergencyResponseSection({ occurrence, plans, onActivatePlan, onOpenSituationRoom, activating }: Props) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (!user) return null;

  const canActivate = user.role === 'admin' || user.role === 'terminal';
  const activePlans = plans.filter(p => p.terminalId === occurrence.terminalId && p.status === 'ativo');

  // Plano ativo = último evento "plano de emergência ativado" na timeline (não o status).
  const planEvents = (occurrence.timeline ?? []).filter(e => e.type === 'plano de emergência ativado');
  const lastPlanEvent = planEvents[planEvents.length - 1];
  const hasPlanActivated = !!lastPlanEvent;
  const activePlanName = lastPlanEvent
    ? (plans.find(p => lastPlanEvent.description.startsWith(p.name))?.name ?? lastPlanEvent.description.split(' ativado —')[0])
    : '';

  // Ocorrência resolvida não oferece resposta de emergência (nada a acionar).
  if (occurrence.status === 'resolvido') return null;
  // Sem plano ativo e sem permissão de ativar (entidade) → nada a mostrar.
  if (!hasPlanActivated && !canActivate) return null;

  return (
    <div className="border-t border-border bg-background/50">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={16} className="text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Resposta de Emergência</h4>
        </div>

        {hasPlanActivated && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-success/10 border border-success/20 rounded-lg">
            <ShieldCheck size={14} className="text-success shrink-0" />
            <span className="text-xs font-bold text-success">PLANO ATIVO:</span>
            <span className="text-xs font-medium text-foreground truncate">{activePlanName}</span>
          </div>
        )}

        {canActivate && (
          <div className="flex flex-wrap items-center gap-2">
            {activePlans.length > 0 ? (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              >
                <ShieldAlert size={14} />
                {hasPlanActivated ? 'Trocar Plano de Emergência' : 'Ativar Plano de Emergência'}
              </button>
            ) : (
              !hasPlanActivated && <p className="text-[11px] text-muted-foreground italic">Nenhum plano ativo cadastrado para este terminal.</p>
            )}
            <button
              onClick={() => onOpenSituationRoom(occurrence.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
            >
              Abrir Sala de Situação <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      <PlanActivationModal
        open={showModal}
        onOpenChange={setShowModal}
        plans={activePlans}
        onConfirm={(planId) => { onActivatePlan(occurrence.id, planId); setShowModal(false); }}
        isPending={activating}
      />
    </div>
  );
}
