import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { situationRoomPath } from '@/lib/nav-config';
import { Occurrence, EntityNotificationStatus } from '@/lib/types';
import {
  Activity, Clock, Shield, Users, CheckCircle, AlertTriangle, Siren,
  ChevronDown, ChevronRight, FileText, Timer, Radio, Eye
} from 'lucide-react';
import { generateIncidentPDF } from '../components/generateIncidentPDF';
import { useOccurrences, useTerminals, useEntities, usePermissions, useEntityNotifications, useEntityNotificationMutations } from '@/api';

/* ── helpers ──────────────────────────────────────────────── */

function elapsed(from: string, to: string): string {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const statusColor: Record<EntityNotificationStatus, string> = {
  Notificada: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  Confirmada: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  Pendente: 'bg-muted text-muted-foreground border-border',
  'Em Atendimento': 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
};

// Progressão oficial (Funcional §4.3): Notificada → Em Atendimento → Confirmada
const statusOrder: EntityNotificationStatus[] = ['Notificada', 'Em Atendimento', 'Confirmada'];

export function OrchestrationPage() {
  const navigate = useNavigate();
  const openSituationRoom = (id: string) => navigate(situationRoomPath(id));
  // `data` só para as partes do PDF ainda mockadas (planos/riscos/docs — 5a)
  const { user, data } = useAuth();
  const { data: occurrences = [] } = useOccurrences();
  const { data: terminals = [] } = useTerminals();
  const { data: entities = [] } = useEntities();
  const { data: permissions = [] } = usePermissions();
  const { data: entityNotifications = [] } = useEntityNotifications();
  const { setStatus } = useEntityNotificationMutations();
  const [expandedOcc, setExpandedOcc] = useState<string | null>(null);

  /* ── filtered occurrences (emergências ativas + resolvidas recentes) ── */
  const orchestratedOccs = useMemo(() => {
    if (!user) return [];
    return occurrences
      .filter(o => o.status === 'emergência ativa' || o.status === 'resolvido' || o.status === 'em atendimento')
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [occurrences, user]);

  /* ── metrics for an occurrence ── */
  const getMetrics = (occ: Occurrence) => {
    const registered = occ.timeline.find(e => e.type === 'ocorrência registrada');
    const planActivated = occ.timeline.find(e => e.type === 'plano de emergência ativado');
    const firstEntity = occ.timeline.find(e => e.type === 'entidade notificada');
    const resolved = occ.timeline.find(e => e.type === 'ocorrência resolvida');

    return {
      responseTime: registered && planActivated ? elapsed(registered.dateTime, planActivated.dateTime) : null,
      entityTime: registered && firstEntity ? elapsed(registered.dateTime, firstEntity.dateTime) : null,
      resolutionTime: registered && resolved ? elapsed(registered.dateTime, resolved.dateTime) : null,
      totalEvents: occ.timeline.length,
    };
  };

  /* ── entity notifications for an occurrence ── */
  const getNotifications = (occId: string) =>
    entityNotifications.filter(n => n.occurrenceId === occId);

  /* ── advance entity status (Notificada → Em Atendimento → Confirmada) ── */
  const advanceEntityStatus = (notifId: string) => {
    const n = entityNotifications.find(x => x.id === notifId);
    if (!n) return;
    const currentIdx = statusOrder.indexOf(n.status);
    if (currentIdx < 0 || currentIdx >= statusOrder.length - 1) return;
    setStatus.mutate(
      { id: notifId, status: statusOrder[currentIdx + 1] },
      { onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao avançar status') },
    );
  };

  /* ── global metrics ── */
  const activeEmergencies = useMemo(() => occurrences.filter(o => o.status === 'emergência ativa').length, [occurrences]);
  const totalNotifications = entityNotifications.length;
  const confirmedNotifications = entityNotifications.filter(n => n.status === 'Confirmada' || n.status === 'Em Atendimento').length;
  const avgResponseEvents = orchestratedOccs.length > 0
    ? Math.round(orchestratedOccs.reduce((sum, o) => sum + o.timeline.length, 0) / orchestratedOccs.length)
    : 0;

  if (!user) return null;

  const handleGenerateReport = (occ: Occurrence) => {
    // Dados reais para o PDF (planos/riscos/docs seguem mock até a Fase 5a)
    generateIncidentPDF(occ, { ...data, terminals, entities, permissions });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Activity size={20} className="text-primary" />
          <h2 className="text-lg font-black uppercase tracking-wider text-foreground">Orquestração de Emergência</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Comando, rastreabilidade e auditoria de emergências operacionais
        </p>
      </div>

      {/* Global Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Siren} label="Emergências Ativas" value={activeEmergencies} variant="emergency" />
        <MetricCard icon={Users} label="Entidades Acionadas" value={totalNotifications} variant="default" />
        <MetricCard icon={CheckCircle} label="Confirmações" value={confirmedNotifications} variant="success" />
        <MetricCard icon={Radio} label="Média Eventos/Incidente" value={avgResponseEvents} variant="default" />
      </div>

      {/* Occurrences List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Incidentes Orquestrados ({orchestratedOccs.length})
        </h3>

        {orchestratedOccs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum incidente para orquestrar.
          </div>
        )}

        {orchestratedOccs.map(occ => {
          const terminal = terminals.find(t => t.id === occ.terminalId);
          const metrics = getMetrics(occ);
          const notifs = getNotifications(occ.id);
          const isExpanded = expandedOcc === occ.id;
          const isActive = occ.status === 'emergência ativa';

          return (
            <div
              key={occ.id}
              className={`border rounded-xl overflow-hidden transition-colors ${
                isActive ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              }`}
            >
              {/* Occurrence Header */}
              <button
                onClick={() => setExpandedOcc(isExpanded ? null : occ.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
              >
                {isExpanded ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={14} className="shrink-0 text-muted-foreground" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-primary">{occ.incNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      isActive ? 'bg-primary/15 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {occ.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{occ.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {terminal?.name} — {fmtDate(occ.dateTime)} {fmtTime(occ.dateTime)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {metrics.responseTime && (
                    <div className="text-right hidden md:block">
                      <p className="text-[9px] text-muted-foreground uppercase">Resposta</p>
                      <p className="text-xs font-bold text-foreground">{metrics.responseTime}</p>
                    </div>
                  )}
                  <span className="text-[10px] font-bold text-muted-foreground">{occ.timeline.length} eventos</span>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-secondary/20 border-b border-border">
                    <button
                      onClick={() => openSituationRoom(occ.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all"
                    >
                      <Eye size={12} />
                      Sala de Situação
                    </button>
                    <button
                      onClick={() => handleGenerateReport(occ)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors border border-border"
                    >
                      <FileText size={12} />
                      Relatório PDF
                    </button>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                    <MiniMetric label="Tempo de Resposta" value={metrics.responseTime || '—'} icon={Timer} />
                    <MiniMetric label="Acionamento Entidades" value={metrics.entityTime || '—'} icon={Clock} />
                    <MiniMetric label="Tempo Resolução" value={metrics.resolutionTime || '—'} icon={CheckCircle} />
                    <MiniMetric label="Total Eventos" value={String(metrics.totalEvents)} icon={Activity} />
                  </div>

                  {/* Entity Notifications */}
                  {notifs.length > 0 && (
                    <div className="px-4 py-3 border-t border-border">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Shield size={12} />
                        Entidades Acionadas ({notifs.length})
                      </h4>
                      <div className="space-y-1.5">
                        {notifs.map(notif => {
                          const entityName = notif.entityName || entities.find(e => e.id === notif.entityId)?.name;
                          const canAdvance = user.role === 'admin' && statusOrder.indexOf(notif.status) < statusOrder.length - 1;
                          return (
                            <div key={notif.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30 border border-border">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground">{entityName || notif.entityId}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusColor[notif.status]}`}>
                                    {notif.status}
                                  </span>
                                  {notif.mandatory && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-bold">OBRIGATÓRIA</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">Acionada: {fmtTime(notif.dateTime)}</span>
                                  {notif.confirmedAt && <span className="text-[10px] text-blue-500">Confirmada: {fmtTime(notif.confirmedAt)}</span>}
                                  {notif.respondingAt && <span className="text-[10px] text-emerald-500">Em atendimento: {fmtTime(notif.respondingAt)}</span>}
                                </div>
                              </div>
                              {canAdvance && (
                                <button
                                  onClick={() => advanceEntityStatus(notif.id)}
                                  className="px-2.5 py-1.5 text-[10px] font-bold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors border border-primary/20"
                                >
                                  Avançar →
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Audit Timeline */}
                  <div className="px-4 py-3 border-t border-border">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Clock size={12} />
                      Linha do Tempo Auditável ({occ.timeline.length} registros)
                    </h4>
                    <div className="space-y-0.5 max-h-64 overflow-y-auto">
                      {occ.timeline.map((evt, idx) => (
                        <div key={evt.id} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-secondary/20 transition-colors group">
                          <div className="flex flex-col items-center shrink-0">
                            <span className="w-2 h-2 rounded-full bg-primary/60 mt-1.5" />
                            {idx < occ.timeline.length - 1 && <span className="w-px flex-1 bg-border mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-foreground uppercase">{evt.type}</span>
                              <span className="text-[9px] text-muted-foreground">{fmtTime(evt.dateTime)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">por {evt.userName}</p>
                          </div>
                          <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {fmtDate(evt.dateTime)} {fmtTime(evt.dateTime)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle size={10} />
                        Registros imutáveis — não editáveis após inserção. Adequado para auditoria e compliance.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function MetricCard({ icon: Icon, label, value, variant = 'default' }: {
  icon: React.ElementType; label: string; value: number; variant?: 'default' | 'emergency' | 'success';
}) {
  const bg = variant === 'emergency' ? 'bg-primary/10 border-primary/20' : variant === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-card border-border';
  const iconColor = variant === 'emergency' ? 'text-primary' : variant === 'success' ? 'text-emerald-500' : 'text-muted-foreground';
  return (
    <div className={`${bg} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={iconColor} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={10} className="text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground uppercase">{label}</span>
      </div>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
