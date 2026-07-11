import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { EmergencyPlan, PlanStatus } from '@/lib/types';
import { Plus, FileText, Trash2, CheckSquare, Square, Loader2, Pencil } from 'lucide-react';
import { usePlans, usePlanMutations, useTerminals, useUsers } from '@/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const STATUS_OPTIONS: { value: PlanStatus; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'em revisão', label: 'Em Revisão' },
];

export function PlansPage() {
  const { user } = useAuth();
  const { data: plans = [], isLoading, isError } = usePlans();
  const { data: terminals = [] } = useTerminals();
  const { data: users = [] } = useUsers(user?.role !== 'entity');
  const { create, update, remove } = usePlanMutations();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmergencyPlan | null>(null);
  const [form, setForm] = useState({ name: '', description: '', responsible: '', status: 'ativo' as PlanStatus, checklistText: '', terminalId: '' });

  if (!user) return null;

  const canCreate = user.role === 'admin' || user.role === 'terminal';
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');
  const inputCls = 'w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary';
  const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1';

  // Responsável: usuários do terminal onde o plano será criado.
  const responsibleTerminalId = user.role === 'admin' ? form.terminalId : (user.linkId ?? '');
  const responsibleOptions = users.filter(u => u.role === 'terminal' && (!responsibleTerminalId || u.linkId === responsibleTerminalId));

  const emptyForm = { name: '', description: '', responsible: '', status: 'ativo' as PlanStatus, checklistText: '', terminalId: '' };
  const openNew = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (p: EmergencyPlan) => {
    setForm({
      name: p.name,
      description: p.description,
      responsible: p.responsible || '',
      status: p.status,
      checklistText: p.checklist.map(c => c.text).join('\n'),
      terminalId: p.terminalId || '',
    });
    setEditId(p.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Informe o nome do plano'); return; }
    if (!editId && user.role === 'admin' && !form.terminalId) { toast.error('Selecione o terminal'); return; }
    // Ao editar, preserva o progresso (done) dos itens de checklist cujo texto não mudou.
    const original = editId ? (plans.find(p => p.id === editId)?.checklist ?? []) : [];
    const checklist = form.checklistText.split('\n').filter(Boolean).map(line => {
      const text = line.trim();
      const ex = original.find(c => c.text === text);
      return { text, done: ex?.done ?? false };
    });
    const input = {
      name: form.name,
      description: form.description,
      responsible: form.responsible || undefined,
      checklist,
      status: form.status,
      ...(user.role === 'admin' && form.terminalId ? { terminalId: form.terminalId } : {}),
    };
    const onSuccess = () => { closeForm(); toast.success(editId ? 'Plano atualizado' : 'Plano cadastrado'); };
    if (editId) update.mutate({ id: editId, input }, { onSuccess, onError });
    else create.mutate(input, { onSuccess, onError });
  };

  const toggleChecklist = (planId: string, idx: number) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const checklist = plan.checklist.map((c, i) => (i === idx ? { ...c, done: !c.done } : c));
    update.mutate({ id: planId, input: { checklist } }, { onError });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    remove.mutate(deleteTarget.id, { onSuccess: () => toast.success(`Plano "${name}" removido`), onError });
    setDeleteTarget(null);
  };

  const statusColor = (s: PlanStatus) =>
    s === 'ativo' ? 'bg-success/10 text-success' : s === 'em revisão' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground';

  const getTerminalName = (p: { terminalId: string }) =>
    (p as any).terminalName || terminals.find(t => t.id === p.terminalId)?.name || p.terminalId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-accent" />
          <h2 className="text-lg font-bold text-foreground">Planos de Ação de Emergência</h2>
        </div>
        {canCreate && (
          <button onClick={() => (showForm ? closeForm() : openNew())} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Plano
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <p className="text-sm font-bold text-foreground">{editId ? 'Editar Plano' : 'Novo Plano'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome do plano *</label>
              <input placeholder="Ex.: PAE Incêndio TECON" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Responsável</label>
              <Select
                value={form.responsible || undefined}
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
            <div>
              <label className={labelCls}>Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as PlanStatus }))}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="cursor-pointer">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {user.role === 'admin' && (
              <div>
                <label className={labelCls}>Terminal *</label>
                <Select value={form.terminalId} onValueChange={v => setForm(f => ({ ...f, terminalId: v, responsible: '' }))}>
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione o terminal..." /></SelectTrigger>
                  <SelectContent>
                    {terminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <textarea placeholder="Descreva o plano..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} min-h-[60px]`} />
          </div>
          <div>
            <label className={labelCls}>Checklist <span className="normal-case font-normal text-muted-foreground/70">(uma ação por linha)</span></label>
            <textarea placeholder={'Acionar alarme\nEvacuar área\nContatar bombeiros'} value={form.checklistText} onChange={e => setForm(f => ({ ...f, checklistText: e.target.value }))} className={`${inputCls} min-h-[60px]`} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={create.isPending || update.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-1.5">
              {(create.isPending || update.isPending) && <Loader2 size={12} className="animate-spin" />} Salvar
            </button>
            <button onClick={closeForm} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-md cursor-pointer hover:bg-secondary/80 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground bg-card border border-border rounded-lg flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando planos...</p>
        )}
        {isError && !isLoading && <p className="p-4 text-sm text-primary bg-card border border-border rounded-lg">Falha ao carregar planos da API.</p>}
        {!isLoading && !isError && plans.length === 0 && <p className="p-4 text-sm text-muted-foreground italic bg-card border border-border rounded-lg">Nenhum plano cadastrado.</p>}
        {plans.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-foreground">{p.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(p.status)}`}>{p.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{getTerminalName(p)} · Resp: {p.responsible}</p>
              </div>
              {canCreate && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} title="Editar" className="text-muted-foreground hover:text-primary transition-colors p-1 cursor-pointer"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteTarget(p)} title="Excluir" className="text-muted-foreground hover:text-emergency transition-colors p-1 cursor-pointer"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
            {p.checklist.length > 0 && (
              <div className="p-4 space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Checklist</p>
                {p.checklist.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => canCreate && toggleChecklist(p.id, i)}
                    className={`flex items-center gap-2 text-xs w-full text-left ${c.done ? 'text-muted-foreground line-through' : 'text-foreground'} ${canCreate ? 'cursor-pointer hover:bg-secondary/50 -mx-1 px-1 py-0.5 rounded' : ''}`}
                    disabled={!canCreate}
                  >
                    {c.done ? <CheckSquare size={14} className="text-success shrink-0" /> : <Square size={14} className="text-muted-foreground shrink-0" />}
                    {c.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmação de remoção (AlertDialog — substitui o confirm() nativo) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="p-1.5 bg-primary/10 rounded-lg"><Trash2 size={16} className="text-primary" /></span>
              Remover plano?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O plano <strong className="text-foreground font-semibold">{deleteTarget?.name}</strong> será removido.
              Se ele estava ativo, deixará de ser oferecido na Sala de Situação. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
