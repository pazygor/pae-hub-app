import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ComplianceItem, ComplianceStatus } from '@/lib/types';
import { canManage, getVisibleTerminalIds, isTerminalLocked } from '@/lib/access-control';
import { isMenuItemAccessible, getDefaultModules, getDefaultSafetySubModules, ProductModule, SafetySubModule } from '@/lib/modules';
import {
  CheckCircle2, XCircle, AlertTriangle, Filter, Search, AlertCircle, Plus, X, Trash2,
  ClipboardCheck, ChevronDown, ChevronUp, Clock, UserCheck, FileText, Shield
} from 'lucide-react';

type SafetyStatus = 'operacional' | 'atencao' | 'nao_conforme';
type ViewTab = 'integrated' | 'manual';

const STATUS_CONFIG: Record<SafetyStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  operacional: { label: 'Conforme', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
  atencao: { label: 'Atenção', color: 'text-warning', bg: 'bg-warning/10', icon: AlertCircle },
  nao_conforme: { label: 'Não Conforme', color: 'text-primary', bg: 'bg-primary/10', icon: XCircle },
};

const COMPLIANCE_STATUS_MAP: Record<ComplianceStatus, SafetyStatus> = {
  conforme: 'operacional',
  atencao: 'atencao',
  nao_conforme: 'nao_conforme',
};

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR'); }

