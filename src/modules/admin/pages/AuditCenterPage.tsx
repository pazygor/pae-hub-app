import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useAccessSessions, useAccessStats, useActivity, useActivityStats } from '@/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  History, Activity as ActivityIcon, Search, Filter, LogIn, Monitor, ShieldCheck,
} from 'lucide-react';

const ACCESS_COLOR = 'hsl(217, 91%, 60%)';
const ACTIVITY_COLOR = 'hsl(262, 83%, 58%)';
const TOOLTIP_STYLE = { background: 'hsl(0,0%,10%)', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' };

const ACTION_LABELS: Record<string, string> = {
  create: 'Criou ocorrência',
  update: 'Editou ocorrência',
  status_change: 'Mudou status',
  delete: 'Excluiu ocorrência',
  timeline_add: 'Evento na timeline',
  dispatch: 'Acionou entidade',
  open_situation_room: 'Abriu Sala de Situação',
};
const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;

function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return `${Math.floor(ms / 1000)}s`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const shortDate = (d: string) => { const [, m, day] = d.split('-'); return `${day}/${m}`; };

function parseDevice(ua: string | null): string {
  if (!ua) return '—';
  const browser = /Edg/.test(ua) ? 'Edge'
    : /OPR|Opera/.test(ua) ? 'Opera'
    : /Chrome/.test(ua) ? 'Chrome'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari' : 'Navegador';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

function accessStatusBadge(status: string) {
  const cls: Record<string, string> = {
    ativa: 'bg-success/15 text-success border-success/30',
    encerrada: 'bg-secondary text-muted-foreground border-border',
    expirada: 'bg-warning/15 text-warning border-warning/30',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${cls[status] ?? ''}`}>{status.toUpperCase()}</span>;
}

function formatDetails(action: string, details: unknown): string {
  if (!details || typeof details !== 'object') return '—';
  const d = details as Record<string, any>;
  const inc = d.incNumber ? `${d.incNumber} · ` : '';
  switch (action) {
    case 'status_change': return `${inc}${d.de} → ${d.para}`;
    case 'create': return `${inc}${d.type ?? ''}${d.criticality ? ` (${d.criticality})` : ''}`.trim();
    case 'delete': return `${inc}${d.type ?? ''}`.trim();
    case 'timeline_add': return `${inc}${d.tipo ?? ''}`.trim();
    case 'update': return `${inc}${Array.isArray(d.campos) ? d.campos.join(', ') : ''}`.trim();
    case 'dispatch': return `${inc}${Array.isArray(d.entidades) ? d.entidades.join(', ') : (d.total ?? '')}`.trim();
    default: return inc || '—';
  }
}

const cardCls = 'bg-card border rounded-xl p-3 text-center';
const kpiLabel = 'text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5';

export function AuditCenterPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'access' | 'activity'>('access');
  const [days, setDays] = useState('30');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ativa' | 'encerrada' | 'expirada'>('');
  const [actionFilter, setActionFilter] = useState('');

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const { data: accessStats } = useAccessStats(range);
  const { data: accessRows = [], isLoading: loadingAccess } = useAccessSessions({ from: range.from, to: range.to, status: statusFilter || undefined });
  const { data: activityStats } = useActivityStats(range);
  const { data: activityRows = [], isLoading: loadingActivity } = useActivity({ from: range.from, to: range.to, action: actionFilter || undefined });

  const filteredAccess = useMemo(
    () => (search ? accessRows.filter(r => r.userName.toLowerCase().includes(search.toLowerCase())) : accessRows),
    [accessRows, search],
  );
  const filteredActivity = useMemo(
    () => (search ? activityRows.filter(r => r.userName.toLowerCase().includes(search.toLowerCase())) : activityRows),
    [activityRows, search],
  );

  const activeFilterCount = [search, statusFilter, actionFilter].filter(Boolean).length;
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setActionFilter(''); };

  if (!user || user.role !== 'admin') return <p className="text-muted-foreground text-sm">Acesso restrito.</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <History size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Central de Auditoria</h1>
            <p className="text-xs text-muted-foreground">Acessos ao sistema e trilha de atividade nas ocorrências</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab('access')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${tab === 'access' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            <ShieldCheck size={13} /> Acessos
          </button>
          <button onClick={() => setTab('activity')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${tab === 'activity' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            <ActivityIcon size={13} /> Atividade
          </button>
        </div>
      </div>

      {/* ===== ABA ACESSOS (item 1) ===== */}
      {tab === 'access' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className={cardCls}>
              <p className={kpiLabel}>Acessos</p>
              <p className="text-xl font-mono font-bold text-foreground">{accessStats?.totalAccess ?? '—'}</p>
            </div>
            <div className={`${cardCls} border-success/20`}>
              <p className={kpiLabel}>Ativos agora</p>
              <p className="text-xl font-mono font-bold text-success">{accessStats?.activeNow ?? '—'}</p>
            </div>
            <div className={cardCls}>
              <p className={kpiLabel}>Duração média</p>
              <p className="text-xl font-mono font-bold text-foreground">{accessStats ? fmtDuration(accessStats.avgDurationMs) : '—'}</p>
            </div>
            <div className={cardCls}>
              <p className={kpiLabel}>Usuários</p>
              <p className="text-xl font-mono font-bold text-foreground">{accessStats?.distinctUsers ?? '—'}</p>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-3">
            <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5"><LogIn size={13} /> Acessos por dia</h3>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accessStats?.series ?? []}>
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: 'hsl(0,0%,45%)' }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0,0%,45%)' }} width={24} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => shortDate(String(d))} formatter={(v) => [v, 'acessos']} />
                  <Bar dataKey="count" fill={ACCESS_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {renderFilters('access')}

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-bold">Usuário</th>
                    <th className="px-4 py-2.5 font-bold">Login</th>
                    <th className="px-4 py-2.5 font-bold">Logout</th>
                    <th className="px-4 py-2.5 font-bold">Duração</th>
                    <th className="px-4 py-2.5 font-bold">IP</th>
                    <th className="px-4 py-2.5 font-bold">Dispositivo</th>
                    <th className="px-4 py-2.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingAccess && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
                  {!loadingAccess && filteredAccess.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Nenhum acesso no período.</td></tr>}
                  {filteredAccess.map(r => (
                    <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-foreground">{r.userName}</span>
                        {r.userEmail && <span className="block text-[10px] text-muted-foreground">{r.userEmail}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.loginAt)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.logoutAt)}</td>
                      <td className="px-4 py-2.5 font-mono text-foreground whitespace-nowrap">{fmtDuration(r.durationMs)}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{r.ipAddress ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground flex items-center gap-1"><Monitor size={11} className="shrink-0" /> {parseDevice(r.userAgent)}</td>
                      <td className="px-4 py-2.5">{accessStatusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== ABA ATIVIDADE (item 2) ===== */}
      {tab === 'activity' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className={cardCls}>
              <p className={kpiLabel}>Ações</p>
              <p className="text-xl font-mono font-bold text-foreground">{activityStats?.total ?? '—'}</p>
            </div>
            <div className={cardCls}>
              <p className={kpiLabel}>Usuários</p>
              <p className="text-xl font-mono font-bold text-foreground">{activityStats?.distinctUsers ?? '—'}</p>
            </div>
            <div className={`${cardCls} col-span-2`}>
              <p className={kpiLabel}>Por tipo de ação</p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {(activityStats?.byAction ?? []).slice(0, 6).map(a => (
                  <span key={a.action} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                    {actionLabel(a.action)} <strong className="text-foreground font-mono">{a.count}</strong>
                  </span>
                ))}
                {(!activityStats || activityStats.byAction.length === 0) && <span className="text-[10px] text-muted-foreground">—</span>}
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-3">
            <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5"><ActivityIcon size={13} /> Ações por dia</h3>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityStats?.series ?? []}>
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: 'hsl(0,0%,45%)' }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0,0%,45%)' }} width={24} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => shortDate(String(d))} formatter={(v) => [v, 'ações']} />
                  <Bar dataKey="count" fill={ACTIVITY_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {renderFilters('activity')}

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-bold">Usuário</th>
                    <th className="px-4 py-2.5 font-bold">Ação</th>
                    <th className="px-4 py-2.5 font-bold">Recurso</th>
                    <th className="px-4 py-2.5 font-bold">Detalhes</th>
                    <th className="px-4 py-2.5 font-bold">Quando</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingActivity && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>}
                  {!loadingActivity && filteredActivity.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhuma atividade no período.</td></tr>}
                  {filteredActivity.map(r => (
                    <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-foreground">{r.userName}</td>
                      <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{actionLabel(r.action)}</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.resource === 'occurrence' ? 'Ocorrência' : r.resource}</td>
                      <td className="px-4 py-2.5 text-foreground">{formatDetails(r.action, r.details)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  function renderFilters(mode: 'access' | 'activity') {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Usuário</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar usuário..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-xs text-foreground placeholder:text-muted-foreground h-9 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Período</label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="cursor-pointer text-xs h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7" className="cursor-pointer">Últimos 7 dias</SelectItem>
                <SelectItem value="30" className="cursor-pointer">Últimos 30 dias</SelectItem>
                <SelectItem value="90" className="cursor-pointer">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'access' && (
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v as any)}>
                <SelectTrigger className="cursor-pointer text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">Todos os status</SelectItem>
                  <SelectItem value="ativa" className="cursor-pointer">Ativa</SelectItem>
                  <SelectItem value="encerrada" className="cursor-pointer">Encerrada</SelectItem>
                  <SelectItem value="expirada" className="cursor-pointer">Expirada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === 'activity' && (
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Ação</label>
              <Select value={actionFilter || 'all'} onValueChange={v => setActionFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="cursor-pointer text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">Todas as ações</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([k, label]) => <SelectItem key={k} value={k} className="cursor-pointer">{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="mt-3 text-xs font-bold text-primary hover:text-primary/80 transition-colors">Limpar filtros</button>
        )}
      </div>
    );
  }
}
