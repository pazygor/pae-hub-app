import { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Training } from '@/lib/types';
import { canManage, isTerminalLocked } from '@/lib/access-control';
import { terminalHasSafetySub, appliesToUser } from '@/lib/modules';
import { MultiSelect } from '@/components/ui/multi-select';
import { useTrainings, useTrainingAssignments, useTrainingMutations, useUsers, useTerminals, usePermissions } from '@/api';
import {
  GraduationCap, Plus, Trash2, CheckCircle, AlertTriangle, Clock, X, Users, UserPlus,
  Filter, Search, ChevronDown, ChevronUp, CalendarDays, Shield, FileText, Award,
  Video, Upload, ExternalLink, Paperclip, CheckSquare2, Loader2, Pencil
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { PieTooltipContent } from '@/components/common/PieTooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AssignUsersModal } from '../components/AssignUsersModal';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

const COLORS = {
  valid: 'hsl(142, 71%, 45%)',
  soon: 'hsl(38, 92%, 50%)',
  expired: 'hsl(0, 72%, 51%)',
};

const now = new Date();
const soonDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

type TrainingStatus = 'valid' | 'soon' | 'expired' | 'pending';

function getStatus(expiryDate: string): TrainingStatus {
  const d = new Date(expiryDate);
  if (d < now) return 'expired';
  if (d <= soonDate) return 'soon';
  return 'valid';
}

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR'); }
function daysUntil(iso: string) { return Math.ceil((new Date(iso).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)); }

function statusBadge(status: TrainingStatus) {
  switch (status) {
    case 'expired': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/15 text-primary border border-primary/30">VENCIDO</span>;
    case 'soon': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-warning/15 text-warning border border-warning/30">ATENÇÃO</span>;
    case 'valid': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-success/15 text-success border border-success/30">CONCLUÍDO</span>;
    case 'pending': return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border">PENDENTE</span>;
  }
}

function statusBarColor(status: TrainingStatus) {
  switch (status) {
    case 'expired': return 'bg-primary';
    case 'soon': return 'bg-warning';
    case 'valid': return 'bg-success';
    case 'pending': return 'bg-muted-foreground';
  }
}

export function TrainingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: trainings = [] } = useTrainings();
  const { data: userTrainings = [] } = useTrainingAssignments();
  const { data: users = [] } = useUsers();
  const { data: terminals = [] } = useTerminals();
  const { data: permissions = [] } = usePermissions();
  const { create, update, remove: removeTrainingMut, assign, removeAssignment } = useTrainingMutations();
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');
  const [showForm, setShowForm] = useState(false);
  // null = cadastrando; id = editando o treinamento correspondente.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [blockedTraining, setBlockedTraining] = useState<Training | null>(null);
  // O formulário fica no topo: ao abrir (sobretudo ao editar um card lá embaixo)
  // levamos o usuário até ele, senão parece que o clique não fez nada.
  const formRef = useRef<HTMLDivElement>(null);
  const [showAssignForm, setShowAssignForm] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'user' | 'training'>('training');
  const [form, setForm] = useState({ name: '', description: '', mandatory: false, materialFileName: '', videoUrl: '', terminalIds: [] as string[] });
  const [formError, setFormError] = useState('');
  const [batchAssign, setBatchAssign] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ userId: '', completedDate: '', expiryDate: '', certificate: '' });

  // Terminal isolation (fonte: API)
  const visibleTerminalIds = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return terminals.map(t => t.id);
    if (user.role === 'terminal') return user.linkId ? [user.linkId] : [];
    if (user.role === 'entity') return permissions.find(p => p.entityId === user.linkId)?.terminalIds || [];
    return [];
  }, [user, terminals, permissions]);
  const terminalLocked = isTerminalLocked(user);
  // "Global" (org-wide) só para admin; não-admin cria no(s) próprio(s) terminal(is) (default = casa).
  const isAdminUser = user?.role === 'admin';
  const defaultTerminalIds = isAdminUser ? [] : (user?.linkId ? [user.linkId] : []);

  // Filters — auto-lock terminal for non-admin users
  const [filterTerminal, setFilterTerminal] = useState('all');
  const effectiveTerminalFilter = terminalLocked && visibleTerminalIds.length === 1 ? visibleTerminalIds[0] : filterTerminal;

  // Catálogo visível. Treinamento com `terminalIds` vazio é global (vale para
  // todos), por isso aparece em qualquer terminal. Isolamento por terminal —
  // base de TODOS os indicadores, para o card nunca contar o que a tela não mostra.
  const scopedTrainings = useMemo(
    () => trainings.filter(t => {
      const ids = t.terminalIds ?? [];
      return ids.length === 0 || ids.some(id => visibleTerminalIds.includes(id));
    }),
    [trainings, visibleTerminalIds],
  );
  // Usuários lotados nos terminais visíveis. Exclui admin (sem terminal) e
  // usuários de entidade, cujo linkId aponta para a entidade e não para um terminal.
  const scopedUsers = useMemo(
    () => users.filter(u => !!u.linkId && visibleTerminalIds.includes(u.linkId)),
    [users, visibleTerminalIds],
  );
  const [filterStatus, setFilterStatus] = useState<'all' | TrainingStatus>('all');
  const [filterMandatory, setFilterMandatory] = useState<'all' | 'yes' | 'no'>('all');
  const [searchUser, setSearchUser] = useState('');
  const activeFilterCount = [searchUser, filterStatus !== 'all', filterMandatory !== 'all', filterTerminal !== 'all'].filter(Boolean).length;

  // Catálogo do nível 2 (isolamento) + os filtros da tela — é o que a lista mostra.
  const filteredTrainings = useMemo(
    () => scopedTrainings.filter(t => {
      if (filterMandatory !== 'all' && (filterMandatory === 'yes' ? !t.mandatory : t.mandatory)) return false;
      if (effectiveTerminalFilter === 'all') return true;
      const ids = t.terminalIds ?? [];
      return ids.length === 0 || ids.includes(effectiveTerminalFilter);
    }),
    [scopedTrainings, filterMandatory, effectiveTerminalFilter],
  );

  // Classified — scoped to visible terminals
  const classified = useMemo(() => {
    return userTrainings.map(ut => {
      const u = users.find(u => u.id === ut.userId);
      const training = trainings.find(t => t.id === ut.trainingId);
      return { ...ut, status: getStatus(ut.expiryDate), user: u, training };
    }).filter(ut => {
      if (!ut.user) return false;
      return visibleTerminalIds.includes(ut.user.linkId || '');
    });
  }, [userTrainings, users, trainings, visibleTerminalIds]);

  // Filtered
  const filteredAssignments = useMemo(() => {
    return classified.filter(ut => {
      if (filterStatus !== 'all' && ut.status !== filterStatus) return false;
      if (effectiveTerminalFilter !== 'all' && ut.user?.linkId !== effectiveTerminalFilter) return false;
      if (filterMandatory === 'yes' && !ut.training?.mandatory) return false;
      if (filterMandatory === 'no' && ut.training?.mandatory) return false;
      if (searchUser && ut.user && !ut.user.name.toLowerCase().includes(searchUser.toLowerCase())) return false;
      return true;
    });
  }, [classified, filterStatus, effectiveTerminalFilter, filterMandatory, searchUser]);

  const validCount = classified.filter(c => c.status === 'valid').length;
  const soonCount = classified.filter(c => c.status === 'soon').length;
  const expiredCount = classified.filter(c => c.status === 'expired').length;

  // Pending: mandatory trainings not assigned to any user or expired
  const pendingCount = useMemo(() => {
    let count = 0;
    // Só o catálogo e os usuários que este usuário enxerga — e, para cada um,
    // apenas os obrigatórios que se aplicam ao terminal dele.
    for (const u of scopedUsers) {
      for (const t of scopedTrainings.filter(t => t.mandatory && appliesToUser(t, u))) {
        const has = userTrainings.some(ut => ut.userId === u.id && ut.trainingId === t.id && getStatus(ut.expiryDate) !== 'expired');
        if (!has) count++;
      }
    }
    return count;
  }, [scopedTrainings, scopedUsers, userTrainings]);

  // Charts
  // A cor vai em `fill`: é dela que o recharts monta o payload da legenda do <Pie>.
  const donutData = [
    { name: 'Em dia', value: validCount, fill: COLORS.valid },
    { name: 'Atenção', value: soonCount, fill: COLORS.soon },
    { name: 'Vencidos', value: expiredCount, fill: COLORS.expired },
  ].filter(d => d.value > 0);

  // Só terminais visíveis: senão o gráfico exibe o nome de terminais que o
  // usuário não pode ver (com as barras zeradas, mas o rótulo vaza).
  const barData = terminals.filter(t => visibleTerminalIds.includes(t.id)).map(t => {
    const tUsers = users.filter(u => u.linkId === t.id).map(u => u.id);
    const tClassified = classified.filter(c => tUsers.includes(c.userId));
    return {
      name: t.name.length > 14 ? t.name.substring(0, 14) + '…' : t.name,
      'Em dia': tClassified.filter(c => c.status === 'valid').length,
      'Atenção': tClassified.filter(c => c.status === 'soon').length,
      'Vencidos': tClassified.filter(c => c.status === 'expired').length,
    };
  });

  const hasChartData = classified.length > 0;

  // User-centric grouping
  const userGroups = useMemo(() => {
    const map = new Map<string, typeof filteredAssignments>();
    for (const a of filteredAssignments) {
      const key = a.userId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries())
      .map(([userId, items]) => {
        const u = users.find(u => u.id === userId);
        // Obrigatórios QUE SE APLICAM a este usuário — um treinamento de outro
        // terminal não é pendência dele.
        const mandatoryForUser = u
          ? scopedTrainings.filter(t => t.mandatory && appliesToUser(t, u))
          : [];
        const completedMandatory = mandatoryForUser.filter(t =>
          items.some(i => i.trainingId === t.id && i.status !== 'expired')
        ).length;
        const pendingTrainings = mandatoryForUser.filter(t =>
          !userTrainings.some(ut => ut.userId === userId && ut.trainingId === t.id && getStatus(ut.expiryDate) !== 'expired')
        );
        return {
          userId, user: u, items,
          hasExpired: items.some(i => i.status === 'expired'),
          hasSoon: items.some(i => i.status === 'soon'),
          mandatoryTotal: mandatoryForUser.length,
          mandatoryCompleted: completedMandatory,
          pendingTrainings,
        };
      })
      .sort((a, b) => {
        if (a.hasExpired !== b.hasExpired) return a.hasExpired ? -1 : 1;
        if (a.hasSoon !== b.hasSoon) return a.hasSoon ? -1 : 1;
        return (a.user?.name || '').localeCompare(b.user?.name || '');
      });
  }, [filteredAssignments, users, scopedTrainings, userTrainings]);

  // Also include users with NO assignments but with pending mandatory trainings
  const allUserGroups = useMemo(() => {
    const existingUserIds = new Set(userGroups.map(g => g.userId));

    // Parte de `scopedUsers`: só usuários lotados nos terminais visíveis. Isso já
    // exclui admin (sem terminal) e usuários de entidade (linkId aponta para a
    // entidade). Quem não tem obrigatório aplicável não entra na lista.
    const additionalUsers = scopedUsers
      .filter(u => !existingUserIds.has(u.id))
      .filter(u => {
        if (filterTerminal !== 'all' && u.linkId !== filterTerminal) return false;
        if (searchUser && !u.name.toLowerCase().includes(searchUser.toLowerCase())) return false;
        return true;
      })
      .map(u => {
        const mandatoryForUser = scopedTrainings.filter(t => t.mandatory && appliesToUser(t, u));
        const pendingTrainings = mandatoryForUser.filter(t =>
          !userTrainings.some(ut => ut.userId === u.id && ut.trainingId === t.id && getStatus(ut.expiryDate) !== 'expired')
        );
        if (pendingTrainings.length === 0) return null;
        return {
          userId: u.id, user: u, items: [] as typeof filteredAssignments,
          hasExpired: false, hasSoon: false,
          mandatoryTotal: mandatoryForUser.length, mandatoryCompleted: 0,
          pendingTrainings,
        };
      })
      .filter(Boolean) as typeof userGroups;

    return [...userGroups, ...additionalUsers];
  }, [userGroups, scopedUsers, scopedTrainings, userTrainings, filterTerminal, searchUser]);

  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm, editingId]);

  // Um treinamento é editável enquanto pelo menos UM dos seus terminais tiver o
  // módulo (global sempre editável). Se todos perderam, o registro está órfão e
  // fica só-leitura até o módulo ser reativado. Espelha o back.
  const trainingIsEditable = (t: Training) => {
    const ids = t.terminalIds ?? [];
    if (ids.length === 0) return true;
    return ids.some(id => {
      const term = terminals.find(x => x.id === id);
      return term ? terminalHasSafetySub(term, 'trainings') : false;
    });
  };
  const blockedTerminalNames = (blockedTraining?.terminalIds ?? [])
    .map(id => terminals.find(t => t.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  // Atribuição: só usuários dos terminais a que o treinamento se aplica
  // (global = todos os terminais visíveis).
  const assignScope = useMemo(() => {
    const training = trainings.find(t => t.id === batchAssign);
    const ids = training?.terminalIds ?? [];
    const scopeIds = !training
      ? []
      : ids.length === 0
        ? visibleTerminalIds
        : ids.filter(id => visibleTerminalIds.includes(id));
    return {
      isGlobal: !!training && ids.length === 0,
      users: users.filter(u => !!u.linkId && scopeIds.includes(u.linkId)),
      terminals: terminals.filter(t => scopeIds.includes(t.id)),
    };
  }, [batchAssign, trainings, users, terminals, visibleTerminalIds]);

  // Actions
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError('');
    setForm({ name: '', description: '', mandatory: false, materialFileName: '', videoUrl: '', terminalIds: defaultTerminalIds });
  };

  const startCreate = () => {
    setEditingId(null);
    setFormError('');
    setForm({ name: '', description: '', mandatory: false, materialFileName: '', videoUrl: '', terminalIds: defaultTerminalIds });
    setShowForm(true);
  };

  const startEdit = (t: Training) => {
    setEditingId(t.id);
    setFormError('');
    setForm({
      name: t.name,
      description: t.description ?? '',
      mandatory: t.mandatory,
      materialFileName: t.materialFileName ?? '',
      videoUrl: t.videoUrl ?? '',
      terminalIds: t.terminalIds ?? [],
    });
    setShowForm(true);
  };

  const saveTraining = () => {
    if (!form.name) { setFormError('Informe o nome do treinamento.'); return; }
    if (!isAdminUser && form.terminalIds.length === 0) { setFormError('Selecione ao menos um terminal.'); return; }
    setFormError('');
    const input = {
      name: form.name, description: form.description, mandatory: form.mandatory,
      materialFileName: form.materialFileName || undefined,
      videoUrl: form.videoUrl || undefined,
      terminalIds: form.terminalIds,
    };
    if (editingId) {
      update.mutate({ id: editingId, input }, {
        onSuccess: () => { closeForm(); toast.success('Treinamento atualizado'); },
        onError,
      });
      return;
    }
    create.mutate(
      input,
      {
        onSuccess: () => {
          setForm({ name: '', description: '', mandatory: false, materialFileName: '', videoUrl: '', terminalIds: defaultTerminalIds });
          setShowForm(false);
          toast.success('Treinamento criado');
        },
        onError,
      },
    );
  };

  // Batch assign — o back aplica defaults (hoje / +1 ano) e pula atribuições vigentes
  const batchAssignTraining = (trainingId: string, userIds: string[]) => {
    if (userIds.length === 0) return;
    assign.mutate({ id: trainingId, input: { userIds } }, {
      onSuccess: () => { setBatchAssign(null); toast.success('Treinamento atribuído'); },
      onError,
    });
  };


  const removeTraining = (id: string) => {
    if (!confirm('Remover este treinamento e suas atribuições?')) return;
    removeTrainingMut.mutate(id, { onSuccess: () => toast.success('Treinamento removido'), onError });
  };

  const assignTraining = (trainingId: string) => {
    if (!assignForm.userId || !assignForm.completedDate || !assignForm.expiryDate) return;
    assign.mutate(
      {
        id: trainingId,
        input: {
          userIds: [assignForm.userId],
          completedDate: assignForm.completedDate, expiryDate: assignForm.expiryDate,
          certificate: assignForm.certificate || undefined,
        },
      },
      {
        onSuccess: () => {
          setAssignForm({ userId: '', completedDate: '', expiryDate: '', certificate: '' });
          setShowAssignForm(null);
        },
        onError,
      },
    );
  };

  const removeUserTraining = (id: string) => {
    removeAssignment.mutate(id, { onError });
  };

  // Quick completion: o back aplica hoje / +1 ano
  const quickComplete = (trainingId: string, userId: string) => {
    assign.mutate({ id: trainingId, input: { userIds: [userId] } }, { onError });
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
            <GraduationCap size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Gestão de Treinamentos</h1>
            <p className="text-xs text-muted-foreground">Biblioteca do terminal — atribua treinamentos aos usuários para delegação</p>
          </div>
        </div>
        {userCanManage && (
          <button onClick={startCreate} className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            <Plus size={14} /> Novo Treinamento
          </button>
        )}
      </div>

      {/* Add Training Form */}
      {showForm && (
        <div ref={formRef} className="bg-card border border-border rounded-xl p-4 space-y-4 scroll-mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">{editingId ? 'Editar Treinamento' : 'Cadastrar Novo Treinamento'}</h3>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome *</label>
              <input placeholder="Nome do treinamento" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Terminais</label>
              {/* Multi-terminal (registro compartilhado). Item 6: só terminais com o módulo —
                  mais os já vinculados, senão o vínculo ficaria invisível na edição e a tela
                  mostraria "Global" por engano. */}
              <MultiSelect
                options={terminals
                  .filter(t => terminalHasSafetySub(t, 'trainings') || form.terminalIds.includes(t.id))
                  .map(t => ({
                    value: t.id,
                    label: terminalHasSafetySub(t, 'trainings') ? t.name : `${t.name} (módulo inativo)`,
                  }))}
                selected={form.terminalIds}
                onChange={ids => setForm(f => ({ ...f, terminalIds: ids }))}
                placeholder={isAdminUser ? 'Global (todos os terminais)' : 'Selecione o(s) terminal(is)...'}
                searchPlaceholder="Buscar terminal..."
                emptyText="Nenhum terminal com o módulo Treinamentos."
              />
              {isAdminUser && <p className="text-[10px] text-muted-foreground">Vazio = todos os terminais (global).</p>}
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer h-10 px-3">
                <input type="checkbox" checked={form.mandatory} onChange={e => setForm(f => ({ ...f, mandatory: e.target.checked }))} className="rounded border-input" />
                Obrigatório
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Descrição</label>
            <textarea placeholder="Descrição do treinamento..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground min-h-[70px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <Paperclip size={10} className="inline mr-1" />Material <span className="text-muted-foreground/60 normal-case font-normal">(PDF, PPT)</span>
              </label>
              <div className="flex gap-2">
                <input placeholder="Nome do arquivo (ex: manual.pdf)" value={form.materialFileName} onChange={e => setForm(f => ({ ...f, materialFileName: e.target.value }))}
                  className="flex-1 h-10 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background" />
                <button type="button" className="h-10 px-3 bg-secondary text-secondary-foreground text-xs font-bold rounded-md hover:bg-secondary/80 flex items-center gap-1 cursor-pointer transition-colors">
                  <Upload size={12} /> Upload
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <Video size={10} className="inline mr-1" />Link de Vídeo
              </label>
              <input placeholder="https://youtube.com/..." value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Após salvar, use o botão <strong>"Atribuir a Usuários"</strong> para delegar a usuários específicos.</p>
          {formError && <p className="text-xs text-primary font-bold">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={saveTraining} disabled={create.isPending || update.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-60 flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity">
              {(create.isPending || update.isPending) && <Loader2 size={12} className="animate-spin" />} {editingId ? 'Salvar alterações' : 'Salvar Treinamento'}
            </button>
            <button onClick={closeForm} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total</p>
          <p className="text-xl font-mono font-bold text-foreground">{scopedTrainings.length}</p>
          <p className="text-[10px] text-muted-foreground">{scopedTrainings.filter(t => t.mandatory).length} obrigatórios</p>
        </div>
        <div className="bg-card border border-success/20 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Concluídos</p>
          <p className="text-xl font-mono font-bold text-success">{validCount}</p>
          <p className="text-[10px] text-muted-foreground">somando todos os usuários</p>
        </div>
        <div className="bg-card border border-warning/20 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Atenção</p>
          <p className="text-xl font-mono font-bold text-warning">{soonCount}</p>
        </div>
        <div className="bg-card border border-primary/20 rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Vencidos</p>
          <p className="text-xl font-mono font-bold text-primary">{expiredCount}</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Pendentes</p>
          <p className="text-xl font-mono font-bold text-muted-foreground">{pendingCount}</p>
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
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<PieTooltipContent />} />
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
                  <Bar dataKey="Em dia" stackId="a" fill={COLORS.valid} />
                  <Bar dataKey="Atenção" stackId="a" fill={COLORS.soon} />
                  <Bar dataKey="Vencidos" stackId="a" fill={COLORS.expired} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Filtros</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setViewMode('user')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
              <Users size={12} className="inline mr-1" />Por Usuário
            </button>
            <button onClick={() => setViewMode('training')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'training' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
              <GraduationCap size={12} className="inline mr-1" />Por Treinamento
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Usuário</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar usuário..." value={searchUser} onChange={e => setSearchUser(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-xs text-foreground placeholder:text-muted-foreground h-9 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Status</label>
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as 'all' | TrainingStatus)}>
              <SelectTrigger className="cursor-pointer text-xs h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">Todos os status</SelectItem>
                <SelectItem value="valid" className="cursor-pointer">Em dia</SelectItem>
                <SelectItem value="soon" className="cursor-pointer">Atenção</SelectItem>
                <SelectItem value="expired" className="cursor-pointer">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Tipo</label>
            <Select value={filterMandatory} onValueChange={v => setFilterMandatory(v as 'all' | 'yes' | 'no')}>
              <SelectTrigger className="cursor-pointer text-xs h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">Todos os tipos</SelectItem>
                <SelectItem value="yes" className="cursor-pointer">Obrigatórios</SelectItem>
                <SelectItem value="no" className="cursor-pointer">Opcionais</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!terminalLocked && (
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
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.valid }} /> {validCount}</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.soon }} /> {soonCount}</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.expired }} /> {expiredCount}</span>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => { setSearchUser(''); setFilterStatus('all'); setFilterMandatory('all'); setFilterTerminal('all'); }} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">Limpar filtros</button>
          )}
        </div>
      </div>

      {/* ===== USER VIEW ===== */}
      {viewMode === 'user' && (
        <div className="space-y-3">
          {allUserGroups.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum resultado encontrado.</div>
          )}
          {allUserGroups.map(({ userId, user: u, items, hasExpired, hasSoon, mandatoryTotal, mandatoryCompleted, pendingTrainings }) => {
            const isExpanded = expandedUser === userId;
            const terminal = u?.linkId ? terminals.find(t => t.id === u.linkId) : null;
            const expCount = items.filter(i => i.status === 'expired').length;
            const soonC = items.filter(i => i.status === 'soon').length;

            return (
              <div key={userId} className={`bg-card border rounded-xl overflow-hidden transition-all ${hasExpired ? 'border-primary/30' : hasSoon ? 'border-warning/30' : ''}`}>
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
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{items.length} treinamento(s)</span>
                      <span className="text-[10px] text-muted-foreground">Obrigatórios: <strong className={mandatoryCompleted === mandatoryTotal ? 'text-success' : 'text-primary'}>{mandatoryCompleted}/{mandatoryTotal}</strong></span>
                      {expCount > 0 && <span className="text-[10px] text-primary font-bold">⚠ {expCount} vencido(s)</span>}
                      {soonC > 0 && <span className="text-[10px] text-warning font-bold">⏰ {soonC} atenção</span>}
                      {pendingTrainings.length > 0 && <span className="text-[10px] text-muted-foreground font-bold">📋 {pendingTrainings.length} pendente(s)</span>}
                    </div>
                  </div>
                  {/* Mini status bar */}
                  <div className="flex gap-0.5 h-2 w-20 rounded-full overflow-hidden bg-secondary shrink-0">
                    {items.map((item, i) => (
                      <div key={i} className={`flex-1 ${statusBarColor(item.status)}`} />
                    ))}
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t divide-y divide-border">
                    {items.map(ut => {
                      const training = ut.training;
                      if (!training) return null;
                      const days = daysUntil(ut.expiryDate);

                      return (
                        <div key={ut.id} className={`px-5 py-4 ${ut.status === 'expired' ? 'bg-primary/5' : ut.status === 'soon' ? 'bg-warning/5' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold text-foreground">{training.name}</span>
                                {training.mandatory && <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-bold">OBRIGATÓRIO</span>}
                                {statusBadge(ut.status)}
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-1">{training.description}</p>
                              {/* Material do treinamento */}
                              {(training.materialFileName || training.videoUrl) && (
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  {training.materialFileName && (
                                    <button className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                                      <FileText size={10} /> {training.materialFileName}
                                    </button>
                                  )}
                                  {training.videoUrl && (
                                    <a href={training.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-accent text-accent-foreground rounded-lg hover:brightness-110 transition-colors">
                                      <Video size={10} /> Vídeo <ExternalLink size={8} />
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Details */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <CheckCircle size={11} className="shrink-0" />
                                  <span>Realizado: <strong className="text-foreground">{fmtDate(ut.completedDate)}</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <Clock size={11} className="shrink-0" />
                                  <span>Vence: <strong className={ut.status === 'expired' ? 'text-primary' : ut.status === 'soon' ? 'text-warning' : 'text-foreground'}>{fmtDate(ut.expiryDate)}</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <Shield size={11} className="shrink-0 text-muted-foreground" />
                                  <span className={days < 0 ? 'text-primary font-bold' : days <= 30 ? 'text-warning font-bold' : 'text-muted-foreground'}>
                                    {days < 0 ? `Vencido há ${Math.abs(days)} dias` : `${days} dias restantes`}
                                  </span>
                                </div>
                                {ut.certificate && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Award size={11} className="shrink-0" />
                                    <span>Certificado: <strong className="text-foreground">{ut.certificate}</strong></span>
                                  </div>
                                )}
                              </div>

                              {/* Timeline */}
                              <div className="border-l-2 border-border pl-3 ml-1 space-y-2">
                                <div className="flex items-center gap-2 text-[10px]">
                                  <div className="w-4 h-4 rounded-full flex items-center justify-center -ml-[21px] bg-card border border-border">
                                    <CheckCircle size={9} className="text-success" />
                                  </div>
                                  <span className="text-muted-foreground">{fmtDate(ut.completedDate)}</span>
                                  <span className="text-foreground">Treinamento realizado</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <div className="w-4 h-4 rounded-full flex items-center justify-center -ml-[21px] bg-card border border-border">
                                    <CalendarDays size={9} className={ut.status === 'expired' ? 'text-primary' : 'text-muted-foreground'} />
                                  </div>
                                  <span className="text-muted-foreground">{fmtDate(ut.expiryDate)}</span>
                                  <span className={ut.status === 'expired' ? 'text-primary font-bold' : 'text-foreground'}>
                                    {ut.status === 'expired' ? 'Treinamento venceu' : 'Vencimento previsto'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button onClick={() => removeUserTraining(ut.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pending mandatory trainings */}
                    {pendingTrainings.length > 0 && (
                      <div className="px-5 py-3 bg-muted/30">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Treinamentos Pendentes</p>
                        <div className="space-y-2">
                          {pendingTrainings.map(t => (
                            <div key={t.id} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <GraduationCap size={12} className="text-muted-foreground shrink-0" />
                                <span className="text-xs text-foreground">{t.name}</span>
                                {statusBadge('pending')}
                                {t.mandatory && <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-bold">OBRIGATÓRIO</span>}
                              </div>
                              {userCanManage && (
                                <button
                                  onClick={() => quickComplete(t.id, userId)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-success bg-success/10 rounded-lg hover:bg-success/20 transition-colors shrink-0"
                                >
                                  <CheckCircle size={11} /> Marcar Concluído
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== TRAINING VIEW ===== */}
      {viewMode === 'training' && (
        <div className="space-y-4">
          {filteredTrainings
            .map(training => {
              const assignments = filteredAssignments.filter(a => a.trainingId === training.id);
              const expCount = assignments.filter(a => a.status === 'expired').length;

              return (
                <div key={training.id} className="bg-card border rounded-xl overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                      <GraduationCap size={16} className="text-primary shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{training.name}</span>
                          {training.mandatory && <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-bold">OBRIGATÓRIO</span>}
                          {(training.terminalIds ?? []).map(id => { const t = terminals.find(t => t.id === id); return t ? <span key={id} className="text-[9px] px-1.5 py-0.5 bg-accent text-accent-foreground rounded font-bold">{t.name}</span> : null; })}
                          {(training.terminalIds ?? []).length === 0 && <span className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded font-bold">GLOBAL</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{training.description}</p>
                        {(training.materialFileName || training.videoUrl) && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {training.materialFileName && (
                              <button className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                                <FileText size={10} /> {training.materialFileName}
                              </button>
                            )}
                            {training.videoUrl && (
                              <a href={training.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-accent text-accent-foreground rounded-lg hover:brightness-110 transition-colors">
                                <Video size={10} /> Assistir Vídeo <ExternalLink size={8} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {expCount > 0 && <span className="flex items-center gap-1 text-[10px] text-primary font-bold"><AlertTriangle size={12} /> {expCount}</span>}
                      {userCanManage && (
                        <button onClick={() => setBatchAssign(training.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors" title="Atribuir a usuários">
                          <UserPlus size={12} /> Atribuir a Usuários
                        </button>
                      )}
                      {userCanManage && (
                        <button
                          onClick={() => (trainingIsEditable(training) ? startEdit(training) : setBlockedTraining(training))}
                          title={trainingIsEditable(training) ? 'Editar treinamento' : 'Edição indisponível — módulo inativo no terminal'}
                          className={`p-1.5 rounded-lg transition-colors ${trainingIsEditable(training)
                            ? 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                            : 'text-muted-foreground/40 hover:bg-secondary'}`}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {userCanManage && <button onClick={() => removeTraining(training.id)} title="Remover treinamento" className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 size={14} /></button>}
                    </div>
                  </div>

                  {assignments.length > 0 ? (
                    <div className="divide-y divide-border">
                      {assignments.map(ut => {
                        const u = ut.user;
                        const days = daysUntil(ut.expiryDate);
                        return (
                          <div key={ut.id} className={`px-5 py-3 flex items-center justify-between ${ut.status === 'expired' ? 'bg-primary/5' : ut.status === 'soon' ? 'bg-warning/5' : ''}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">{u?.name.charAt(0) || '?'}</div>
                              <div>
                                <span className="text-xs font-medium text-foreground">{u?.name || ut.userId}</span>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle size={10} /> {fmtDate(ut.completedDate)}</span>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock size={10} /> {fmtDate(ut.expiryDate)}</span>
                                  <span className={`text-[10px] ${days < 0 ? 'text-primary font-bold' : days <= 30 ? 'text-warning font-bold' : 'text-muted-foreground'}`}>
                                    {days < 0 ? `${Math.abs(days)}d atrás` : `${days}d restantes`}
                                  </span>
                                  {ut.certificate && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Award size={10} /> {ut.certificate}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {statusBadge(ut.status)}
                              {userCanManage && <button onClick={() => removeUserTraining(ut.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={12} /></button>}
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

          {filteredTrainings.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {scopedTrainings.length === 0
                ? 'Nenhum treinamento cadastrado.'
                : 'Nenhum treinamento corresponde aos filtros aplicados.'}
            </div>
          )}
        </div>
      )}

      {/* Edição bloqueada: nenhum terminal do treinamento tem mais o módulo (registro órfão). */}
      <AlertDialog open={!!blockedTraining} onOpenChange={open => { if (!open) setBlockedTraining(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="p-1.5 bg-warning/10 rounded-lg"><Shield size={16} className="text-warning" /></span>
              Edição indisponível
            </AlertDialogTitle>
            <AlertDialogDescription>
              O treinamento <strong className="text-foreground font-semibold">{blockedTraining?.name}</strong> pertence
              {blockedTerminalNames ? <> a <strong className="text-foreground font-semibold">{blockedTerminalNames}</strong></> : ' a um terminal'},
              que não tem mais o módulo <strong className="text-foreground font-semibold">Treinamentos</strong> habilitado.
              O registro fica visível apenas para consulta.
              {isAdminUser
                ? ' Para voltar a editá-lo, reative o módulo Treinamentos desse terminal em Pacotes do Sistema.'
                : ' Para voltar a editá-lo, valide com o comercial a ativação do módulo de Treinamentos para esse terminal.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Fechar</AlertDialogCancel>
            {isAdminUser && (
              <AlertDialogAction
                onClick={() => navigate('/pacotes-do-sistema')}
                className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Ir para Pacotes do Sistema
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Users Modal */}
      {batchAssign && (
        <AssignUsersModal
          open={!!batchAssign}
          onClose={() => setBatchAssign(null)}
          title={`Atribuir Treinamento`}
          description={`Selecione os usuários que receberão o treinamento "${trainings.find(t => t.id === batchAssign)?.name || ''}". ${
            assignScope.isGlobal
              ? 'Treinamento global — disponível para usuários de todos os terminais.'
              : `Apenas usuários de: ${assignScope.terminals.map(t => t.name).join(', ') || '—'}.`
          }`}
          confirmLabel="Confirmar Atribuição"
          users={assignScope.users}
          terminals={assignScope.terminals}
          alreadyAssignedIds={new Set(userTrainings.filter(ut => ut.trainingId === batchAssign).map(ut => ut.userId))}
          onConfirm={(userIds) => batchAssignTraining(batchAssign, userIds)}
        />
      )}
    </div>
  );
}