export function CompliancePage() {
  const { user, data, setData } = useAuth();
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Check which modules are active
  const getActiveSubs = (): SafetySubModule[] => {
    if (!user || user.role === 'admin') return getDefaultSafetySubModules();
    const config = data.terminalModules?.find(tm => tm.terminalId === user?.linkId);
    return config?.activeSafetySubModules ?? getDefaultSafetySubModules();
  };
  const activeSubs = getActiveSubs();
  const hasTrainings = activeSubs.includes('trainings');
  const hasEPIs = activeSubs.includes('epis');
  const hasIntegration = hasTrainings || hasEPIs;

  // Terminal isolation
  const visibleTerminalIds = useMemo(() => getVisibleTerminalIds(user, data), [user, data]);
  const terminalLocked = isTerminalLocked(user);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<SafetyStatus | 'all'>('all');
  const [filterTerminal, setFilterTerminal] = useState<string>('all');
  const effectiveTerminalFilter = terminalLocked && visibleTerminalIds.length === 1 ? visibleTerminalIds[0] : filterTerminal;
  const [activeTab, setActiveTab] = useState<ViewTab>(hasIntegration ? 'integrated' : 'manual');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', responsible: '', status: 'conforme' as ComplianceStatus, expiryDate: '', userId: '', notes: '', terminalId: '', area: '', verificationDate: '' });
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // ===== INTEGRATED DATA (from trainings & EPIs) =====
  const userSummaries = useMemo(() => {
    if (!hasIntegration) return [];
    return data.users
      .filter(u => visibleTerminalIds.includes(u.linkId || ''))
      .map(u => {
      const uTrainings = hasTrainings ? data.userTrainings.filter(ut => ut.userId === u.id) : [];
      const uEPIs = hasEPIs ? data.userEPIs.filter(ue => ue.userId === u.id) : [];
      const mandatoryTrainings = hasTrainings ? data.trainings.filter(t => t.mandatory) : [];

      const missingTrainings = mandatoryTrainings.filter(t => !uTrainings.some(ut => ut.trainingId === t.id && new Date(ut.expiryDate) >= now));
      const expiredTrainings = uTrainings.filter(ut => new Date(ut.expiryDate) < now);
      const expiredEPIs = uEPIs.filter(ue => ue.expiryDate && new Date(ue.expiryDate) < now);
      const soonTrainings = uTrainings.filter(ut => { const d = new Date(ut.expiryDate); return d >= now && d <= soon; });
      const soonEPIs = uEPIs.filter(ue => { if (!ue.expiryDate) return false; const d = new Date(ue.expiryDate); return d >= now && d <= soon; });
      const totalCompleted = uTrainings.filter(ut => new Date(ut.expiryDate) >= now).length;
      const totalEPIsValid = uEPIs.filter(ue => !ue.expiryDate || new Date(ue.expiryDate) >= now).length;

      let status: SafetyStatus = 'operacional';
      if (missingTrainings.length > 0 || expiredTrainings.length > 0 || expiredEPIs.length > 0) status = 'nao_conforme';
      else if (soonTrainings.length > 0 || soonEPIs.length > 0) status = 'atencao';

      const terminal = u.linkId ? data.terminals.find(t => t.id === u.linkId) : null;
      return { user: u, status, missingTrainings, expiredTrainings, expiredEPIs, soonTrainings, soonEPIs, totalCompleted, totalEPIsValid, totalMandatory: mandatoryTrainings.length, totalEPIsDelivered: uEPIs.length, terminal };
    });
  }, [data, hasTrainings, hasEPIs, visibleTerminalIds]);

  const filteredIntegrated = useMemo(() => {
    return userSummaries.filter(s => {
      if (searchTerm && !s.user.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (effectiveTerminalFilter !== 'all' && s.user.linkId !== effectiveTerminalFilter) return false;
      return true;
    });
  }, [userSummaries, searchTerm, filterStatus, effectiveTerminalFilter]);

  // ===== MANUAL COMPLIANCE ITEMS =====
  const manualItems = data.complianceItems || [];
  const filteredManual = useMemo(() => {
    return manualItems.filter(item => {
      // Terminal isolation for manual items
      if (item.terminalId && !visibleTerminalIds.includes(item.terminalId)) return false;
      const status = COMPLIANCE_STATUS_MAP[item.status];
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase()) && !item.responsible.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterStatus !== 'all' && status !== filterStatus) return false;
      if (effectiveTerminalFilter !== 'all' && item.terminalId !== effectiveTerminalFilter) return false;
      return true;
    });
  }, [manualItems, searchTerm, filterStatus, effectiveTerminalFilter, visibleTerminalIds]);

  // Counts
  const intOp = userSummaries.filter(s => s.status === 'operacional').length;
  const intAt = userSummaries.filter(s => s.status === 'atencao').length;
  const intNc = userSummaries.filter(s => s.status === 'nao_conforme').length;
  const manOp = manualItems.filter(i => i.status === 'conforme').length;
  const manAt = manualItems.filter(i => i.status === 'atencao').length;
  const manNc = manualItems.filter(i => i.status === 'nao_conforme').length;
  const totalOp = intOp + manOp;
  const totalAt = intAt + manAt;
  const totalNc = intNc + manNc;
  const totalItems = (hasIntegration ? data.users.length : 0) + manualItems.length;

  // Actions
  const addItem = () => {
    if (!form.name) return;
    const today = new Date().toISOString().split('T')[0];
    const item: ComplianceItem = {
      id: `ci${Date.now()}`, name: form.name, responsible: form.responsible,
      status: form.status, expiryDate: form.expiryDate || null,
      userId: form.userId || null, notes: form.notes,
      terminalId: form.terminalId || null, area: form.area || '',
      verificationDate: form.verificationDate || today,
    };
    setData(d => ({ ...d, complianceItems: [...(d.complianceItems || []), item] }));
    setForm({ name: '', responsible: '', status: 'conforme', expiryDate: '', userId: '', notes: '', terminalId: '', area: '', verificationDate: '' });
    setShowForm(false);
  };

  const removeItem = (id: string) => {
    setData(d => ({ ...d, complianceItems: (d.complianceItems || []).filter(i => i.id !== id) }));
  };

  const updateItemStatus = (id: string, status: ComplianceStatus) => {
    const today = new Date().toISOString().split('T')[0];
    setData(d => ({
      ...d,
      complianceItems: (d.complianceItems || []).map(i => i.id === id ? { ...i, status, verificationDate: today } : i),
    }));
  };

  const correctItem = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    setData(d => ({
      ...d,
      complianceItems: (d.complianceItems || []).map(i => i.id === id ? { ...i, status: 'conforme' as ComplianceStatus, verificationDate: today } : i),
    }));
  };

  const nonConformItems = manualItems.filter(i => i.status === 'nao_conforme');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardCheck size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Gestão de Conformidade</h1>
            <p className="text-xs text-muted-foreground">
              {hasIntegration ? 'Visão consolidada integrada e manual' : 'Controle manual de itens de conformidade'}
            </p>
          </div>
        </div>
        {canManage(user) && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            <Plus size={14} /> Novo Item
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total</p>
          <p className="text-2xl font-mono font-bold text-foreground">{totalItems}</p>
        </div>
        <div className="bg-card border border-success/20 rounded-xl p-4 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Conforme</p>
          <p className="text-2xl font-mono font-bold text-success">{totalOp}</p>
        </div>
        <div className="bg-card border border-warning/20 rounded-xl p-4 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Atenção</p>
          <p className="text-2xl font-mono font-bold text-warning">{totalAt}</p>
        </div>
        <div className="bg-card border border-primary/20 rounded-xl p-4 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Não Conforme</p>
          <p className="text-2xl font-mono font-bold text-primary">{totalNc}</p>
        </div>
      </div>

      {/* Filters + Tabs */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Filtros</span>
          </div>
          {hasIntegration && (
            <div className="flex gap-1">
              <button onClick={() => setActiveTab('integrated')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'integrated' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                <Shield size={12} className="inline mr-1" />Integrado
              </button>
              <button onClick={() => setActiveTab('manual')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                <FileText size={12} className="inline mr-1" />Manual
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-secondary/50 border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="text-xs bg-secondary/50 border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="all">Todos os status</option>
            <option value="operacional">Conforme</option>
            <option value="atencao">Atenção</option>
            <option value="nao_conforme">Não Conforme</option>
          </select>
          {!terminalLocked && (activeTab === 'integrated' || activeTab === 'manual') && (
            <select value={filterTerminal} onChange={e => setFilterTerminal(e.target.value)}
              className="text-xs bg-secondary/50 border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="all">Todos os terminais</option>
              {data.terminals.filter(t => visibleTerminalIds.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-card border border-primary/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Novo Item de Conformidade</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Nome</label>
              <input placeholder="Descrição do item" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Responsável</label>
              <input placeholder="Responsável" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ComplianceStatus }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground">
                <option value="conforme">Conforme</option>
                <option value="atencao">Atenção</option>
                <option value="nao_conforme">Não Conforme</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Terminal</label>
              <select value={form.terminalId} onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground">
                <option value="">Nenhum</option>
                {data.terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Área</label>
              <input placeholder="Ex: Pátio, Berço 101..." value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Data de Verificação</label>
              <input type="date" value={form.verificationDate} onChange={e => setForm(f => ({ ...f, verificationDate: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Validade (opcional)</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Usuário (opcional)</label>
              <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground">
                <option value="">Nenhum</option>
                {data.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Observações</label>
              <input placeholder="Notas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-input rounded-lg text-sm text-foreground" />
            </div>
          </div>
          <button onClick={addItem} className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110">Salvar Item</button>
        </div>
      )}

      {/* ===== INTEGRATED VIEW ===== */}
      {activeTab === 'integrated' && hasIntegration && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Conformidade por Usuário</h3>
            <span className="text-xs text-muted-foreground">{filteredIntegrated.length} de {data.users.length}</span>
          </div>
          <div className="divide-y divide-border">
            {filteredIntegrated.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
            )}
            {filteredIntegrated.map(({ user: u, status, missingTrainings, expiredTrainings, expiredEPIs, soonTrainings, soonEPIs, totalCompleted, totalEPIsValid, totalMandatory, totalEPIsDelivered, terminal }) => {
              const cfg = STATUS_CONFIG[status];
              const StatusIcon = cfg.icon;
              const isExpanded = expandedUser === u.id;
              const hasIssues = missingTrainings.length > 0 || expiredTrainings.length > 0 || expiredEPIs.length > 0 || soonTrainings.length > 0 || soonEPIs.length > 0;

              return (
                <div key={u.id}>
                  <button
                    onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-secondary/30 transition-colors"
                  >
                    <StatusIcon size={18} className={`${cfg.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{u.name}</p>
                        {terminal && <span className="text-[9px] bg-secondary rounded px-1.5 py-0.5 text-muted-foreground">{terminal.name}</span>}
                      </div>
                      <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                        {hasTrainings && <span>Trein: <strong className="text-foreground">{totalCompleted}/{totalMandatory}</strong></span>}
                        {hasEPIs && <span>EPIs: <strong className="text-foreground">{totalEPIsDelivered}</strong> ({totalEPIsValid} válidos)</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {hasIssues && (isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />)}
                  </button>

                  {isExpanded && hasIssues && (
                    <div className="px-5 pb-4 pl-12 space-y-1">
                      {missingTrainings.map(t => (
                        <div key={t.id} className="flex items-center gap-2 text-xs text-primary"><AlertTriangle size={12} /><span>Obrigatório ausente: <strong>{t.name}</strong></span></div>
                      ))}
                      {expiredTrainings.map(ut => {
                        const t = data.trainings.find(tr => tr.id === ut.trainingId);
                        return <div key={ut.id} className="flex items-center gap-2 text-xs text-primary"><AlertTriangle size={12} /><span>Treinamento vencido: <strong>{t?.name}</strong> ({fmtDate(ut.expiryDate)})</span></div>;
                      })}
                      {expiredEPIs.map(ue => {
                        const e = data.epis.find(ep => ep.id === ue.epiId);
                        return <div key={ue.id} className="flex items-center gap-2 text-xs text-primary"><AlertTriangle size={12} /><span>EPI vencido: <strong>{e?.name}</strong> ({fmtDate(ue.expiryDate!)})</span></div>;
                      })}
                      {soonTrainings.map(ut => {
                        const t = data.trainings.find(tr => tr.id === ut.trainingId);
                        return <div key={ut.id} className="flex items-center gap-2 text-xs text-warning"><AlertCircle size={12} /><span>Vencendo: <strong>{t?.name}</strong> ({fmtDate(ut.expiryDate)})</span></div>;
                      })}
                      {soonEPIs.map(ue => {
                        const e = data.epis.find(ep => ep.id === ue.epiId);
                        return <div key={ue.id} className="flex items-center gap-2 text-xs text-warning"><AlertCircle size={12} /><span>EPI vencendo: <strong>{e?.name}</strong> ({fmtDate(ue.expiryDate!)})</span></div>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-conform alert */}
      {(activeTab === 'manual' || !hasIntegration) && nonConformItems.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-primary" />
            <span className="text-xs font-bold text-primary">{nonConformItems.length} {nonConformItems.length === 1 ? 'item não conforme' : 'itens não conformes'}</span>
          </div>
          <div className="space-y-1">
            {nonConformItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground truncate">{item.name} {item.area && <span className="text-muted-foreground">— {item.area}</span>}</span>
                <button onClick={() => correctItem(item.id)} className="shrink-0 px-2.5 py-1 bg-success/10 text-success text-[10px] font-bold rounded-lg hover:bg-success/20 transition-colors flex items-center gap-1">
                  <CheckCircle2 size={10} /> Corrigir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== MANUAL VIEW ===== */}
      {(activeTab === 'manual' || !hasIntegration) && (
        <div className="space-y-3">
          {filteredManual.length === 0 && (
            <div className="bg-card border rounded-xl p-8 text-center text-sm text-muted-foreground">
              Nenhum item de conformidade cadastrado. Clique em "Novo Item" para começar.
            </div>
          )}
          {filteredManual.map(item => {
            const status = COMPLIANCE_STATUS_MAP[item.status];
            const cfg = STATUS_CONFIG[status];
            const StatusIcon = cfg.icon;
            const linkedUser = item.userId ? data.users.find(u => u.id === item.userId) : null;
            const isOverdue = item.expiryDate && new Date(item.expiryDate) < now;
            const isSoon = item.expiryDate && !isOverdue && new Date(item.expiryDate) <= soon;
            const isNonConform = item.status === 'nao_conforme';

            return (
              <div key={item.id} className={`bg-card border rounded-xl p-5 ${isOverdue ? 'border-primary/30' : isSoon ? 'border-warning/30' : isNonConform ? 'border-primary/20' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <StatusIcon size={18} className={`${cfg.color} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-foreground">{item.name}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <UserCheck size={11} className="shrink-0" />
                          <span>{item.responsible || '—'}</span>
                        </div>
                        {item.terminalId && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Shield size={11} className="shrink-0" />
                            <span>{data.terminals.find(t => t.id === item.terminalId)?.name || '—'}</span>
                          </div>
                        )}
                        {item.area && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <FileText size={11} className="shrink-0" />
                            <span>{item.area}</span>
                          </div>
                        )}
                        {item.verificationDate && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <CheckCircle2 size={11} className="shrink-0" />
                            <span>Verificado: <strong className="text-foreground">{fmtDate(item.verificationDate)}</strong></span>
                          </div>
                        )}
                        {item.expiryDate && (
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <Clock size={11} className="shrink-0 text-muted-foreground" />
                            <span className={isOverdue ? 'text-primary font-bold' : isSoon ? 'text-warning font-bold' : 'text-muted-foreground'}>
                              Validade: {fmtDate(item.expiryDate)}
                            </span>
                          </div>
                        )}
                        {linkedUser && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Shield size={11} className="shrink-0" />
                            <span>{linkedUser.name}</span>
                          </div>
                        )}
                      </div>

                      {item.notes && <p className="text-[10px] text-muted-foreground">{item.notes}</p>}

                      {/* Quick status change + Corrigir */}
                      <div className="flex gap-1 mt-2 items-center">
                        {(['conforme', 'atencao', 'nao_conforme'] as ComplianceStatus[]).map(s => {
                          const c = STATUS_CONFIG[COMPLIANCE_STATUS_MAP[s]];
                          return (
                            <button
                              key={s}
                              onClick={() => updateItemStatus(item.id, s)}
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all ${item.status === s ? `${c.bg} ${c.color} border-current` : 'bg-secondary/50 text-muted-foreground border-transparent hover:border-border'}`}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                        {isNonConform && (
                          <button onClick={() => correctItem(item.id)} className="ml-2 px-2.5 py-0.5 bg-success/10 text-success text-[9px] font-bold rounded-full hover:bg-success/20 transition-colors flex items-center gap-1">
                            <CheckCircle2 size={10} /> Corrigir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManage(user) && (
                    <button onClick={() => removeItem(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
