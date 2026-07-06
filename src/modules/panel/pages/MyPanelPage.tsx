import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getDefaultSafetySubModules, SafetySubModule } from '@/lib/modules';
import { UserTraining, ComplianceStatus } from '@/lib/types';
import { useTrainings, useTrainingAssignments, useTrainingMutations, useEpis, useEpiDeliveries, useCompliance, useComplianceMutations, useTerminals } from '@/api';
import {
  User, GraduationCap, HardHat, ClipboardCheck, CheckCircle2, AlertTriangle,
  XCircle, Clock, ExternalLink, FileText, Play, Check, Shield, AlertCircle
} from 'lucide-react';

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR'); }

type TrainingStatus = 'concluido' | 'pendente' | 'vencido';

function getTrainingStatus(ut: UserTraining | null, now: Date): TrainingStatus {
  if (!ut) return 'pendente';
  if (new Date(ut.expiryDate) < now) return 'vencido';
  return 'concluido';
}

const TRAINING_STATUS_CFG: Record<TrainingStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  concluido: { label: 'Concluído', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
  pendente: { label: 'Pendente', color: 'text-warning', bg: 'bg-warning/10', icon: Clock },
  vencido: { label: 'Vencido', color: 'text-primary', bg: 'bg-primary/10', icon: AlertTriangle },
};

const EPI_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  valido: { label: 'Válido', color: 'text-success', bg: 'bg-success/10' },
  vencido: { label: 'Vencido', color: 'text-primary', bg: 'bg-primary/10' },
  substituido: { label: 'Substituído', color: 'text-muted-foreground', bg: 'bg-secondary' },
  devolvido: { label: 'Devolvido', color: 'text-muted-foreground', bg: 'bg-secondary' },
};

