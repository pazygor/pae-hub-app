import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { situationRoomPath } from '@/lib/nav-config';
import { Occurrence, OccurrenceStatus, OccurrenceCriticality, TimelineEvent, TimelineEventType } from '@/lib/types';
import { Plus, Siren, Trash2, Clock, ChevronDown, ChevronUp, Paperclip, User, AlertTriangle, Bell, CheckCircle, Play, RefreshCw, FileText, ShieldAlert, Filter, Timer, Radio, Download } from 'lucide-react';
import { EmergencyResponseSection } from '../components/EmergencyResponseSection';
import { generateIncidentPDF } from '../components/generateIncidentPDF';

const EVENT_TYPES: TimelineEventType[] = [
  'ocorrência registrada', 'equipe acionada', 'plano de emergência ativado',
  'entidade notificada', 'ação executada', 'atualização de status', 'ocorrência resolvida',
];

const CRITICALITY_OPTIONS: OccurrenceCriticality[] = ['baixa', 'média', 'alta', 'crítica'];
const STATUS_OPTIONS: OccurrenceStatus[] = ['aberto', 'em atendimento', 'emergência ativa', 'resolvido'];

const eventIcon = (type: TimelineEventType) => {
  switch (type) {
    case 'ocorrência registrada': return <AlertTriangle size={14} />;
    case 'equipe acionada': return <User size={14} />;
    case 'plano de emergência ativado': return <Play size={14} />;
    case 'entidade notificada': return <Bell size={14} />;
    case 'ação executada': return <CheckCircle size={14} />;
    case 'atualização de status': return <RefreshCw size={14} />;
    case 'ocorrência resolvida': return <CheckCircle size={14} />;
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

const criticalityColor = (c: OccurrenceCriticality) => {
  switch (c) {
    case 'baixa': return 'bg-success/10 text-success';
    case 'média': return 'bg-warning/10 text-warning';
    case 'alta': return 'bg-primary/10 text-primary';
    case 'crítica': return 'bg-primary/20 text-primary font-black';
  }
};

const statusColor = (s: OccurrenceStatus) =>
  s === 'aberto' ? 'bg-primary/10 text-primary'
  : s === 'em atendimento' ? 'bg-warning/10 text-warning'
  : s === 'emergência ativa' ? 'bg-primary/10 text-primary font-black'
  : 'bg-success/10 text-success';

function getResponseTime(o: Occurrence): string | null {
  const registered = o.timeline.find(e => e.type === 'ocorrência registrada');
  const planActivated = o.timeline.find(e => e.type === 'plano de emergência ativado');
  if (!registered || !planActivated) return null;
  const diffMs = new Date(planActivated.dateTime).getTime() - new Date(registered.dateTime).getTime();
  if (diffMs < 0) return null;
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remainMins}min` : `${mins}min`;
}

function generateIncNumber(existingOccurrences: Occurrence[]): string {
  const existing = existingOccurrences
    .map(o => o.incNumber)
    .filter(n => n && n.startsWith('INC-'))
    .map(n => parseInt(n.replace('INC-', ''), 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `INC-${next.toString().padStart(4, '0')}`;
}

export function OccurrencesPage() {
  const navigate = useNavigate();
  const openSituationRoom = (id: string) => navigate(situationRoomPath(id));
  const { user, data, setData } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '', description: '', criticality: 'média' as OccurrenceCriticality, responsible: '', team: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timelineForm, setTimelineForm] = useState<{ type: TimelineEventType; description: string; attachment: string }>({ type: 'ação executada', description: '', attachment: '' });
  const [showTimelineForm, setShowTimelineForm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ terminalId: '', status: '' as OccurrenceStatus | '', criticality: '' as OccurrenceCriticality | '', dateFrom: '' });

  const visibleTerminalIds = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return data.terminals.map(t => t.id);
    if (user.role === 'terminal') return user.linkId ? [user.linkId] : [];
    if (user.role === 'entity') return data.permissions.find(p => p.entityId === user.linkId)?.terminalIds || [];
    return [];
  }, [user, data]);

  const occurrences = useMemo(() => {
    const allOcc = data.occurrences.filter(o => visibleTerminalIds.includes(o.terminalId));
    let filtered = allOcc;
    if (filters.terminalId) filtered = filtered.filter(o => o.terminalId === filters.terminalId);
    if (filters.status) filtered = filtered.filter(o => o.status === filters.status);
    if (filters.criticality) filtered = filtered.filter(o => o.criticality === filters.criticality);
    if (filters.dateFrom) filtered = filtered.filter(o => o.dateTime >= filters.dateFrom);
    return filtered;
  }, [data.occurrences, visibleTerminalIds, filters]);

  if (!user) return null;


  const canCreate = user.role === 'admin' || user.role === 'terminal';
  const canAddTimeline = true;
  const activeFilterCount = [filters.terminalId, filters.status, filters.criticality, filters.dateFrom].filter(Boolean).length;

  const handleAdd = () => {
    if (!form.type || !form.description) return;
    const terminalId = user.role === 'terminal' ? user.linkId! : visibleTerminalIds[0];
    const now = new Date().toISOString();
    const incNumber = generateIncNumber(data.occurrences);
    const newOcc: Occurrence = {
      id: `o${Date.now()}`,
      incNumber,
      terminalId,
      dateTime: now,
      type: form.type,
      description: form.description,
      status: 'aberto',
      criticality: form.criticality,
      responsible: form.responsible || user.name,
      team: form.team,
      timeline: [
        { id: `tl${Date.now()}`, dateTime: now, type: 'ocorrência registrada', description: form.description, userName: user.name },
      ],
    };
    setData(d => ({ ...d, occurrences: [...d.occurrences, newOcc] }));
    setForm({ type: '', description: '', criticality: 'média', responsible: '', team: '' });
    setShowForm(false);
  };

  const changeStatus = (id: string, status: OccurrenceStatus) => {
    const eventType: TimelineEventType = status === 'resolvido' ? 'ocorrência resolvida' : 'atualização de status';
    const desc = status === 'resolvido' ? 'Ocorrência marcada como resolvida' : `Status alterado para "${status}"`;
    setData(d => ({
      ...d,
      occurrences: d.occurrences.map(o => o.id === id ? {
        ...o, status,
        timeline: [...(o.timeline || []), { id: `tl${Date.now()}`, dateTime: new Date().toISOString(), type: eventType, description: desc, userName: user.name }],
      } : o),
    }));
  };

  const handleDelete = (id: string) => setData(d => ({ ...d, occurrences: d.occurrences.filter(o => o.id !== id) }));

  const addTimelineEvent = (occId: string) => {
    if (!timelineForm.description) return;
    const newEvent: TimelineEvent = { id: `tl${Date.now()}`, dateTime: new Date().toISOString(), type: timelineForm.type, description: timelineForm.description, userName: user.name, attachment: timelineForm.attachment || undefined };
    setData(d => ({ ...d, occurrences: d.occurrences.map(o => o.id === occId ? { ...o, timeline: [...(o.timeline || []), newEvent] } : o) }));
    setTimelineForm({ type: 'ação executada', description: '', attachment: '' });
    setShowTimelineForm(null);
  };

  const activateEmergencyPlan = (occId: string, planName: string) => {
    const now = new Date().toISOString();
    const newEvent: TimelineEvent = { id: `tl${Date.now()}`, dateTime: now, type: 'plano de emergência ativado', description: `${planName} ativado — resposta de emergência iniciada`, userName: user.name };
    setData(d => ({
      ...d,
      occurrences: d.occurrences.map(o => o.id === occId ? { ...o, status: 'emergência ativa' as OccurrenceStatus, timeline: [...(o.timeline || []), newEvent] } : o),
    }));
  };

  const handleEmergencyAction = (occId: string, actionText: string) => {
    const newEvent: TimelineEvent = { id: `tl${Date.now()}`, dateTime: new Date().toISOString(), type: 'ação executada', description: actionText, userName: user.name };
    setData(d => ({ ...d, occurrences: d.occurrences.map(o => o.id === occId ? { ...o, timeline: [...(o.timeline || []), newEvent] } : o) }));
  };

  const getTerminalName = (id: string) => data.terminals.find(t => t.id === id)?.name || id;
  const formatDate = (dt: string) => { const d = new Date(dt); return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };
  const formatTime = (dt: string) => new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Siren size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-foreground">Registro de Ocorrências</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
            <Filter size={14} /> Filtros {activeFilterCount > 0 && <span className="bg-primary-foreground text-primary px-1.5 py-0.5 rounded-full text-[10px] font-mono">{activeFilterCount}</span>}
          </button>
          {canCreate && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md hover:opacity-90 transition-opacity">
              <Plus size={14} /> Nova Ocorrência
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Terminal</label>
              <select value={filters.terminalId} onChange={e => setFilters(f => ({ ...f, terminalId: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground">
                <option value="">Todos</option>
                {data.terminals.filter(t => visibleTerminalIds.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Status</label>
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as OccurrenceStatus | '' }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground">
                <option value="">Todos</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Criticidade</label>
              <select value={filters.criticality} onChange={e => setFilters(f => ({ ...f, criticality: e.target.value as OccurrenceCriticality | '' }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground">
                <option value="">Todas</option>
                {CRITICALITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">A partir de</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground" />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => setFilters({ terminalId: '', status: '', criticality: '', dateFrom: '' })} className="mt-3 text-xs font-bold text-primary hover:text-primary/80 transition-colors">Limpar filtros</button>
          )}
        </div>
      )}

      {/* New occurrence form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Tipo de ocorrência" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground" />
            <select value={form.criticality} onChange={e => setForm(f => ({ ...f, criticality: e.target.value as OccurrenceCriticality }))} className="px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground">
              {CRITICALITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground min-h-[60px]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Responsável" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground" />
            <input placeholder="Equipe responsável" value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg">Registrar</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {/* Quick filter chips — horizontal scroll on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap shrink-0">Filtro:</span>
        {CRITICALITY_OPTIONS.map(c => {
          const count = data.occurrences.filter(o => visibleTerminalIds.includes(o.terminalId) && o.criticality === c).length;
          const isActive = filters.criticality === c;
          return (
            <button
              key={`crit-${c}`}
              onClick={() => setFilters(f => ({ ...f, criticality: isActive ? '' : c }))}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap shrink-0 ${
                isActive ? criticalityColor(c) + ' ring-2 ring-offset-1 ring-current' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {c} ({count})
            </button>
          );
        })}
        <span className="w-px h-5 bg-border shrink-0" />
        {STATUS_OPTIONS.map(s => {
          const count = data.occurrences.filter(o => visibleTerminalIds.includes(o.terminalId) && o.status === s).length;
          const isActive = filters.status === s;
          return (
            <button
              key={`stat-${s}`}
              onClick={() => setFilters(f => ({ ...f, status: isActive ? '' : s }))}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap shrink-0 ${
                isActive ? statusColor(s) + ' ring-2 ring-offset-1 ring-current' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
        {(filters.criticality || filters.status || filters.terminalId) && (
          <button
            onClick={() => setFilters({ terminalId: '', status: '', criticality: '', dateFrom: '' })}
            className="px-3 py-1.5 rounded-full text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
          >
            ✕ Limpar
          </button>
        )}
      </div>

      {/* Occurrences list */}
      <div className="space-y-3">
        {occurrences.length === 0 && <p className="p-4 text-sm text-muted-foreground italic bg-card border border-border rounded-xl">Nenhuma ocorrência encontrada.</p>}
        {occurrences.map(o => {
          const isExpanded = expandedId === o.id;
          const timeline = (o.timeline || []).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
          const responseTime = getResponseTime(o);
          return (
            <div key={o.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Card content — mobile-first structured layout */}
              <div className="p-4 sm:p-5 space-y-3">
                {/* Row 1: ID + Situation Room */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono bg-secondary text-secondary-foreground px-2.5 py-1 rounded font-bold">{o.incNumber}</span>
                  {o.status !== 'resolvido' && (
                    (() => {
                      const isCritical = o.criticality === 'crítica' || o.status === 'emergência ativa';
                      return (
                        <button onClick={() => openSituationRoom(o.id)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-all shrink-0 ${
                          isCritical
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                            : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
                        }`}>
                          <Radio size={12} />
                          <span className="hidden sm:inline">{isCritical ? '⚠ Abrir Sala de Situação' : 'Sala de Situação'}</span>
                          <span className="sm:hidden">{isCritical ? '⚠ Sala' : 'Sala'}</span>
                        </button>
                      );
                    })()
                  )}
                </div>

                {/* Row 2: Title */}
                <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug line-clamp-2">{o.type}</h3>

                {/* Row 3: Status + Severity badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor(o.status)}`}>{o.status}</span>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${criticalityColor(o.criticality)}`}>{o.criticality}</span>
                  {responseTime && (
                    <span className="text-[10px] font-bold text-foreground flex items-center gap-1 bg-secondary px-2.5 py-1 rounded-full">
                      <Timer size={10} /> {responseTime}
                    </span>
                  )}
                </div>

                {/* Row 4: Description */}
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">{o.description}</p>

                {/* Row 5: Meta info */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] text-muted-foreground">
                  <span className="font-medium">{getTerminalName(o.terminalId)}</span>
                  <span className="hidden sm:inline">·</span>
                  <span>{formatDate(o.dateTime)}</span>
                  {o.responsible && <span className="flex items-center gap-1"><User size={10} /> {o.responsible}</span>}
                  {o.team && <span>Equipe: {o.team}</span>}
                </div>

                {/* Row 6: Action buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  <button onClick={() => generateIncidentPDF(o, data)} className="px-3 py-1.5 text-[10px] font-bold rounded-lg flex items-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    <Download size={12} /> Relatório
                  </button>
                  {canCreate && o.status !== 'em atendimento' && o.status !== 'resolvido' && (
                    <button onClick={() => changeStatus(o.id, 'em atendimento')} className="px-3 py-1.5 text-[10px] font-bold bg-warning/10 text-warning rounded-lg hover:bg-warning/20 transition-colors">Atender</button>
                  )}
                  {canCreate && o.status !== 'resolvido' && (
                    <button onClick={() => changeStatus(o.id, 'resolvido')} className="px-3 py-1.5 text-[10px] font-bold bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors">Resolver</button>
                  )}
                  {canCreate && (
                    <button onClick={() => handleDelete(o.id)} className="text-muted-foreground hover:text-primary transition-colors p-1.5 ml-auto"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>

              {/* Emergency Response */}
              <EmergencyResponseSection occurrence={o} plans={data.plans} onActivate={activateEmergencyPlan} onActionComplete={handleEmergencyAction} />

              {/* Timeline toggle */}
              <button onClick={() => setExpandedId(isExpanded ? null : o.id)} className="w-full px-4 py-2.5 border-t border-border flex items-center justify-between text-xs font-bold text-muted-foreground hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} />
                  <span>Linha do Tempo</span>
                  <span className="text-[10px] font-mono-data bg-secondary px-1.5 py-0.5 rounded-full">{timeline.length}</span>
                </div>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {/* Timeline content */}
              {isExpanded && (
                <div className="border-t border-border bg-background/50">
                  <div className="p-4 pl-6">
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
                                <span className="text-[10px] font-mono-data text-muted-foreground">{formatTime(ev.dateTime)}</span>
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

                    {canAddTimeline && (
                      <div className="mt-4 pt-4 border-t border-border">
                        {showTimelineForm === o.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <select value={timelineForm.type} onChange={e => setTimelineForm(f => ({ ...f, type: e.target.value as TimelineEventType }))} className="px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground">
                                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <input placeholder="Anexo (nome do arquivo)" value={timelineForm.attachment} onChange={e => setTimelineForm(f => ({ ...f, attachment: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground" />
                            </div>
                            <textarea placeholder="Descrição do evento..." value={timelineForm.description} onChange={e => setTimelineForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground min-h-[50px]" />
                            <div className="flex gap-2">
                              <button onClick={() => addTimelineEvent(o.id)} className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg">Adicionar Evento</button>
                              <button onClick={() => setShowTimelineForm(null)} className="px-3 py-1.5 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-lg">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setShowTimelineForm(o.id); setTimelineForm({ type: 'ação executada', description: '', attachment: '' }); }} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                            <Plus size={13} /> Registrar evento na linha do tempo
                          </button>
                        )}
                      </div>
                    )}
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
