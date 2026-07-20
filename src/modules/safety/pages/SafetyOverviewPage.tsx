import { useAuth } from '@/lib/auth-context';
import { useTerminals } from '@/api';
import { SafetyOverview } from '../components/SafetyOverview';
import { ShieldCheck, Lock } from 'lucide-react';
import { terminalHasSafetySub } from '@/lib/modules';

export function SafetyOverviewPage() {
  const { user } = useAuth();
  const { data: terminals = [], isLoading } = useTerminals();

  // Admin only
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Lock size={24} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          A Visão Geral do Centro de Segurança Operacional está disponível apenas para administradores.
        </p>
      </div>
    );
  }

  // Admin enxerga a união dos sub-módulos ativos entre todos os terminais reais
  // (config vinda da API — item 7/8). Conformidade é derivada em `terminalHasSafetySub`.
  const hasTrainings = terminals.some(t => terminalHasSafetySub(t, 'trainings'));
  const hasEPIs = terminals.some(t => terminalHasSafetySub(t, 'epis'));
  const hasCompliance = terminals.some(t => terminalHasSafetySub(t, 'compliance'));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Carregando indicadores…
      </div>
    );
  }

  // Se nenhum sub-módulo Safety está ativo em nenhum terminal
  if (!hasTrainings && !hasEPIs && !hasCompliance) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <ShieldCheck size={24} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">Nenhum módulo ativo</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Ative EPIs, Treinamentos ou Conformidade nos terminais para visualizar os indicadores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Centro de Segurança Operacional</h1>
          <p className="text-xs text-muted-foreground">Monitoramento contínuo da conformidade operacional e prontidão das equipes</p>
        </div>
      </div>

      <SafetyOverview
        hasTrainings={hasTrainings}
        hasEPIs={hasEPIs}
        hasCompliance={hasCompliance}
      />
    </div>
  );
}
