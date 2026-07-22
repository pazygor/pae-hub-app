import { useState, useEffect, useRef, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { TimelineEventType } from '@/lib/types';
import { generateIncidentPDF } from '../components/generateIncidentPDF';
import { OccurrenceChat } from '../components/OccurrenceChat';
import { PlanActivationModal } from '../components/PlanActivationModal';
import {
  ShieldAlert, Clock, AlertTriangle, User, CheckCircle, Circle,
  Play, RefreshCw, Bell, Paperclip, FileText, MapPin, Siren,
  ArrowLeft, Timer, Plus, ChevronDown, ChevronUp, Building2,
  Radio, X, Flame, Droplets, Route, Triangle, Users as UsersIcon, Download,
  Navigation, ExternalLink, Flag, Loader2
} from 'lucide-react';
import L from 'leaflet';
import { useOccurrence, useOccurrenceMutations, useTerminals, useEntities, usePermissions, useRisks, usePlans, useDocuments, useMapElements, auditApi } from '@/api';
import { fileUrl } from '@/api/client';

const EVENT_TYPES: TimelineEventType[] = [
  'ocorrência registrada', 'equipe acionada', 'plano de emergência ativado',
  'entidade notificada', 'ação executada', 'atualização de status', 'ocorrência resolvida',
];

// Dedupe de abertura da Sala (auditoria): última abertura registrada por ocorrência,
// em nível de módulo — sobrevive a remontagens do componente. Janela curta.
const recentSalaOpens = new Map<string, number>();
const SALA_OPEN_DEDUPE_MS = 30_000;

const eventIcon = (type: TimelineEventType) => {
  switch (type) {
    case 'ocorrência registrada': return <AlertTriangle size={12} />;
    case 'equipe acionada': return <User size={12} />;
    case 'plano de emergência ativado': return <Play size={12} />;
    case 'entidade notificada': return <Bell size={12} />;
    case 'ação executada': return <CheckCircle size={12} />;
    case 'atualização de status': return <RefreshCw size={12} />;
    case 'ocorrência resolvida': return <CheckCircle size={12} />;
  }
};

const eventDotColor = (type: TimelineEventType) => {
  switch (type) {
    case 'ocorrência registrada': return 'bg-primary';
    case 'equipe acionada': return 'bg-warning';
    case 'plano de emergência ativado': return 'bg-primary';
    case 'entidade notificada': return 'bg-accent';
    case 'ação executada': return 'bg-success';
    case 'atualização de status': return 'bg-muted-foreground';
    case 'ocorrência resolvida': return 'bg-success';
  }
};

const criticalityColor = (c: string) => {
  switch (c) {
    case 'baixa': return 'bg-success/10 text-success';
    case 'média': return 'bg-warning/10 text-warning';
    case 'alta': return 'bg-primary/10 text-primary';
    case 'crítica': return 'bg-primary/20 text-primary font-black';
    default: return 'bg-muted text-muted-foreground';
  }
};

const statusColor = (s: string) =>
  s === 'aberto' ? 'bg-primary/10 text-primary'
  : s === 'em atendimento' ? 'bg-warning/10 text-warning'
  : s === 'emergência ativa' ? 'bg-primary/10 text-primary font-black'
  : 'bg-success/10 text-success';

const LAYER_ICONS: Record<string, React.ReactNode> = {
  fire_equipment: <Flame size={12} />,
  hydrant: <Droplets size={12} />,
  evacuation_route: <Route size={12} />,
  risk_area: <Triangle size={12} />,
  meeting_point: <UsersIcon size={12} />,
};

const LAYER_COLORS: Record<string, string> = {
  fire_equipment: '#ef4444',
  hydrant: '#3b82f6',
  evacuation_route: '#22c55e',
  risk_area: '#f59e0b',
  meeting_point: '#8b5cf6',
};

const LAYER_LABELS: Record<string, string> = {
  fire_equipment: 'Equipamentos',
  hydrant: 'Hidrantes',
  evacuation_route: 'Rotas de Evacuação',
  risk_area: 'Áreas de Risco',
  meeting_point: 'Pontos de Encontro',
};

export function SituationRoomPage() {
  const { id: occurrenceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Volta no histórico quando possível; em deep-link direto, cai na lista.
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  const onBack = () => (canGoBack ? navigate(-1) : navigate('/ocorrencias'));
  // `data` permanece só para o shape do AppData exigido pelo gerador de PDF
  const { user, data } = useAuth();
  const { data: occurrence, isLoading, isError } = useOccurrence(occurrenceId);
  const { data: terminals = [] } = useTerminals();
  const { data: entities = [] } = useEntities();
  const { data: permissions = [] } = usePermissions();
  const { data: risks = [] } = useRisks();
  const { data: plans = [] } = usePlans();
  const { data: documents = [] } = useDocuments();
  const { data: mapElements = [] } = useMapElements();
  const { setStatus, addTimeline, toggleChecklistItem, activatePlan } = useOccurrenceMutations();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [showTimelineForm, setShowTimelineForm] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [timelineForm, setTimelineForm] = useState<{ type: TimelineEventType; description: string; attachment: string }>({
    type: 'ação executada', description: '', attachment: '',
  });

  // Auditoria (item 2): registra a abertura da Sala de Situação. O dedupe fica no
  // `recentSalaOpens` (nível de módulo, fora do componente) porque um guard por
  // `useRef` não sobrevive a uma remontagem de instância — e sem StrictMode ainda
  // pode haver remontagem (HMR, navegação). O back também deduplica por janela.
  useEffect(() => {
    if (!occurrenceId) return;
    const now = Date.now();
    const last = recentSalaOpens.get(occurrenceId) ?? 0;
    if (now - last < SALA_OPEN_DEDUPE_MS) return;
    recentSalaOpens.set(occurrenceId, now);
    auditApi.logView({ action: 'open_situation_room', resource: 'occurrence', resourceId: occurrenceId }).catch(() => {});
  }, [occurrenceId]);

  const terminal = occurrence ? terminals.find(t => t.id === occurrence.terminalId) : undefined;
  // Planos ATIVOS do terminal (Fase 10: o usuário escolhe qual ativar, não mais fixo).
  const terminalActivePlans = occurrence ? plans.filter(p => p.terminalId === occurrence.terminalId && p.status === 'ativo') : [];
  // Plano ativo derivado da timeline (imutável), independente do status da ocorrência.
  const planEvents = (occurrence?.timeline ?? []).filter(e => e.type === 'plano de emergência ativado');
  const lastPlanEvent = planEvents[planEvents.length - 1];
  const hasPlanActivated = !!lastPlanEvent;
  const activePlanName = lastPlanEvent
    ? (plans.find(p => lastPlanEvent.description.startsWith(p.name))?.name ?? lastPlanEvent.description.split(' ativado —')[0])
    : '';
  const terminalRisks = occurrence ? risks.filter(r => r.terminalId === occurrence.terminalId) : [];
  const terminalDocs = occurrence ? documents.filter(d => d.terminalId === occurrence.terminalId) : [];
  const terminalElements = useMemo(
    () => (occurrence ? mapElements.filter(el => el.terminalId === occurrence.terminalId) : []),
    [mapElements, occurrence?.terminalId],
  );
  const timeline = occurrence ? [...(occurrence.timeline || [])].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()) : [];
  const checklist = occurrence?.checklist ?? [];

  const involvedEntities = useMemo(() => {
    if (!occurrence) return [];
    const entityIds = permissions
      .filter(p => p.terminalIds.includes(occurrence.terminalId))
      .map(p => p.entityId);
    return entities.filter(e => entityIds.includes(e.id));
  }, [permissions, entities, occurrence?.terminalId]);

  const elapsed = useMemo(() => {
    if (!occurrence) return '';
    const start = new Date(occurrence.dateTime).getTime();
    const now = Date.now();
    const diffMs = now - start;
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ${hrs % 24}h`;
    if (hrs > 0) return `${hrs}h ${mins % 60}min`;
    return `${mins}min`;
  }, [occurrence?.dateTime]);

  // Map
  useEffect(() => {
    if (!mapRef.current || !terminal) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    const map = L.map(mapRef.current, { zoomControl: false }).setView([terminal.lat, terminal.lng], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.circleMarker([terminal.lat, terminal.lng], {
      radius: 10, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.8, weight: 3,
    }).addTo(map).bindPopup(`<b>${terminal.name}</b><br/>${occurrence?.type || ''}`);

    terminalElements.forEach(el => {
      const color = LAYER_COLORS[el.layerType] || '#888';
      L.circleMarker([el.lat, el.lng], {
        radius: 6, color, fillColor: color, fillOpacity: 0.7, weight: 2,
      }).addTo(map).bindPopup(`<b>${el.name}</b><br/>${el.description}`);
    });

    mapInstanceRef.current = map;
    // Leaflet às vezes inicializa antes de o container ter o tamanho final (dentro
    // do grid/card), renderizando só um pedaço dos tiles. Recalcula o tamanho após
    // o layout assentar para carregar todos os tiles.
    const t1 = setTimeout(() => map.invalidateSize(), 0);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); map.remove(); mapInstanceRef.current = null; };
  }, [terminal, terminalElements, occurrence?.type]);

  // Carregando da API (deep-link/F5): loader antes de decidir redirect.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Carregando Sala de Situação...
      </div>
    );
  }
  // Ocorrência inexistente (ex.: deep-link inválido) → volta para a lista.
  if (isError || !occurrence || !user) return <Navigate to="/ocorrencias" replace />;

  const canAct = user.role === 'admin' || user.role === 'terminal';
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');
  // Dados reais para o PDF (Fase 5a completa: riscos/planos/docs também da API)
  const pdfData = { ...data, terminals, entities, permissions, risks, plans, documents, mapElements };

  const formatDate = (dt: string) => {
    const d = new Date(dt);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };
  const formatTime = (dt: string) => new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Actions
  const handleActivatePlan = (planId: string) => {
    if (!occurrenceId) return;
    activatePlan.mutate(
      { id: occurrenceId, planId },
      {
        onSuccess: () => { setShowPlanModal(false); toast.success('Plano ativado — checklist aplicado à ocorrência'); },
        onError,
      },
    );
  };

  const resolveOccurrence = () => {
    if (!occurrenceId) return;
    setStatus.mutate(
      { id: occurrenceId, status: 'resolvido', comment: 'Ocorrência encerrada pela Sala de Situação' },
      { onSuccess: () => toast.success('Ocorrência encerrada'), onError },
    );
  };

  const addTimelineEvent = () => {
    if (!timelineForm.description || !occurrenceId) return;
    addTimeline.mutate(
      { id: occurrenceId, input: { type: timelineForm.type, description: timelineForm.description, attachment: timelineForm.attachment || undefined } },
      {
        onSuccess: () => { setTimelineForm({ type: 'ação executada', description: '', attachment: '' }); setShowTimelineForm(false); },
        onError,
      },
    );
  };

  const toggleChecklist = (id: string) => {
    if (!canAct || !occurrenceId) return;
    const item = checklist.find(c => c.id === id);
    if (!item) return;
    toggleChecklistItem.mutate({ id: occurrenceId, itemId: id, done: !item.done }, { onError });
  };

  const completedCount = checklist.filter(c => c.done).length;

  return (
    <div className="space-y-4">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-foreground">Sala de Situação</h2>
        </div>
      </div>

      {/* 1. Occurrence Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded">{occurrence.incNumber}</span>
              <span className="text-base font-bold text-foreground">{occurrence.type}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(occurrence.status)}`}>{occurrence.status}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${criticalityColor(occurrence.criticality)}`}>{occurrence.criticality}</span>
            </div>
            <p className="text-xs text-muted-foreground">{occurrence.description}</p>
            <div className="flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin size={12} /> {terminal?.name || occurrence.terminalId}</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(occurrence.dateTime)}</span>
              <span className="flex items-center gap-1 font-bold text-foreground bg-secondary px-2 py-0.5 rounded-full"><Timer size={12} /> {elapsed}</span>
              {occurrence.responsible && <span className="flex items-center gap-1"><User size={12} /> {occurrence.responsible}</span>}
            </div>
          </div>
          {/* Quick Actions */}
          {canAct && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {occurrence.status !== 'resolvido' && terminalActivePlans.length > 0 && (
                <button onClick={() => setShowPlanModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg cursor-pointer hover:opacity-90 transition-opacity">
                  <ShieldAlert size={14} /> {hasPlanActivated ? 'Trocar Plano' : 'Ativar Plano'}
                </button>
              )}
              <button onClick={() => setShowTimelineForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 transition-colors">
                <Plus size={14} /> Evento
              </button>
              <button onClick={() => generateIncidentPDF(occurrence, pdfData)} className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 transition-colors">
                <Download size={14} /> Relatório PDF
              </button>
              {occurrence.status !== 'resolvido' && (
                <button onClick={resolveOccurrence} className="flex items-center gap-1.5 px-3 py-2 bg-success/10 text-success text-xs font-bold rounded-lg hover:bg-success/20 transition-colors">
                  <CheckCircle size={14} /> Encerrar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Plano</p>
          <p className={`text-sm font-bold ${hasPlanActivated ? 'text-success' : 'text-muted-foreground'}`}>
            {hasPlanActivated ? 'Ativado' : 'Pendente'}
          </p>
          {hasPlanActivated && activePlanName && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={activePlanName}>{activePlanName}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Eventos</p>
          <p className="text-sm font-bold text-foreground">{timeline.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Riscos</p>
          <p className="text-sm font-bold text-foreground">{terminalRisks.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Documentos</p>
          <p className="text-sm font-bold text-foreground">{terminalDocs.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Checklist</p>
          <p className={`text-sm font-bold ${hasPlanActivated ? 'text-foreground' : 'text-muted-foreground'}`}>
            {hasPlanActivated ? `${completedCount}/${checklist.length}` : '—'}
          </p>
        </div>
      </div>

      {/* Main grid: Map + Timeline + Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 3. Map */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <MapPin size={14} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Mapa Operacional</h3>
          </div>
          <div ref={mapRef} className="h-[350px] w-full" />
          {/* Legend */}
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Terminal
            </span>
            {Object.entries(LAYER_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LAYER_COLORS[key] }} /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* 5. Checklist — vem do Plano de Ação ativo (Fase 10). Sem plano ativo, CTA. */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Checklist de Resposta</h3>
            </div>
            {hasPlanActivated && (
              <span className="text-[10px] font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                {completedCount}/{checklist.length}
              </span>
            )}
          </div>

          {!hasPlanActivated ? (
            <div className="p-6 text-center space-y-3">
              <div className="w-10 h-10 mx-auto bg-secondary rounded-xl flex items-center justify-center">
                <ShieldAlert size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum plano de ação ativo</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ative um plano de ação para carregar o checklist de resposta desta ocorrência.</p>
              </div>
              {canAct && terminalActivePlans.length > 0 && (
                <button onClick={() => setShowPlanModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg cursor-pointer hover:opacity-90 transition-opacity">
                  <ShieldAlert size={14} /> Ativar Plano
                </button>
              )}
              {canAct && terminalActivePlans.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">Nenhum plano ativo cadastrado para este terminal.</p>
              )}
            </div>
          ) : (
            <>
              <div className="p-3 space-y-1.5 max-h-[350px] overflow-y-auto">
                {checklist.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    disabled={!canAct}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-left transition-colors ${
                      item.done
                        ? 'bg-success/10 text-success'
                        : canAct
                          ? 'bg-background border border-border text-foreground hover:bg-secondary/50 cursor-pointer'
                          : 'bg-background border border-border text-muted-foreground'
                    }`}
                  >
                    {item.done
                      ? <CheckCircle size={14} className="shrink-0" />
                      : <Circle size={14} className="shrink-0 text-muted-foreground" />
                    }
                    <span className={item.done ? 'line-through' : ''}>{item.text}</span>
                  </button>
                ))}
              </div>
              {/* Progress bar */}
              <div className="px-4 py-2 border-t border-border">
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all duration-300"
                    style={{ width: `${checklist.length ? (completedCount / checklist.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Emergency Route Section */}
      {terminal && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Navigation size={14} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Rota de Atendimento</h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Location info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-background border border-border rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin size={11} className="text-primary" /> Localização da Ocorrência
                </p>
                <p className="text-sm font-bold text-foreground">{terminal.name}</p>
                <p className="text-xs text-muted-foreground">{terminal.location}</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {terminal.lat.toFixed(5)}, {terminal.lng.toFixed(5)}
                </p>
              </div>

              {(() => {
                const meetingPoints = mapElements.filter(
                  el => el.terminalId === terminal.id && el.layerType === 'meeting_point'
                );
                return (
                  <div className="bg-background border border-border rounded-lg p-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Flag size={11} className="text-accent" /> Ponto de Encontro
                    </p>
                    {meetingPoints.length > 0 ? (
                      meetingPoints.map(mp => (
                        <div key={mp.id} className="space-y-0.5">
                          <p className="text-sm font-bold text-foreground">{mp.name}</p>
                          <p className="text-xs text-muted-foreground">{mp.description}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {mp.lat.toFixed(5)}, {mp.lng.toFixed(5)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhum ponto de encontro cadastrado para este terminal.</p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Route buttons */}
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${terminal.lat},${terminal.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                <ExternalLink size={14} />
                Abrir no Google Maps
              </a>
              <a
                href={`https://waze.com/ul?ll=${terminal.lat},${terminal.lng}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                <ExternalLink size={14} />
                Abrir no Waze
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${terminal.lat}, ${terminal.lng}`);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 transition-colors"
              >
                <MapPin size={14} />
                Copiar Coordenadas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Timeline */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Linha do Tempo</h3>
            <span className="text-[10px] font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{timeline.length}</span>
          </div>
          {canAct && !showTimelineForm && (
            <button onClick={() => setShowTimelineForm(true)} className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
              <Plus size={13} /> Novo evento
            </button>
          )}
        </div>

        {/* Add event form */}
        {showTimelineForm && (
          <div className="p-4 border-b border-border bg-background/50 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={timelineForm.type} onChange={e => setTimelineForm(f => ({ ...f, type: e.target.value as TimelineEventType }))} className="px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground">
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Anexo (opcional)" value={timelineForm.attachment} onChange={e => setTimelineForm(f => ({ ...f, attachment: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground" />
            </div>
            <textarea placeholder="Descrição do evento..." value={timelineForm.description} onChange={e => setTimelineForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground min-h-[50px]" />
            <div className="flex gap-2">
              <button onClick={addTimelineEvent} className="px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90">Adicionar</button>
              <button onClick={() => setShowTimelineForm(false)} className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg">Cancelar</button>
            </div>
          </div>
        )}

        <div className="p-4 pl-6 max-h-[400px] overflow-y-auto">
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-4">
              {timeline.map(ev => (
                <div key={ev.id} className="relative flex gap-3">
                  <div className={`relative z-10 w-4 h-4 rounded-full ${eventDotColor(ev.type)} flex items-center justify-center shrink-0 mt-0.5 ring-2 ring-card`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-card" />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground">{formatTime(ev.dateTime)}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">{eventIcon(ev.type)} {ev.type}</span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5">{ev.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User size={10} /> {ev.userName}</span>
                      {ev.attachment && <span className="text-[10px] text-primary flex items-center gap-1"><Paperclip size={10} /> {ev.attachment}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom grid: Entities + Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 6. Entities */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Building2 size={14} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Entidades Envolvidas</h3>
            <span className="text-[10px] font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{involvedEntities.length}</span>
          </div>
          <div className="divide-y divide-border">
            {involvedEntities.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground italic">Nenhuma entidade vinculada.</p>
            )}
            {involvedEntities.map(ent => (
              <div key={ent.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">{ent.name}</p>
                  <p className="text-[10px] text-muted-foreground">{ent.type} · {ent.contact}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ent.status === 'Ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {ent.status === 'Ativo' ? 'Acompanhando' : 'Inativo'}
                </span>
              </div>
            ))}
            {terminal && (
              <div className="px-4 py-3 flex items-center justify-between bg-secondary/30">
                <div>
                  <p className="text-xs font-bold text-foreground">Equipe do Terminal</p>
                  <p className="text-[10px] text-muted-foreground">{terminal.name} · {terminal.responsible}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Responsável</span>
              </div>
            )}
          </div>
        </div>

        {/* 7. Documents */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <FileText size={14} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Documentos da Ocorrência</h3>
            <span className="text-[10px] font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{terminalDocs.length}</span>
          </div>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
            {terminalDocs.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground italic">Nenhum documento vinculado.</p>
            )}
            {terminalDocs.map(doc => (
              <div key={doc.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{doc.title}</p>
                  <p className="text-[10px] text-muted-foreground">{doc.docType} · {doc.fileName}</p>
                </div>
                {doc.fileUrl ? (
                  <a href={fileUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors shrink-0 flex items-center gap-1">
                    <FileText size={12} /> Abrir
                  </a>
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground/40 shrink-0 flex items-center gap-1" title="Sem arquivo (documento legado)">
                    <FileText size={12} /> Abrir
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8. Internal Chat */}
      <OccurrenceChat occurrenceId={occurrenceId} />

      {/* Modal de escolha do Plano de Ação (Fase 10) */}
      <PlanActivationModal
        open={showPlanModal}
        onOpenChange={setShowPlanModal}
        plans={terminalActivePlans}
        onConfirm={handleActivatePlan}
        isPending={activatePlan.isPending}
      />
    </div>
  );
}
