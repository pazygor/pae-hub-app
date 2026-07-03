import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { EPI, UserEPI, EPIType, EPI_TYPE_LABELS, EPIUsageStatus, EPI_USAGE_LABELS } from '@/lib/types';
import { canManage, canViewManagement, getVisibleTerminalIds, isTerminalLocked } from '@/lib/access-control';
import {
  HardHat, Plus, Trash2, AlertTriangle, Clock, X, Users, Package, Filter, Search,
  ChevronDown, ChevronUp, CalendarDays, UserCheck, MessageSquare, History, Shield,
  RotateCcw, CheckSquare, ArrowRightLeft, RefreshCw, UserX, UserPlus, CheckCircle, CheckSquare2
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { AssignUsersModal } from './AssignUsersModal';

const COLORS = {
  valid: 'hsl(142, 71%, 45%)',
  soon: 'hsl(38, 92%, 50%)',
  expired: 'hsl(0, 72%, 51%)',
};

const now = new Date();
const soonDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

function isExpired(date: string | null) { if (!date) return false; return new Date(date) < now; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR'); }
function daysUntil(iso: string) { return Math.ceil((new Date(iso).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)); }

type EPIStatus = 'valid' | 'soon' | 'expired' | 'no_validity';

function getStatus(expiryDate: string | null): EPIStatus {
  if (!expiryDate) return 'no_validity';
  const d = new Date(expiryDate);
  if (d < now) return 'expired';
  if (d <= soonDate) return 'soon';
  return 'valid';
}

function statusBadge(status: EPIStatus) {
  switch (status) {
    case 'expired': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/15 text-primary border border-primary/30">VENCIDO</span>;
    case 'soon': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-warning/15 text-warning border border-warning/30">ATENÇÃO</span>;
    case 'valid': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-success/15 text-success border border-success/30">VÁLIDO</span>;
    default: return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border">SEM VALIDADE</span>;
  }
}

function usageBadge(usageStatus: EPIUsageStatus) {
  switch (usageStatus) {
    case 'entregue': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-accent text-accent-foreground border border-border">ENTREGUE</span>;
    case 'em_uso': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-success/15 text-success border border-success/30">EM USO</span>;
    case 'devolvido': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border">DEVOLVIDO</span>;
    case 'vencido': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/15 text-primary border border-primary/30">VENCIDO</span>;
    case 'substituido': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-accent text-accent-foreground border border-border">SUBSTITUÍDO</span>;
  }
}

function statusBarColor(status: EPIStatus) {
  switch (status) {
    case 'expired': return 'bg-primary';
    case 'soon': return 'bg-warning';
    case 'valid': return 'bg-success';
    default: return 'bg-muted-foreground';
  }
}

function buildTimeline(ue: UserEPI, epiName: string) {
  const events: { type: string; date: string; description: string }[] = [];
  events.push({ type: 'entrega', date: ue.deliveryDate, description: `${epiName} entregue` });
  if (ue.usageStatus === 'em_uso') {
    events.push({ type: 'em_uso', date: ue.deliveryDate, description: `${epiName} em uso` });
  }
  if (ue.returnDate && ue.usageStatus === 'devolvido') {
    events.push({ type: 'devolução', date: ue.returnDate, description: `${epiName} devolvido` });
  }
  if (ue.usageStatus === 'substituido') {
    events.push({ type: 'troca', date: ue.returnDate || ue.deliveryDate, description: `${epiName} substituído` });
  }
  if (ue.expiryDate) {
    if (isExpired(ue.expiryDate)) {
      events.push({ type: 'vencimento', date: ue.expiryDate, description: `${epiName} venceu` });
    } else {
      events.push({ type: 'vencimento', date: ue.expiryDate, description: `Vencimento previsto` });
    }
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

const TIMELINE_ICONS: Record<string, { icon: typeof CalendarDays; color: string }> = {
  entrega: { icon: Package, color: 'text-success' },
  em_uso: { icon: CheckSquare, color: 'text-success' },
  renovação: { icon: History, color: 'text-accent-foreground' },
  troca: { icon: ArrowRightLeft, color: 'text-accent-foreground' },
  devolução: { icon: RotateCcw, color: 'text-muted-foreground' },
  vencimento: { icon: AlertTriangle, color: 'text-primary' },
};

const EPI_TYPES = Object.entries(EPI_TYPE_LABELS) as [EPIType, string][];

export function EPIsView() {
  const { user, data, setData } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'epi' | 'user'>('epi');
  const [form, setForm] = useState({ name: '', description: '', epiType: 'outro' as EPIType, expiryDate: '', terminalId: '' });
  const [formError, setFormError] = useState('');
  const [assignForm, setAssignForm] = useState({ userId: '', deliveryDate: '', expiryDate: '', responsible: '', observations: '' });
  const [batchAssign, setBatchAssign] = useState<string | null>(null);
  const [replaceForm, setReplaceForm] = useState<{ userEpiId: string; epiId: string; userId: string } | null>(null);
  const [replaceData, setReplaceData] = useState({ deliveryDate: '', expiryDate: '', responsible: '', observations: '' });

  // Terminal isolation
  const visibleTerminalIds = useMemo(() => getVisibleTerminalIds(user, data), [user, data]);
  const terminalLocked = isTerminalLocked(user);

  // Filters — auto-lock terminal for non-admin users
  const [filterTerminal, setFilterTerminal] = useState('all');
  const effectiveTerminalFilter = terminalLocked && visibleTerminalIds.length === 1 ? visibleTerminalIds[0] : filterTerminal;
  const [filterStatus, setFilterStatus] = useState<'all' | EPIStatus>('all');
  const [filterType, setFilterType] = useState<'all' | EPIType>('all');
  const [filterUsage, setFilterUsage] = useState<'all' | EPIUsageStatus>('all');
  const [searchUser, setSearchUser] = useState('');

  // Active assignments — scoped to visible terminals
  const classified = useMemo(() => {
    return data.userEPIs.map(ue => {
      const u = data.users.find(u => u.id === ue.userId);
      const epi = data.epis.find(e => e.id === ue.epiId);
      return { ...ue, status: getStatus(ue.expiryDate), user: u, epi };
    }).filter(ue => {
      // Terminal isolation: only show assignments for users in visible terminals
      if (!ue.user) return false;
      return visibleTerminalIds.includes(ue.user.linkId || '');
    });
  }, [data, visibleTerminalIds]);

  const activeAssignments = useMemo(() => classified.filter(c => c.usageStatus !== 'substituido' && c.usageStatus !== 'devolvido'), [classified]);

  // Filtered
  const filteredAssignments = useMemo(() => {
    return classified.filter(ue => {
      if (filterStatus !== 'all' && ue.status !== filterStatus) return false;
      if (effectiveTerminalFilter !== 'all' && ue.user?.linkId !== effectiveTerminalFilter) return false;
      if (filterType !== 'all' && ue.epi?.epiType !== filterType) return false;
      if (filterUsage !== 'all' && ue.usageStatus !== filterUsage) return false;
      if (searchUser && ue.user && !ue.user.name.toLowerCase().includes(searchUser.toLowerCase())) return false;
      return true;
    });
  }, [classified, filterStatus, effectiveTerminalFilter, filterType, filterUsage, searchUser]);

  // Counts (active only)
  const validCount = activeAssignments.filter(c => c.status === 'valid').length;
  const soonCount = activeAssignments.filter(c => c.status === 'soon').length;
  const expiredCount = activeAssignments.filter(c => c.status === 'expired').length;

  // Users without any active EPI
  const usersWithoutEPI = useMemo(() => {
    const usersWithActive = new Set(activeAssignments.map(a => a.userId));
    return data.users.filter(u => !usersWithActive.has(u.id) && (u.role === 'terminal' || u.role === 'entity'));
  }, [data.users, activeAssignments]);

  // Charts
  const donutData = [
    { name: 'Em Uso', value: activeAssignments.filter(c => c.usageStatus === 'em_uso').length, color: COLORS.valid },
    { name: 'Vencidos', value: expiredCount, color: COLORS.expired },
    { name: 'Atenção', value: soonCount, color: COLORS.soon },
  ].filter(d => d.value > 0);

  const barData = data.terminals.map(t => {
    const tUsers = data.users.filter(u => u.linkId === t.id).map(u => u.id);
    const tClassified = activeAssignments.filter(c => tUsers.includes(c.userId));
    return {
      name: t.name.length > 14 ? t.name.substring(0, 14) + '…' : t.name,
      'Em Uso': tClassified.filter(c => c.usageStatus === 'em_uso').length,
      'Atenção': tClassified.filter(c => c.status === 'soon').length,
      'Vencidos': tClassified.filter(c => c.status === 'expired').length,
    };
  });

  const hasChartData = activeAssignments.length > 0;

  // User-centric grouping
  const userGroups = useMemo(() => {
    const map = new Map<string, typeof filteredAssignments>();
    for (const a of filteredAssignments) {
      const key = a.userId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries())
      .map(([userId, items]) => ({
        userId,
        user: data.users.find(u => u.id === userId),
        items,
        activeItems: items.filter(i => i.usageStatus !== 'substituido' && i.usageStatus !== 'devolvido'),
        hasExpired: items.some(i => i.status === 'expired' && i.usageStatus !== 'substituido'),
        hasSoon: items.some(i => i.status === 'soon' && i.usageStatus !== 'substituido'),
      }))
      .sort((a, b) => {
        if (a.hasExpired !== b.hasExpired) return a.hasExpired ? -1 : 1;
        if (a.hasSoon !== b.hasSoon) return a.hasSoon ? -1 : 1;
        return (a.user?.name || '').localeCompare(b.user?.name || '');
      });
  }, [filteredAssignments, data.users]);

  // Actions
  const addEPI = () => {
    if (!form.name) { setFormError('Informe o nome do EPI.'); return; }
    setFormError('');
    setFormError('');
    const e: EPI = {
      id: `epi${Date.now()}`, name: form.name, description: form.description,
      epiType: form.epiType, expiryDate: form.expiryDate || null,
      terminalId: form.terminalId || undefined,
    };
    setData(d => ({ ...d, epis: [...d.epis, e] }));
    setForm({ name: '', description: '', epiType: 'outro', expiryDate: '', terminalId: '' });
    setShowForm(false);
  };

  // Batch assign EPI to multiple users
  const batchAssignEPI = (epiId: string, userIds: string[]) => {
    if (userIds.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const epi = data.epis.find(e => e.id === epiId);
    const newUes: UserEPI[] = userIds
      .filter(uid => !data.userEPIs.some(ue => ue.epiId === epiId && ue.userId === uid && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido'))
      .map((uid, i) => ({
        id: `ue${Date.now()}${i}`, epiId, userId: uid,
        deliveryDate: today, expiryDate: epi?.expiryDate || null,
        responsible: user?.name || '', observations: '',
        usageStatus: 'em_uso' as EPIUsageStatus,
      }));
    if (newUes.length > 0) {
      setData(d => ({ ...d, userEPIs: [...d.userEPIs, ...newUes] }));
    }
    setBatchAssign(null);
  };

  const removeEPI = (id: string) => {
    setData(d => ({ ...d, epis: d.epis.filter(e => e.id !== id), userEPIs: d.userEPIs.filter(ue => ue.epiId !== id) }));
  };

  const assignEPI = (epiId: string) => {
    if (!assignForm.userId || !assignForm.deliveryDate) return;
    const epi = data.epis.find(e => e.id === epiId);
    let expiryDate = assignForm.expiryDate || null;
    if (!expiryDate && epi?.expiryDate) {
      expiryDate = epi.expiryDate;
    }
    const ue: UserEPI = {
      id: `ue${Date.now()}`, epiId, userId: assignForm.userId,
      deliveryDate: assignForm.deliveryDate, expiryDate,
      responsible: assignForm.responsible, observations: assignForm.observations,
      usageStatus: 'em_uso',
    };
    setData(d => ({ ...d, userEPIs: [...d.userEPIs, ue] }));
    setAssignForm({ userId: '', deliveryDate: '', expiryDate: '', responsible: '', observations: '' });
    setShowAssignForm(null);
  };

  const removeUserEPI = (id: string) => {
    setData(d => ({ ...d, userEPIs: d.userEPIs.filter(ue => ue.id !== id) }));
  };

  const changeUsageStatus = (id: string, newStatus: EPIUsageStatus) => {
    setData(d => ({
      ...d,
      userEPIs: d.userEPIs.map(ue =>
        ue.id === id
          ? { ...ue, usageStatus: newStatus, ...(newStatus === 'devolvido' || newStatus === 'substituido' ? { returnDate: new Date().toISOString().split('T')[0] } : {}) }
          : ue
      ),
    }));
  };

  const replaceEPI = () => {
    if (!replaceForm || !replaceData.deliveryDate) return;
    const { userEpiId, epiId, userId } = replaceForm;
    const epi = data.epis.find(e => e.id === epiId);
    let expiryDate = replaceData.expiryDate || null;
    if (!expiryDate && epi?.expiryDate) expiryDate = epi.expiryDate;

    const newUe: UserEPI = {
      id: `ue${Date.now()}`, epiId, userId,
      deliveryDate: replaceData.deliveryDate, expiryDate,
      responsible: replaceData.responsible, observations: replaceData.observations,
      usageStatus: 'em_uso',
    };

    setData(d => ({
      ...d,
      userEPIs: [
        ...d.userEPIs.map(ue =>
          ue.id === userEpiId
            ? { ...ue, usageStatus: 'substituido' as EPIUsageStatus, returnDate: new Date().toISOString().split('T')[0] }
            : ue
        ),
        newUe,
      ],
    }));
    setReplaceForm(null);
    setReplaceData({ deliveryDate: '', expiryDate: '', responsible: '', observations: '' });
  };

  if (!user || (user.role !== 'admin' && user.role !== 'terminal')) return <p className="text-muted-foreground text-sm">Acesso restrito.</p>;
  // Estratégico can view but not manage
  const isEstrategico = user.accessLevel === 'estratégico';
  const userCanManage = canManage(user);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HardHat size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Gestão de EPIs</h1>
            <p className="text-xs text-muted-foreground">Catálogo do terminal — associe EPIs aos usuários para delegação</p>
          </div>
        </div>
        {userCanManage && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            <Plus size={14} /> Novo EPI
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total EPIs</p>
          <p className="text-xl font-mono font-bold text-foreground">{data.epis.length}</p>
        </div>
        <div className="bg-card border border-success/20 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Em Uso</p>
          <p className="text-xl font-mono font-bold text-success">{activeAssignments.filter(c => c.usageStatus === 'em_uso').length}</p>
        </div>
        <div className="bg-card border border-warning/20 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Atenção</p>
          <p className="text-xl font-mono font-bold text-warning">{soonCount}</p>
        </div>
        <div className="bg-card border border-primary/20 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Vencidos</p>
          <p className="text-xl font-mono font-bold text-primary">{expiredCount}</p>
        </div>
        <div className="bg-card border border-destructive/20 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Sem EPI</p>
          <p className="text-xl font-mono font-bold text-destructive">{usersWithoutEPI.length}</p>
        </div>
      </div>

      {/* Charts */}
      {hasChartData && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border rounded-xl p-3">
            <h3 className="text-xs font-bold text-foreground mb-2">Visão Geral</h3>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30} paddingAngle={3}>
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(0,0%,10%)', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                  <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <h3 className="text-xs font-bold text-foreground mb-2">Por Terminal</h3>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={2}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(0,0%,45%)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0,0%,45%)' }} />
                  <Tooltip contentStyle={{ background: 'hsl(0,0%,10%)', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                  <Bar dataKey="Em Uso" stackId="a" fill={COLORS.valid} />
                  <Bar dataKey="Atenção" stackId="a" fill={COLORS.soon} />
                  <Bar dataKey="Vencidos" stackId="a" fill={COLORS.expired} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Filtros</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setViewMode('user')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
              <Users size={12} className="inline mr-1" />Por Usuário
            </button>
            <button onClick={() => setViewMode('epi')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'epi' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
              <Package size={12} className="inline mr-1" />Por EPI
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar usuário..." value={searchUser} onChange={e => setSearchUser(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-secondary/50 border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="text-xs bg-secondary/50 border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">Todos os status</option>
            <option value="valid">Válido</option>
            <option value="soon">Atenção</option>
            <option value="expired">Vencido</option>
          </select>
          <select value={filterUsage} onChange={e => setFilterUsage(e.target.value as any)}
            className="text-xs bg-secondary/50 border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">Todos os usos</option>
            <option value="em_uso">Em Uso</option>
            <option value="vencido">Vencido</option>
            <option value="substituido">Substituído</option>
            <option value="devolvido">Devolvido</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
            className="text-xs bg-secondary/50 border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">Todos os tipos</option>
            {EPI_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {!terminalLocked && (
            <select value={filterTerminal} onChange={e => setFilterTerminal(e.target.value)}
              className="text-xs bg-secondary/50 border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="all">Todos os terminais</option>
              {data.terminals.filter(t => visibleTerminalIds.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.valid }} /> {validCount}</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.soon }} /> {soonCount}</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.expired }} /> {expiredCount}</span>
          </div>
        </div>
      </div>

      {/* Add EPI Form */}
      {showForm && (
        <div className="bg-card border border-primary/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Cadastrar Novo EPI</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Nome</label>
              <input placeholder="Nome do EPI" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Tipo</label>
              <select value={form.epiType} onChange={e => setForm(f => ({ ...f, epiType: e.target.value as EPIType }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground">
                {EPI_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Terminal</label>
              <select value={form.terminalId} onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground">
                <option value="">Selecione o terminal...</option>
                {data.terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Data de Validade</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Descrição</label>
            <textarea placeholder="Descrição do EPI" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground" rows={2} />
          </div>
          <p className="text-[10px] text-muted-foreground">Após salvar, use o botão <strong>"Entregar EPI"</strong> para distribuir a usuários específicos.</p>
          {formError && <p className="text-xs text-primary font-bold">{formError}</p>}
          <button onClick={addEPI} className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110">Salvar EPI</button>
        </div>
      )}

      {/* Replace EPI Modal */}
      {replaceForm && (
        <div className="bg-card border border-accent rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={16} className="text-accent-foreground" />
              <h3 className="text-sm font-bold text-foreground">Substituir EPI</h3>
            </div>
            <button onClick={() => setReplaceForm(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <p className="text-xs text-muted-foreground">O EPI atual será marcado como substituído e um novo registro será criado.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Nova Data Entrega</label>
              <input type="date" value={replaceData.deliveryDate} onChange={e => setReplaceData(f => ({ ...f, deliveryDate: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Nova Validade</label>
              <input type="date" value={replaceData.expiryDate} onChange={e => setReplaceData(f => ({ ...f, expiryDate: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Responsável</label>
              <input placeholder="Quem entregou" value={replaceData.responsible} onChange={e => setReplaceData(f => ({ ...f, responsible: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Observações</label>
              <input placeholder="Motivo da troca..." value={replaceData.observations} onChange={e => setReplaceData(f => ({ ...f, observations: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
          </div>
          <button onClick={replaceEPI} className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110">Confirmar Substituição</button>
        </div>
      )}

      {/* Users without EPI alert */}
      {usersWithoutEPI.length > 0 && viewMode === 'user' && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserX size={14} className="text-destructive" />
            <span className="text-xs font-bold text-destructive">Usuários sem EPI atribuído ({usersWithoutEPI.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {usersWithoutEPI.map(u => {
              const terminal = u.linkId ? data.terminals.find(t => t.id === u.linkId) : null;
              return (
                <div key={u.id} className="flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center text-[10px] font-bold text-destructive">{u.name.charAt(0)}</div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{u.name}</p>
                    {terminal && <p className="text-[9px] text-muted-foreground">{terminal.name}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== USER VIEW ===== */}
      {viewMode === 'user' && (
        <div className="space-y-3">
          {userGroups.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum resultado encontrado.</div>
          )}
          {userGroups.map(({ userId, user: u, items, activeItems, hasExpired, hasSoon }) => {
            const isExpanded = expandedUser === userId;
            const terminal = u?.linkId ? data.terminals.find(t => t.id === u.linkId) : null;
            const expCount = activeItems.filter(i => i.status === 'expired').length;
            const soonC = activeItems.filter(i => i.status === 'soon').length;

            return (
              <div key={userId} className={`bg-card border rounded-xl overflow-hidden transition-all ${hasExpired ? 'border-primary/30' : hasSoon ? 'border-warning/30' : ''}`}>
                {/* User header */}
                <button
                  onClick={() => setExpandedUser(isExpanded ? null : userId)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${hasExpired ? 'bg-primary/15 text-primary' : hasSoon ? 'bg-warning/15 text-warning' : 'bg-secondary text-foreground'}`}>
                    {u?.name.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{u?.name || userId}</p>
                      {terminal && <span className="text-[9px] bg-secondary rounded px-1.5 py-0.5 text-muted-foreground">{terminal.name}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">{activeItems.length} EPI(s) ativo(s)</span>
                      {expCount > 0 && <span className="text-[10px] text-primary font-bold">⚠ {expCount} vencido(s)</span>}
                      {soonC > 0 && <span className="text-[10px] text-warning font-bold">⏰ {soonC} atenção</span>}
                    </div>
                  </div>
                  <div className="flex gap-0.5 h-2 w-20 rounded-full overflow-hidden bg-secondary shrink-0">
                    {activeItems.map((item, i) => (
                      <div key={i} className={`flex-1 ${statusBarColor(item.status)}`} />
                    ))}
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t divide-y divide-border">
                    {items.map(ue => {
                      const epi = ue.epi;
                      if (!epi) return null;
                      const timeline = buildTimeline(ue, epi.name);
                      const days = ue.expiryDate ? daysUntil(ue.expiryDate) : null;
                      const isInactive = ue.usageStatus === 'substituido' || ue.usageStatus === 'devolvido';

                      return (
                        <div key={ue.id} className={`px-5 py-4 ${isInactive ? 'opacity-50' : ue.status === 'expired' ? 'bg-primary/5' : ue.status === 'soon' ? 'bg-warning/5' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold text-foreground">{epi.name}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{EPI_TYPE_LABELS[epi.epiType]}</span>
                                {usageBadge(ue.usageStatus)}
                                {!isInactive && statusBadge(ue.status)}
                              </div>
                              {epi.description && <p className="text-[10px] text-muted-foreground mb-2">{epi.description}</p>}

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <CalendarDays size={11} className="shrink-0" />
                                  <span>Entrega: <strong className="text-foreground">{fmtDate(ue.deliveryDate)}</strong></span>
                                </div>
                                {ue.expiryDate && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Clock size={11} className="shrink-0" />
                                    <span>Vence: <strong className={ue.status === 'expired' ? 'text-primary' : ue.status === 'soon' ? 'text-warning' : 'text-foreground'}>{fmtDate(ue.expiryDate)}</strong></span>
                                  </div>
                                )}
                                {ue.responsible && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <UserCheck size={11} className="shrink-0" />
                                    <span>Resp: <strong className="text-foreground">{ue.responsible}</strong></span>
                                  </div>
                                )}
                                {days !== null && !isInactive && (
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <Shield size={11} className="shrink-0 text-muted-foreground" />
                                    <span className={days < 0 ? 'text-primary font-bold' : days <= 30 ? 'text-warning font-bold' : 'text-muted-foreground'}>
                                      {days < 0 ? `Vencido há ${Math.abs(days)} dias` : `${days} dias restantes`}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {ue.observations && (
                                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mb-3">
                                  <MessageSquare size={11} className="shrink-0 mt-0.5" />
                                  <span>{ue.observations}</span>
                                </div>
                              )}

                              {/* Timeline */}
                              <div className="border-l-2 border-border pl-3 ml-1 space-y-2">
                                {timeline.map((ev, i) => {
                                  const cfg = TIMELINE_ICONS[ev.type] || TIMELINE_ICONS.entrega;
                                  const Icon = cfg.icon;
                                  return (
                                    <div key={i} className="flex items-center gap-2 text-[10px]">
                                      <div className={`w-4 h-4 rounded-full flex items-center justify-center -ml-[21px] bg-card border border-border`}>
                                        <Icon size={9} className={cfg.color} />
                                      </div>
                                      <span className="text-muted-foreground">{fmtDate(ev.date)}</span>
                                      <span className="text-foreground">{ev.description}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5 shrink-0">
                              {userCanManage && !isInactive && (
                                <button
                                  onClick={() => {
                                    setReplaceForm({ userEpiId: ue.id, epiId: ue.epiId, userId: ue.userId });
                                    setReplaceData({ deliveryDate: '', expiryDate: '', responsible: '', observations: '' });
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-accent-foreground bg-accent rounded-lg hover:bg-accent/80 transition-colors"
                                  title="Substituir EPI"
                                >
                                  <RefreshCw size={11} /> Substituir
                                </button>
                              )}
                              {userCanManage && !isInactive && ue.usageStatus === 'entregue' && (
                                <button onClick={() => changeUsageStatus(ue.id, 'em_uso')} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-success bg-success/10 rounded-lg hover:bg-success/20 transition-colors" title="Marcar em uso">
                                  <CheckSquare size={11} /> Em Uso
                                </button>
                              )}
                              {userCanManage && (
                                <button onClick={() => removeUserEPI(ue.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== EPI VIEW ===== */}
      {viewMode === 'epi' && (
        <div className="space-y-4">
          {data.epis
            .filter(epi => filterType === 'all' || epi.epiType === filterType)
            .map(epi => {
              const assignments = filteredAssignments.filter(a => a.epiId === epi.id);
              const activeEpiAssignments = assignments.filter(a => a.usageStatus !== 'substituido' && a.usageStatus !== 'devolvido');
              const expCount = activeEpiAssignments.filter(a => a.status === 'expired').length;

              return (
                <div key={epi.id} className="bg-card border rounded-xl overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                      <Package size={16} className="text-primary shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                         <span className="text-sm font-bold text-foreground">{epi.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{EPI_TYPE_LABELS[epi.epiType]}</span>
                          {epi.terminalId && (() => { const t = data.terminals.find(t => t.id === epi.terminalId); return t ? <span className="text-[9px] px-1.5 py-0.5 bg-accent text-accent-foreground rounded font-bold">{t.name}</span> : null; })()}
                          {!epi.terminalId && <span className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded font-bold">GLOBAL</span>}
                          {epi.expiryDate && <span className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-bold">Validade: {fmtDate(epi.expiryDate)}</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{epi.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {expCount > 0 && <span className="flex items-center gap-1 text-[10px] text-primary font-bold"><AlertTriangle size={12} /> {expCount}</span>}
                      {userCanManage && (
                        <button onClick={() => setBatchAssign(epi.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors" title="Entregar EPI">
                          <UserPlus size={12} /> Entregar EPI
                        </button>
                      )}
                      {userCanManage && <button onClick={() => removeEPI(epi.id)} className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 size={14} /></button>}
                    </div>
                  </div>

                  {assignments.length > 0 ? (
                    <div className="divide-y divide-border">
                      {assignments.map(ue => {
                        const u = ue.user;
                        const isInactive = ue.usageStatus === 'substituido' || ue.usageStatus === 'devolvido';
                        return (
                          <div key={ue.id} className={`px-5 py-3 flex items-center justify-between ${isInactive ? 'opacity-50' : ue.status === 'expired' ? 'bg-primary/5' : ue.status === 'soon' ? 'bg-warning/5' : ''}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">{u?.name.charAt(0) || '?'}</div>
                              <div>
                                <span className="text-xs font-medium text-foreground">{u?.name || ue.userId}</span>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Package size={10} /> {fmtDate(ue.deliveryDate)}</span>
                                  {ue.expiryDate && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock size={10} /> {fmtDate(ue.expiryDate)}</span>}
                                  {ue.responsible && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><UserCheck size={10} /> {ue.responsible}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {usageBadge(ue.usageStatus)}
                              {!isInactive && statusBadge(ue.status)}
                              {userCanManage && !isInactive && (
                                <button
                                  onClick={() => {
                                    setReplaceForm({ userEpiId: ue.id, epiId: ue.epiId, userId: ue.userId });
                                    setReplaceData({ deliveryDate: '', expiryDate: '', responsible: '', observations: '' });
                                  }}
                                  className="p-1 text-accent-foreground hover:bg-accent rounded transition-colors" title="Substituir"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              )}
                              {userCanManage && <button onClick={() => removeUserEPI(ue.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={12} /></button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-4 text-center text-xs text-muted-foreground">Nenhum usuário associado.</div>
                  )}
                </div>
              );
            })}

          {data.epis.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum EPI cadastrado.</div>
          )}
        </div>
      )}

      {/* Assign Users Modal */}
      {batchAssign && (
        <AssignUsersModal
          open={!!batchAssign}
          onClose={() => setBatchAssign(null)}
          title="Entregar EPI"
          description={`Selecione os usuários que receberão o EPI "${data.epis.find(e => e.id === batchAssign)?.name || ''}".`}
          confirmLabel="Confirmar Entrega"
          users={data.users}
          terminals={data.terminals}
          alreadyAssignedIds={new Set(data.userEPIs.filter(ue => ue.epiId === batchAssign && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido').map(ue => ue.userId))}
          onConfirm={(userIds) => batchAssignEPI(batchAssign, userIds)}
        />
      )}
    </div>
  );
}
