import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PlanStatus } from '@/lib/types';
import { Plus, FileText, Trash2, CheckSquare, Square, Loader2 } from 'lucide-react';
import { usePlans, usePlanMutations, useTerminals } from '@/api';

export function PlansPage() {
  const { user } = useAuth();
  const { data: plans = [], isLoading, isError } = usePlans();
  const { data: terminals = [] } = useTerminals();
  const { create, update, remove } = usePlanMutations();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', responsible: '', status: 'ativo' as PlanStatus, checklistText: '', terminalId: '' });

  if (!user) return null;

  const canCreate = user.role === 'admin' || user.role === 'terminal';
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');

  const handleAdd = () => {
    if (!form.name) return;
    if (user.role === 'admin' && !form.terminalId) { toast.error('Selecione o terminal'); return; }
    const checklist = form.checklistText.split('\n').filter(Boolean).map(text => ({ text: text.trim(), done: false }));
    create.mutate(
      {
        name: form.name,
        description: form.description,
        responsible: form.responsible || undefined,
        checklist,
        status: form.status,
        terminalId: user.role === 'admin' ? form.terminalId : undefined,
      },
      {
        onSuccess: () => {
          setForm({ name: '', description: '', responsible: '', status: 'ativo', checklistText: '', terminalId: '' });
          setShowForm(false);
          toast.success('Plano cadastrado');
        },
        onError,
      },
    );
  };

  const toggleChecklist = (planId: string, idx: number) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const checklist = plan.checklist.map((c, i) => (i === idx ? { ...c, done: !c.done } : c));
    update.mutate({ id: planId, input: { checklist } }, { onError });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover este plano?')) return;
    remove.mutate(id, { onSuccess: () => toast.success('Plano removido'), onError });
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
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Plano
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nome do plano" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground" />
            <input placeholder="Responsável" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground" />
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PlanStatus }))} className="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="em revisão">Em Revisão</option>
            </select>
            {user.role === 'admin' && (
              <select value={form.terminalId} onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground">
                <option value="">Selecione o terminal...</option>
                {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <textarea placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground min-h-[60px]" />
          <textarea placeholder="Checklist (uma ação por linha)" value={form.checklistText} onChange={e => setForm(f => ({ ...f, checklistText: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground min-h-[60px]" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={create.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md disabled:opacity-60 flex items-center gap-1.5">
              {create.isPending && <Loader2 size={12} className="animate-spin" />} Salvar
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-md">Cancelar</button>
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
                <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-emergency transition-colors p-1"><Trash2 size={14} /></button>
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
    </div>
  );
}