export function MyPanelPage() {
  // `data` só para o licenciamento de módulos (terminalModules — Fase 5d)
  const { user, data } = useAuth();
  const { data: trainings = [] } = useTrainings();
  const { data: userTrainings = [] } = useTrainingAssignments();
  const { data: epis = [] } = useEpis();
  const { data: userEPIs = [] } = useEpiDeliveries();
  const { data: complianceItems = [] } = useCompliance();
  const { data: terminals = [] } = useTerminals();
  const { assign, removeAssignment } = useTrainingMutations();
  const { update: updateCompliance } = useComplianceMutations();
  const now = new Date();
  const [confirmedEPIs, setConfirmedEPIs] = useState<Set<string>>(new Set());
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');

  if (!user) return null;

  const terminal = user.linkId ? terminals.find(t => t.id === user.linkId) : null;

  // Active sub-modules
  const getActiveSubs = (): SafetySubModule[] => {
    if (user.role === 'admin') return getDefaultSafetySubModules();
    const config = data.terminalModules?.find(tm => tm.terminalId === user.linkId);
    return config?.activeSafetySubModules ?? getDefaultSafetySubModules();
  };
  const activeSubs = getActiveSubs();
  const hasTrainings = activeSubs.includes('trainings');
  const hasEPIs = activeSubs.includes('epis');
  const hasCompliance = activeSubs.includes('compliance');

  // === TRAININGS (only explicitly assigned to this user via userTrainings) ===
  const myTrainingRecords = userTrainings.filter(ut => ut.userId === user.id);
  const myTrainingIds = new Set(myTrainingRecords.map(r => r.trainingId));
  const myTrainings = trainings.filter(t => myTrainingIds.has(t.id));
  const trainingItems = myTrainings.map(t => {
    // Registro mais recente do treinamento (refazer cria um novo registro)
    const record = myTrainingRecords
      .filter(r => r.trainingId === t.id)
      .sort((a, b) => String(b.expiryDate).localeCompare(String(a.expiryDate)))[0] ?? null;
    const status = getTrainingStatus(record, now);
    return { training: t, record, status };
  });
  const pendingTrainings = trainingItems.filter(t => t.status === 'pendente').length;
  const expiredTrainings = trainingItems.filter(t => t.status === 'vencido').length;

  // === EPIs ===
  const myEPIs = userEPIs.filter(ue => ue.userId === user.id && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido');
  const epiItems = myEPIs.map(ue => {
    const epi = epis.find(e => e.id === ue.epiId);
    const isExpired = ue.expiryDate && new Date(ue.expiryDate) < now;
    return { userEpi: ue, epi, status: isExpired ? 'vencido' : 'valido' };
  });
  const expiredEPIs = epiItems.filter(e => e.status === 'vencido').length;

  // === COMPLIANCE ===
  const myCompliance = complianceItems.filter(
    ci => ci.userId === user.id || ci.responsible === user.name
  );

  // Actions
  const completeTraining = (trainingId: string) => {
    // Registro vencido é removido e recriado com validade nova (hoje / +1 ano no back)
    const existing = myTrainingRecords.find(r => r.trainingId === trainingId && new Date(r.expiryDate) < now);
    const doAssign = () =>
      assign.mutate({ id: trainingId, input: { userIds: [user.id] } }, {
        onSuccess: () => toast.success('Treinamento concluído'),
        onError,
      });
    if (existing) {
      removeAssignment.mutate(existing.id, { onSuccess: doAssign, onError });
    } else {
      doAssign();
    }
  };

  const confirmEPI = (userEpiId: string) => {
    setConfirmedEPIs(prev => new Set(prev).add(userEpiId));
  };

  const updateComplianceStatus = (id: string, status: ComplianceStatus) => {
    updateCompliance.mutate({ id, input: { status } }, { onError });
  };

  const totalAlerts = pendingTrainings + expiredTrainings + expiredEPIs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <User size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Meu Painel</h1>
          <p className="text-xs text-muted-foreground">
            {user.name} {terminal && <span className="text-foreground font-medium">• {terminal.name}</span>}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {hasTrainings && (
          <div className="bg-card border rounded-xl p-4 text-center">
            <GraduationCap size={16} className="mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Treinamentos</p>
            <p className="text-2xl font-mono font-bold text-foreground">{trainingItems.length}</p>
            {pendingTrainings > 0 && <p className="text-[10px] text-warning font-bold">{pendingTrainings} pendente{pendingTrainings > 1 ? 's' : ''}</p>}
          </div>
        )}
        {hasEPIs && (
          <div className="bg-card border rounded-xl p-4 text-center">
            <HardHat size={16} className="mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">EPIs</p>
            <p className="text-2xl font-mono font-bold text-foreground">{epiItems.length}</p>
            {expiredEPIs > 0 && <p className="text-[10px] text-primary font-bold">{expiredEPIs} vencido{expiredEPIs > 1 ? 's' : ''}</p>}
          </div>
        )}
        {hasCompliance && (
          <div className="bg-card border rounded-xl p-4 text-center">
            <ClipboardCheck size={16} className="mx-auto text-muted-foreground mb-1" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Conformidade</p>
            <p className="text-2xl font-mono font-bold text-foreground">{myCompliance.length}</p>
          </div>
        )}
        <div className={`bg-card border rounded-xl p-4 text-center ${totalAlerts > 0 ? 'border-warning/30' : 'border-success/30'}`}>
          <AlertCircle size={16} className={`mx-auto mb-1 ${totalAlerts > 0 ? 'text-warning' : 'text-success'}`} />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Pendências</p>
          <p className={`text-2xl font-mono font-bold ${totalAlerts > 0 ? 'text-warning' : 'text-success'}`}>{totalAlerts}</p>
        </div>
      </div>

      {/* Trainings */}
      {hasTrainings && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <GraduationCap size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Meus Treinamentos</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">{trainingItems.length} itens</span>
          </div>
          <div className="divide-y divide-border">
            {trainingItems.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhum treinamento atribuído.</div>
            )}
            {trainingItems.map(({ training: t, record, status }) => {
              const cfg = TRAINING_STATUS_CFG[status];
              const StatusIcon = cfg.icon;
              return (
                <div key={t.id} className="px-5 py-4 flex items-center gap-4">
                  <StatusIcon size={16} className={`${cfg.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      {t.mandatory && <span className="text-warning font-bold">OBRIGATÓRIO</span>}
                      {record && <span>Concluído: {fmtDate(record.completedDate)}</span>}
                      {record && <span>Validade: {fmtDate(record.expiryDate)}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  <div className="flex gap-1 shrink-0">
                    {(t.materialFileName || t.videoUrl) && (
                      <button
                        onClick={() => t.videoUrl ? window.open(t.videoUrl, '_blank') : null}
                        className="px-2.5 py-1.5 text-[10px] font-bold bg-secondary text-foreground rounded-lg hover:bg-secondary/80 flex items-center gap-1"
                      >
                        {t.videoUrl ? <Play size={10} /> : <FileText size={10} />}
                        Ver material
                      </button>
                    )}
                    {status !== 'concluido' && (
                      <button
                        onClick={() => completeTraining(t.id)}
                        className="px-2.5 py-1.5 text-[10px] font-bold bg-success/10 text-success rounded-lg hover:bg-success/20 flex items-center gap-1"
                      >
                        <Check size={10} /> Concluir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EPIs */}
      {hasEPIs && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <HardHat size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Meus EPIs</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">{epiItems.length} itens</span>
          </div>
          <div className="divide-y divide-border">
            {epiItems.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhum EPI vinculado.</div>
            )}
            {epiItems.map(({ userEpi: ue, epi, status }) => {
              const cfg = EPI_STATUS_CFG[status];
              const confirmed = confirmedEPIs.has(ue.id);
              return (
                <div key={ue.id} className="px-5 py-4 flex items-center gap-4">
                  <HardHat size={16} className={`${cfg.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{epi?.name || 'EPI'}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span>Entrega: {fmtDate(ue.deliveryDate)}</span>
                      {ue.expiryDate && <span>Validade: {fmtDate(ue.expiryDate)}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  {!confirmed ? (
                    <button
                      onClick={() => confirmEPI(ue.id)}
                      className="px-2.5 py-1.5 text-[10px] font-bold bg-success/10 text-success rounded-lg hover:bg-success/20 flex items-center gap-1 shrink-0"
                    >
                      <Check size={10} /> Confirmar ciência
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-success flex items-center gap-1 shrink-0">
                      <CheckCircle2 size={12} /> Confirmado {fmtDate(now.toISOString())}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compliance */}
      {hasCompliance && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <ClipboardCheck size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Minha Conformidade</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">{myCompliance.length} itens</span>
          </div>
          <div className="divide-y divide-border">
            {myCompliance.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhum item de conformidade atribuído.</div>
            )}
            {myCompliance.map(item => {
              const isNc = item.status === 'nao_conforme';
              const isOk = item.status === 'conforme';
              return (
                <div key={item.id} className="px-5 py-4 flex items-center gap-4">
                  {isOk ? <CheckCircle2 size={16} className="text-success shrink-0" /> :
                   isNc ? <XCircle size={16} className="text-primary shrink-0" /> :
                   <AlertCircle size={16} className="text-warning shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      {item.area && <span>{item.area}</span>}
                      {item.verificationDate && <span>Verificado: {fmtDate(item.verificationDate)}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    isOk ? 'bg-success/10 text-success' : isNc ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                  }`}>
                    {isOk ? 'Conforme' : isNc ? 'Não Conforme' : 'Atenção'}
                  </span>
                  {isNc && (
                    <button
                      onClick={() => updateComplianceStatus(item.id, 'conforme')}
                      className="px-2.5 py-1.5 text-[10px] font-bold bg-success/10 text-success rounded-lg hover:bg-success/20 flex items-center gap-1 shrink-0"
                    >
                      <Check size={10} /> Corrigir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}