import { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, ListChecks, Loader2 } from 'lucide-react';
import { EmergencyPlan } from '@/lib/types';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Planos candidatos (o chamador passa os ATIVOS do terminal da ocorrência). */
  plans: EmergencyPlan[];
  onConfirm: (planId: string) => void;
  isPending?: boolean;
}

/**
 * Modal de escolha do Plano de Ação a ativar numa emergência (Fase 10). Substitui
 * a ativação fixa (sempre o primeiro plano). Ao confirmar, o back aplica o
 * checklist do plano escolhido à ocorrência.
 */
export function PlanActivationModal({ open, onOpenChange, plans, onConfirm, isPending }: Props) {
  const [selected, setSelected] = useState<string>('');

  // Pré-seleciona o primeiro quando abre (ou limpa ao fechar).
  useEffect(() => {
    if (open) setSelected(plans[0]?.id ?? '');
    else setSelected('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="p-1.5 bg-primary/10 rounded-lg"><ShieldAlert size={16} className="text-primary" /></span>
            Ativar Plano de Emergência
          </DialogTitle>
          <DialogDescription>
            Escolha qual plano de ação será ativado. O <strong className="text-foreground">checklist do plano</strong>{' '}
            passará a ser o checklist de resposta desta ocorrência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto py-1">
          {plans.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              Nenhum plano <strong>ativo</strong> cadastrado para este terminal.
            </p>
          )}
          {plans.map(p => {
            const isSel = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                  isSel ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${isSel ? 'text-primary' : 'text-muted-foreground/40'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <ListChecks size={11} /> {p.checklist.length} passo(s){p.responsible ? ` · Resp: ${p.responsible}` : ''}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-md cursor-pointer hover:bg-secondary/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || isPending}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-1.5"
          >
            {isPending && <Loader2 size={12} className="animate-spin" />} Ativar Plano
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
