import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Occurrence, TimelineEvent, TimelineEventType, OccurrenceStatus } from '@/lib/types';
import { generateIncidentPDF } from './generateIncidentPDF';
import { OccurrenceChat } from './OccurrenceChat';
import {
  ShieldAlert, Clock, AlertTriangle, User, CheckCircle, Circle,
  Play, RefreshCw, Bell, Paperclip, FileText, MapPin, Siren,
  ArrowLeft, Timer, Plus, ChevronDown, ChevronUp, Building2,
  Radio, X, Flame, Droplets, Route, Triangle, Users as UsersIcon, Download,
  Navigation, ExternalLink, Flag
} from 'lucide-react';
import L from 'leaflet';

const EVENT_TYPES: TimelineEventType[] = [
  'ocorrência registrada', 'equipe acionada', 'plano de emergência ativado',
  'entidade notificada', 'ação executada', 'atualização de status', 'ocorrência resolvida',
];

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

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

const DEFAULT_CHECKLIST: Omit<ChecklistItem, 'id'>[] = [
  { text: 'Ocorrência validada', done: false },
  { text: 'Equipe acionada', done: false },
  { text: 'Plano de emergência ativado', done: false },
  { text: 'Autoridade notificada', done: false },
  { text: 'Evacuação iniciada', done: false },
  { text: 'Área isolada', done: false },
  { text: 'Comunicação registrada', done: false },
  { text: 'Ocorrência encerrada', done: false },
];

interface Props {
  occurrenceId: string;
  onBack: () => void;
}

export function SituationRoomView({ occurrenceId, onBack }: Props) {
  const { user, data, setData } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() =>
    DEFAULT_CHECKLIST.map((item, i) => ({ ...item, id: `cl-${i}` }))
  );
  const [showTimelineForm, setShowTimelineForm] = useState(false);
  const [timelineForm, setTimelineForm] = useState<{ type: TimelineEventType; description: string; attachment: string }>({
    type: 'ação executada', description: '', attachment: '',
  });

  const occurrence = data.occurrences.find(o => o.id === occurrenceId);
  const terminal = occurrence ? data.terminals.find(t => t.id === occurrence.terminalId) : undefined;
  const terminalPlans = occurrence ? data.plans.filter(p => p.terminalId === occurrence.terminalId) : [];
  const activePlan = terminalPlans.find(p => p.status === 'ativo');
  const hasPlanActivated = occurrence?.timeline.some(e => e.type === 'plano de emergência ativado') ?? false;
  const terminalRisks = occurrence ? data.risks.filter(r => r.terminalId === occurrence.terminalId) : [];
  const terminalDocs = occurrence ? data.documents.filter(d => d.terminalId === occurrence.terminalId) : [];
  const terminalElements = occurrence ? data.mapElements.filter(el => el.terminalId === occurrence.terminalId) : [];
  const timeline = occurrence ? [...(occurrence.timeline || [])].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()) : [];

  const involvedEntities = useMemo(() => {
    if (!occurrence) return [];
    const entityIds = data.permissions
      .filter(p => p.terminalIds.includes(occurrence.terminalId))
      .map(p => p.entityId);
    return data.entities.filter(e => entityIds.includes(e.id));
  }, [data.permissions, data.entities, occurrence?.terminalId]);

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
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [terminal, terminalElements, occurrence?.type]);

  if (!occurrence || !user) return null;

  const canAct = user.role === 'admin' || user.role === 'terminal';

  const formatDate = (dt: string) => {
    const d = new Date(dt);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };
  const formatTime = (dt: string) => new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Actions
  const activateEmergencyPlan = () => {
    if (!activePlan) return;
    const now = new Date().toISOString();
    const newEvent: TimelineEvent = { id: `tl${Date.now()}`, dateTime: now, type: 'plano de emergência ativado', description: `${activePlan.name} ativado — resposta de emergência iniciada`, userName: user.name };
    setData(d => ({
      ...d,
      occurrences: d.occurrences.map(o => o.id === occurrenceId ? { ...o, status: 'emergência ativa' as OccurrenceStatus, timeline: [...(o.timeline || []), newEvent] } : o),
    }));
  };

  const resolveOccurrence = () => {
    const now = new Date().toISOString();
    const newEvent: TimelineEvent = { id: `tl${Date.now()}`, dateTime: now, type: 'ocorrência resolvida', description: 'Ocorrência encerrada pela Sala de Situação', userName: user.name };
    setData(d => ({
      ...d,
      occurrences: d.occurrences.map(o => o.id === occurrenceId ? { ...o, status: 'resolvido' as OccurrenceStatus, timeline: [...(o.timeline || []), newEvent] } : o),
    }));
  };

  const addTimelineEvent = () => {
    if (!timelineForm.description) return;
    const newEvent: TimelineEvent = { id: `tl${Date.now()}`, dateTime: new Date().toISOString(), type: timelineForm.type, description: timelineForm.description, userName: user.name, attachment: timelineForm.attachment || undefined };
    setData(d => ({ ...d, occurrences: d.occurrences.map(o => o.id === occurrenceId ? { ...o, timeline: [...(o.timeline || []), newEvent] } : o) }));
    setTimelineForm({ type: 'ação executada', description: '', attachment: '' });
    setShowTimelineForm(false);
  };

  const toggleChecklist = (id: string) => {
    if (!canAct) return;
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c));
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
              {!hasPlanActivated && activePlan && (
                <button onClick={activateEmergencyPlan} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                  <ShieldAlert size={14} /> Ativar Plano
                </button>
              )}
              <button onClick={() => setShowTimelineForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 transition-colors">
                <Plus size={14} /> Evento
              </button>
              <button onClick={() => generateIncidentPDF(occurrence, data)} className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 transition-colors">
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
          <p className="text-sm font-bold text-foreground">{completedCount}/{checklist.length}</p>
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

        {/* 5. Checklist */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Checklist de Resposta</h3>
            </div>
            <span className="text-[10px] font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {completedCount}/{checklist.length}
            </span>
          </div>
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
                style={{ width: `${(completedCount / checklist.length) * 100}%` }}
              />
            </div>
          </div>
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
                const meetingPoints = (data.mapElements || []).filter(
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
                <button className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors shrink-0 flex items-center gap-1">
                  <FileText size={12} /> Abrir
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8. Internal Chat */}
      <OccurrenceChat occurrenceId={occurrenceId} />
    </div>
  );
}
