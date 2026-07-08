import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { situationRoomPath } from '@/lib/nav-config';
import { Occurrence, OccurrenceStatus, OccurrenceCriticality, TimelineEventType } from '@/lib/types';
import { Plus, Siren, Trash2, Clock, ChevronDown, ChevronUp, Paperclip, User, AlertTriangle, Bell, CheckCircle, Play, RefreshCw, Filter, Timer, Radio, Download, Loader2 } from 'lucide-react';
import { EmergencyResponseSection } from '../components/EmergencyResponseSection';
import { generateIncidentPDF } from '../components/generateIncidentPDF';
import { useOccurrences, useOccurrenceMutations, useTerminals, useEntities, usePermissions, useRisks, usePlans, useDocuments, useUsers } from '@/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const EVENT_TYPES: TimelineEventType[] = [
  'ocorrência registrada', 'equipe acionada', 'plano de emergência ativado',
  'entidade notificada', 'ação executada', 'atualização de status', 'ocorrência resolvida',
];

// 8 tipos oficiais (Funcional §3.4 / espelha Níveis de Acesso).
const OCCURRENCE_TYPES = [
  'Princípio de incêndio', 'Vazamento', 'Emergência', 'Explosão',
  'Queda de carga', 'Acidente de trabalho', 'Contaminação ambiental', 'Outros',
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

export function OccurrencesPage() {
  const navigate = useNavigate();
  const openSituationRoom = (id: string) => navigate(situationRoomPath(id));
  // `data` permanece só para o shape do AppData exigido pelo gerador de PDF
  const { user, data } = useAuth();
  const { data: occurrencesRaw = [], isLoading, isError } = useOccurrences();
  const { data: terminals = [] } = useTerminals();
  const { data: entities = [] } = useEntities();
  const { data: permissions = [] } = usePermissions();
  const { data: risks = [] } = useRisks();
  const { data: plans = [] } = usePlans();
  const { data: documents = [] } = useDocuments();
  const { data: users = [] } = useUsers(user?.role !== 'entity'); // Responsável (entity não cria ocorrência)
  const { create, setStatus, addTimeline, remove } = useOccurrenceMutations();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Occurrence | null>(null);
  const [form, setForm] = useState({ type: '', description: '', criticality: 'média' as OccurrenceCriticality, responsible: '', terminalId: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timelineForm, setTimelineForm] = useState<{ type: TimelineEventType; description: string; attachment: string }>({ type: 'ação executada', description: '', attachment: '' });
  const [showTimelineForm, setShowTimelineForm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ terminalId: '', status: '' as OccurrenceStatus | '', criticality: '' as OccurrenceCriticality | '', dateFrom: '' });

  const occurrences = useMemo(() => {
    // O escopo por papel/terminal é do back; aqui só os filtros de tela.
    let filtered = occurrencesRaw;
    if (filters.terminalId) filtered = filtered.filter(o => o.terminalId === filters.terminalId);
    if (filters.status) filtered = filtered.filter(o => o.status === filters.status);
    if (filters.criticality) filtered = filtered.filter(o => o.criticality === filters.criticality);
    if (filters.dateFrom) filtered = filtered.filter(o => o.dateTime >= filters.dateFrom);
    return filtered;
  }, [occurrencesRaw, filters]);

  if (!user) return null;

  const canCreate = user.role === 'admin' || user.role === 'terminal';
  const canAddTimeline = canCreate;
  const activeFilterCount = [filters.terminalId, filters.status, filters.criticality, filters.dateFrom].filter(Boolean).length;
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');

  // Dados reais para o PDF (Fase 5a completa: riscos/planos/docs também da API)
  const pdfData = { ...data, terminals, entities, permissions, risks, plans, documents };

  // Tipos que o usuário pode abrir (Níveis de Acesso); vazio = todos os 8.
  const availableTypes = useMemo(() => {
    const allowed = user?.allowedOccurrenceTypes ?? [];
    return allowed.length ? OCCURRENCE_TYPES.filter(t => allowed.includes(t)) : OCCURRENCE_TYPES;
  }, [user?.allowedOccurrenceTypes]);

  // Responsável: usuários do terminal onde a ocorrência será criada.
  const responsibleTerminalId = user?.role === 'admin' ? form.terminalId : (user?.linkId ?? '');
  const responsibleOptions = useMemo(
    () => users.filter(u => u.role === 'terminal' && (!responsibleTerminalId || u.linkId === responsibleTerminalId)),
    [users, responsibleTerminalId],
  );

  const handleAdd = () => {
    if (!form.type) { toast.error('Selecione o tipo de ocorrência'); return; }
    if (!form.description.trim()) { toast.error('Informe a descrição da ocorrência'); return; }
    if (user.role === 'admin' && !form.terminalId) { toast.error('Selecione o terminal'); return; }
    create.mutate(
      {
        type: form.type,
        description: form.description,
        criticality: form.criticality,
        responsible: form.responsible || undefined,
        terminalId: user.role === 'admin' ? form.terminalId : undefined,
      },
      {
        onSuccess: (occ) => {
          setForm({ type: '', description: '', criticality: 'média', responsible: '', terminalId: '' });
          setShowForm(false);
          toast.success(`Ocorrência ${occ.incNumber} registrada`);
        },
        onError,
      },
    );
  };

  const changeStatus = (id: string, status: OccurrenceStatus) => {
    setStatus.mutate({ id, status }, { onError });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const inc = deleteTarget.incNumber;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => toast.success(`Ocorrência ${inc} removida`),
      onError,
    });
    setDeleteTarget(null);
  };

  const addTimelineEvent = (occId: string) => {
    if (!timelineForm.description) return;
    addTimeline.mutate(
      { id: occId, input: { type: timelineForm.type, description: timelineForm.description, attachment: timelineForm.attachment || undefined } },
      {
        onSuccess: () => { setTimelineForm({ type: 'ação executada', description: '', attachment: '' }); setShowTimelineForm(null); },
        onError,
      },
    );
  };

  const activateEmergencyPlan = (occId: string, planName: string) => {
    // Evento de plano + mudança de status — dois registros reais na timeline imutável
    addTimeline.mutate(
      { id: occId, input: { type: 'plano de emergência ativado', description: `${planName} ativado — resposta de emergência iniciada` } },
      { onSuccess: () => setStatus.mutate({ id: occId, status: 'emergência ativa' }, { onError }), onError },
    );
  };

  const handleEmergencyAction = (occId: string, actionText: string) => {
    addTimeline.mutate({ id: occId, input: { type: 'ação executada', description: actionText } }, { onError });
  };

  const getTerminalName = (o: { terminalId: string; terminalName?: string }) =>
    o.terminalName || terminals.find(t => t.id === o.terminalId)?.name || o.terminalId;
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
              <Select value={filters.terminalId || 'all'} onValueChange={v => setFilters(f => ({ ...f, terminalId: v === 'all' ? '' : v }))}>
                <SelectTrigger className="cursor-pointer text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">Todos</SelectItem>
                  {terminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Status</label>
              <Select value={filters.status || 'all'} onValueChange={v => setFilters(f => ({ ...f, status: (v === 'all' ? '' : v) as OccurrenceStatus | '' }))}>
                <SelectTrigger className="cursor-pointer text-xs h-9 capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">Todos</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="cursor-pointer capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Criticidade</label>
              <Select value={filters.criticality || 'all'} onValueChange={v => setFilters(f => ({ ...f, criticality: (v === 'all' ? '' : v) as OccurrenceCriticality | '' }))}>
                <SelectTrigger className="cursor-pointer text-xs h-9 capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">Todas</SelectItem>
                  {CRITICALITY_OPTIONS.map(c => <SelectItem key={c} value={c} className="cursor-pointer capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">A partir de</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-md text-xs text-foreground h-9 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background" />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => setFilters({ terminalId: '', status: '', criticality: '', dateFrom: '' })} className="mt-3 text-xs font-bold text-primary hover:text-primary/80 transition-colors">Limpar filtros</button>
          )}
        </div>
      )}

      {/* New occurrence form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tipo de Ocorrência *</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                <SelectContent>
                  {availableTypes.map(t => <SelectItem key={t} value={t} className="cursor-pointer">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Grau de Criticidade</label>
              <Select value={form.criticality} onValueChange={v => setForm(f => ({ ...f, criticality: v as OccurrenceCriticality }))}>
                <SelectTrigger className="cursor-pointer capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRITICALITY_OPTIONS.map(c => <SelectItem key={c} value={c} className="cursor-pointer capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {user.role === 'admin' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Terminal</label>
              <Select value={form.terminalId} onValueChange={v => setForm(f => ({ ...f, terminalId: v, responsible: '' }))}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione o terminal..." /></SelectTrigger>
                <SelectContent>
                  {terminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Descrição *</label>
            <textarea placeholder="Descreva a ocorrência..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground min-h-[70px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Responsável <span className="text-muted-foreground/60 normal-case font-normal">(opcional — padrão: você)</span></label>
            <Select
              value={form.responsible}
              onValueChange={v => setForm(f => ({ ...f, responsible: v }))}
              disabled={user.role === 'admin' && !form.terminalId}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder={user.role === 'admin' && !form.terminalId ? 'Selecione o terminal primeiro' : 'Selecione o responsável...'} />
              </SelectTrigger>
              <SelectContent>
                {responsibleOptions.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum usuário no terminal</div>}
                {responsibleOptions.map(u => <SelectItem key={u.id} value={u.name} className="cursor-pointer">{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={create.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-60 flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity">
              {create.isPending && <Loader2 size={12} className="animate-spin" />} Registrar
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Quick filter chips — horizontal scroll on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap shrink-0">Filtro:</span>
        {CRITICALITY_OPTIONS.map(c => {
          const count = occurrencesRaw.filter(o => o.criticality === c).length;
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
          const count = occurrencesRaw.filter(o => o.status === s).length;
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
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground bg-card border border-border rounded-xl flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Carregando ocorrências...
          </p>
        )}
        {isError && !isLoading && (
          <p className="p-4 text-sm text-primary bg-card border border-border rounded-xl">Falha ao carregar ocorrências da API.</p>
        )}
        {!isLoading && !isError && occurrences.length === 0 && <p className="p-4 text-sm text-muted-foreground italic bg-card border border-border rounded-xl">Nenhuma ocorrência encontrada.</p>}
        {occurrences.map(o => {
          const isExpanded = expandedId === o.id;
          const timeline = [...(o.timeline || [])].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
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
                  <span className="font-medium">{getTerminalName(o)}</span>
                  <span className="hidden sm:inline">·</span>
                  <span>{formatDate(o.dateTime)}</span>
                  {o.responsible && <span className="flex items-center gap-1"><User size={10} /> {o.responsible}</span>}
                  {o.team && <span>Equipe: {o.team}</span>}
                </div>

                {/* Row 6: Action buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  <button onClick={() => generateIncidentPDF(o, pdfData)} className="px-3 py-1.5 text-[10px] font-bold rounded-lg flex items-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                    <Download size={12} /> Relatório
                  </button>
                  {canCreate && o.status !== 'em atendimento' && o.status !== 'resolvido' && (
                    <button onClick={() => changeStatus(o.id, 'em atendimento')} className="px-3 py-1.5 text-[10px] font-bold bg-warning/10 text-warning rounded-lg hover:bg-warning/20 transition-colors">Atender</button>
                  )}
                  {canCreate && o.status !== 'resolvido' && (
                    <button onClick={() => changeStatus(o.id, 'resolvido')} className="px-3 py-1.5 text-[10px] font-bold bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors">Resolver</button>
                  )}
                  {canCreate && (
                    <button onClick={() => setDeleteTarget(o)} className="text-muted-foreground hover:text-primary transition-colors p-1.5 ml-auto cursor-pointer"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>

              {/* Emergency Response — planos reais da API (Fase 5a) */}
              <EmergencyResponseSection occurrence={o} plans={plans} onActivate={activateEmergencyPlan} onActionComplete={handleEmergencyAction} />

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
                              <button onClick={() => addTimelineEvent(o.id)} disabled={addTimeline.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg disabled:opacity-60">Adicionar Evento</button>
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

      {/* Confirmação de remoção (AlertDialog — substitui o confirm() nativo) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="p-1.5 bg-primary/10 rounded-lg"><Trash2 size={16} className="text-primary" /></span>
              Remover ocorrência?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A ocorrência <strong className="text-foreground font-semibold">{deleteTarget?.incNumber}</strong>
              {deleteTarget?.type ? <> — {deleteTarget.type}</> : null} será removida da listagem.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
