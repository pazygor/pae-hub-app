import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppUser, AccessLevel } from '@/lib/types';
import { getVisibleUsers, isTerminalLocked } from '@/lib/access-control';
import { useUsers, useTerminals } from '@/api';
import {
  Network, User, ChevronDown, ChevronUp, Filter, AlertTriangle,
  GraduationCap, HardHat, ClipboardCheck, X, LinkIcon, Shield
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; ring: string }> = {
  'estratégico': { label: 'Estratégico', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', ring: 'ring-primary/20' },
  'tático': { label: 'Tático', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30', ring: 'ring-accent/20' },
  'operacional': { label: 'Operacional', color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', ring: 'ring-warning/20' },
};

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR'); }

interface UserPendencies {
  expiredTrainings: number;
  pendingTrainings: number;
  expiredEPIs: number;
  nonConformItems: number;
  total: number;
}

export function OrgChartPage() {
  const { user, data } = useAuth();
  const { data: users = [] } = useUsers();
  const { data: terminals = [] } = useTerminals();
  const visibleTerminalIds = useMemo(() => terminals.map(t => t.id), [terminals]);
  const terminalLocked = isTerminalLocked(user);
  const [filterTerminal, setFilterTerminal] = useState<string>('all');
  const effectiveTerminalFilter = terminalLocked && visibleTerminalIds.length === 1 ? visibleTerminalIds[0] : filterTerminal;
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const now = new Date();

  // Get visible users based on hierarchy (admin → todos), agora da API
  const allVisibleUsers = getVisibleUsers(user, users);

  // Filter by terminal
  const filteredUsers = useMemo(() => {
    return allVisibleUsers.filter(u => {
      if (u.role === 'admin') return true;
      if (effectiveTerminalFilter !== 'all' && u.linkId !== effectiveTerminalFilter) return false;
      return true;
    });
  }, [allVisibleUsers, filterTerminal]);

  // Calculate pendencies per user
  const getPendencies = (u: AppUser): UserPendencies => {
    const userTrainings = data.userTrainings.filter(ut => ut.userId === u.id);
    const mandatoryTrainings = data.trainings.filter(t => t.mandatory);
    const expiredTrainings = userTrainings.filter(ut => new Date(ut.expiryDate) < now).length;
    const pendingTrainings = mandatoryTrainings.filter(t =>
      !userTrainings.some(ut => ut.trainingId === t.id && new Date(ut.expiryDate) >= now)
    ).length;
    const userEPIs = data.userEPIs.filter(ue => ue.userId === u.id && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido');
    const expiredEPIs = userEPIs.filter(ue => ue.expiryDate && new Date(ue.expiryDate) < now).length;
    const nonConformItems = (data.complianceItems || []).filter(ci => ci.userId === u.id && ci.status === 'nao_conforme').length;
    return { expiredTrainings, pendingTrainings, expiredEPIs, nonConformItems, total: expiredTrainings + pendingTrainings + expiredEPIs + nonConformItems };
  };

  // Group by hierarchy
  const admins = filteredUsers.filter(u => u.role === 'admin');
  const estrategicos = filteredUsers.filter(u => u.accessLevel === 'estratégico' && u.role !== 'admin');
  const taticos = filteredUsers.filter(u => u.accessLevel === 'tático' && u.role !== 'admin');
  const operacionais = filteredUsers.filter(u => u.accessLevel === 'operacional' && u.role !== 'admin');
  const unassigned = filteredUsers.filter(u => u.role !== 'admin' && !u.accessLevel);

  // Build tree: Tático -> their Operacionais
  const taticoTree = taticos.map(t => ({
    user: t,
    pendencies: getPendencies(t),
    operacionais: operacionais
      .filter(o => o.tacticalManagerId === t.id)
      .map(o => ({ user: o, pendencies: getPendencies(o) })),
  }));

  // Unlinked operacionais (no tacticalManagerId or manager not visible)
  const linkedOperacionalIds = new Set(taticoTree.flatMap(t => t.operacionais.map(o => o.user.id)));
  const unlinkedOperacionais = operacionais
    .filter(o => !linkedOperacionalIds.has(o.id))
    .map(o => ({ user: o, pendencies: getPendencies(o) }));

  const getTerminalName = (u: AppUser) => terminals.find(t => t.id === u.linkId)?.name || '—';

  // Detail panel for expanded user
  const renderUserDetail = (u: AppUser) => {
    const userTrainings = data.userTrainings.filter(ut => ut.userId === u.id);
    const userEPIs = data.userEPIs.filter(ue => ue.userId === u.id && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido');
    const userCompliance = (data.complianceItems || []).filter(ci => ci.userId === u.id);

    return (
      <div className="mt-3 pt-3 border-t border-border space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
        {/* Trainings */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <GraduationCap size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Treinamentos</span>
          </div>
          {userTrainings.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhum treinamento atribuído</p>
          ) : (
            <div className="space-y-1">
              {userTrainings.map(ut => {
                const training = data.trainings.find(t => t.id === ut.trainingId);
                const expired = new Date(ut.expiryDate) < now;
                return (
                  <div key={ut.id} className={`flex items-center justify-between px-2 py-1 rounded text-[11px] ${expired ? 'bg-primary/5 text-primary' : 'bg-success/5 text-success'}`}>
                    <span className="truncate">{training?.name || ut.trainingId}</span>
                    <span className="shrink-0 ml-2 font-mono text-[10px]">
                      {expired ? 'Vencido' : `até ${fmtDate(ut.expiryDate)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* EPIs */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <HardHat size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">EPIs</span>
          </div>
          {userEPIs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhum EPI atribuído</p>
          ) : (
            <div className="space-y-1">
              {userEPIs.map(ue => {
                const epi = data.epis.find(e => e.id === ue.epiId);
                const expired = ue.expiryDate && new Date(ue.expiryDate) < now;
                return (
                  <div key={ue.id} className={`flex items-center justify-between px-2 py-1 rounded text-[11px] ${expired ? 'bg-primary/5 text-primary' : 'bg-success/5 text-success'}`}>
                    <span className="truncate">{epi?.name || ue.epiId}</span>
                    <span className="shrink-0 ml-2 font-mono text-[10px]">
                      {expired ? 'Vencido' : ue.expiryDate ? `até ${fmtDate(ue.expiryDate)}` : 'Sem validade'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Compliance */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ClipboardCheck size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Conformidade</span>
          </div>
          {userCompliance.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhum item de conformidade</p>
          ) : (
            <div className="space-y-1">
              {userCompliance.map(ci => (
                <div key={ci.id} className={`flex items-center justify-between px-2 py-1 rounded text-[11px] ${
                  ci.status === 'nao_conforme' ? 'bg-primary/5 text-primary' :
                  ci.status === 'atencao' ? 'bg-warning/5 text-warning' :
                  'bg-success/5 text-success'
                }`}>
                  <span className="truncate">{ci.name}</span>
                  <span className="shrink-0 ml-2 text-[10px] font-bold uppercase">
                    {ci.status === 'conforme' ? 'Conforme' : ci.status === 'atencao' ? 'Atenção' : 'Não Conforme'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUserCard = (u: AppUser, pendencies: UserPendencies, indent = false) => {
    const cfg = LEVEL_CONFIG[u.accessLevel || ''] || { label: u.role === 'admin' ? 'Admin' : 'Não definido', color: 'text-foreground', bg: 'bg-secondary', border: 'border-border', ring: 'ring-border' };
    const isExpanded = expandedUserId === u.id;
    const hasCritical = pendencies.total > 0;

    return (
      <div key={u.id} className={`${indent ? 'ml-8 md:ml-12' : ''}`}>
        <div className={`bg-card border ${cfg.border} rounded-xl overflow-hidden transition-all ${hasCritical ? `ring-2 ${cfg.ring}` : ''}`}>
          <button
            onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
            className="w-full p-4 text-left hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <User size={16} className={cfg.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[9px] text-muted-foreground">· {getTerminalName(u)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasCritical && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                    <AlertTriangle size={10} className="text-primary" />
                    <span className="text-[10px] font-bold text-primary">{pendencies.total}</span>
                  </div>
                )}
                {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </div>
            </div>

            {/* Pendency mini badges */}
            {hasCritical && !isExpanded && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {pendencies.expiredTrainings > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {pendencies.expiredTrainings} treino(s) vencido(s)
                  </span>
                )}
                {pendencies.pendingTrainings > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-bold">
                    {pendencies.pendingTrainings} treino(s) pendente(s)
                  </span>
                )}
                {pendencies.expiredEPIs > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {pendencies.expiredEPIs} EPI(s) vencido(s)
                  </span>
                )}
                {pendencies.nonConformItems > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {pendencies.nonConformItems} não conforme(s)
                  </span>
                )}
              </div>
            )}
          </button>

          {isExpanded && (
            <div className="px-4 pb-4">
              {renderUserDetail(u)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Connector line component
  const ConnectorLine = ({ label }: { label?: string }) => (
    <div className="flex items-center justify-center py-1">
      <div className="flex flex-col items-center">
        <div className="w-px h-4 bg-border" />
        {label && <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest px-2 py-0.5 bg-secondary rounded-full">{label}</span>}
        <div className="w-px h-4 bg-border" />
      </div>
    </div>
  );

  const totalPendencies = [...estrategicos, ...taticos, ...operacionais].reduce((sum, u) => sum + getPendencies(u).total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Network size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Organograma</h1>
            <p className="text-xs text-muted-foreground">Estrutura organizacional e hierarquia de usuários</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total</p>
          <p className="text-xl font-mono font-bold text-foreground">{filteredUsers.filter(u => u.role !== 'admin').length}</p>
        </div>
        <div className={`bg-card border ${LEVEL_CONFIG['estratégico'].border} rounded-xl p-3 text-center`}>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Estratégico</p>
          <p className={`text-xl font-mono font-bold ${LEVEL_CONFIG['estratégico'].color}`}>{estrategicos.length}</p>
        </div>
        <div className={`bg-card border ${LEVEL_CONFIG['tático'].border} rounded-xl p-3 text-center`}>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Tático</p>
          <p className={`text-xl font-mono font-bold ${LEVEL_CONFIG['tático'].color}`}>{taticos.length}</p>
        </div>
        <div className={`bg-card border ${LEVEL_CONFIG['operacional'].border} rounded-xl p-3 text-center`}>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Operacional</p>
          <p className={`text-xl font-mono font-bold ${LEVEL_CONFIG['operacional'].color}`}>{operacionais.length}</p>
        </div>
        <div className="bg-card border border-primary/20 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Pendências</p>
          <p className="text-xl font-mono font-bold text-primary">{totalPendencies}</p>
        </div>
      </div>

      {/* Filter — only show for admin */}
      {!terminalLocked && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Filtro</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Terminal</label>
              <Select value={filterTerminal} onValueChange={setFilterTerminal}>
                <SelectTrigger className="cursor-pointer text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">Todos os terminais</SelectItem>
                  {terminals.filter(t => visibleTerminalIds.includes(t.id)).map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filterTerminal !== 'all' && (
            <button onClick={() => setFilterTerminal('all')} className="mt-3 text-xs font-bold text-primary hover:text-primary/80 transition-colors">Limpar filtros</button>
          )}
        </div>
      )}

      {/* Org Tree */}
      <div className="space-y-1">
        {/* Admin level */}
        {admins.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Shield size={12} className="text-foreground" />
              <span className="text-[10px] font-bold text-foreground uppercase tracking-widest">Administração M1</span>
            </div>
            {admins.map(a => renderUserCard(a, getPendencies(a)))}
          </div>
        )}

        {/* Estratégico level */}
        {estrategicos.length > 0 && (
          <>
            <ConnectorLine label="Estratégico" />
            <div className="space-y-2">
              {estrategicos.map(e => renderUserCard(e, getPendencies(e)))}
            </div>
          </>
        )}

        {/* Tático level with their Operacionais */}
        {taticoTree.length > 0 && (
          <>
            <ConnectorLine label="Tático" />
            <div className="space-y-4">
              {taticoTree.map(tt => (
                <div key={tt.user.id} className="space-y-1">
                  {renderUserCard(tt.user, tt.pendencies)}
                  {tt.operacionais.length > 0 && (
                    <div className="space-y-1">
                      <div className="ml-8 md:ml-12 flex items-center gap-1.5 py-1">
                        <div className="w-4 border-t border-border" />
                        <LinkIcon size={10} className="text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Operacionais vinculados</span>
                      </div>
                      {tt.operacionais.map(op => renderUserCard(op.user, op.pendencies, true))}
                    </div>
                  )}
                  {tt.operacionais.length === 0 && (
                    <div className="ml-8 md:ml-12 py-2 px-3 rounded-lg bg-warning/5 border border-warning/20">
                      <p className="text-[11px] text-warning font-medium flex items-center gap-1.5">
                        <AlertTriangle size={12} />
                        Nenhum operacional vinculado a este gestor
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Unlinked Operacionais */}
        {unlinkedOperacionais.length > 0 && (
          <>
            <ConnectorLine />
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle size={12} className="text-warning" />
                <span className="text-[10px] font-bold text-warning uppercase tracking-widest">Operacionais sem vínculo</span>
              </div>
              {unlinkedOperacionais.map(op => renderUserCard(op.user, op.pendencies))}
            </div>
          </>
        )}

        {/* Users without access level */}
        {unassigned.length > 0 && (
          <>
            <ConnectorLine />
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle size={12} className="text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sem nível definido</span>
              </div>
              {unassigned.map(u => renderUserCard(u, getPendencies(u)))}
            </div>
          </>
        )}

        {filteredUsers.filter(u => u.role !== 'admin').length === 0 && (
          <div className="bg-card border rounded-xl p-8 text-center">
            <Network size={32} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado para o filtro selecionado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
