import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { RiskLevel } from '@/lib/types';
import { Plus, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useRisks, useRiskMutations, useTerminals } from '@/api';

export function RisksPage() {
  const { user } = useAuth();
  const { data: risks = [], isLoading, isError } = useRisks();
  const { data: terminals = [] } = useTerminals();
  const { create, remove } = useRiskMutations();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '', description: '', level: 'médio' as RiskLevel, affectedArea: '', terminalId: '' });

  if (!user) return null;

  const canCreate = user.role === 'admin' || user.role === 'terminal';
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');

  const handleAdd = () => {
    if (!form.type || !form.description) return;
    if (user.role === 'admin' && !form.terminalId) { toast.error('Selecione o terminal'); return; }
    create.mutate(
      {
        type: form.type,
        description: form.description,
        level: form.level,
        affectedArea: form.affectedArea || undefined,
        terminalId: user.role === 'admin' ? form.terminalId : undefined,
      },
      {
        onSuccess: () => {
          setForm({ type: '', description: '', level: 'médio', affectedArea: '', terminalId: '' });
          setShowForm(false);
          toast.success('Risco cadastrado');
        },
        onError,
      },
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover este risco?')) return;
    remove.mutate(id, { onSuccess: () => toast.success('Risco removido'), onError });
  };

  const levelColor = (l: RiskLevel) =>
    l === 'alto' ? 'bg-emergency/10 text-emergency' : l === 'médio' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success';

  const getTerminalName = (r: { terminalId: string; terminalName?: string }) =>
    (r as any).terminalName || terminals.find(t => t.id === r.terminalId)?.name || r.terminalId;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-warning" />
          <h2 className="text-lg font-bold text-foreground">Cadastro de Riscos</h2>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Risco
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Tipo de risco" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground" />
            <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value as RiskLevel }))} className="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground">
              <option value="baixo">Baixo</option>
              <option value="médio">Médio</option>
              <option value="alto">Alto</option>
            </select>
            <input placeholder="Área afetada" value={form.affectedArea} onChange={e => setForm(f => ({ ...f, affectedArea: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground" />
            {user.role === 'admin' && (
              <select value={form.terminalId} onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))} className="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground">
                <option value="">Selecione o terminal...</option>
                {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <textarea placeholder="Descrição do risco" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground min-h-[60px]" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={create.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md disabled:opacity-60 flex items-center gap-1.5">
              {create.isPending && <Loader2 size={12} className="animate-spin" />} Salvar
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-md">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando riscos...</p>
        )}
        {isError && !isLoading && <p className="p-4 text-sm text-primary">Falha ao carregar riscos da API.</p>}
        {!isLoading && !isError && risks.length === 0 && <p className="p-4 text-sm text-muted-foreground italic">Nenhum risco cadastrado.</p>}
        {risks.map(r => (
          <div key={r.id} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-foreground">{r.type}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${levelColor(r.level)}`}>{r.level}</span>
              </div>
              <p className="text-xs text-muted-foreground">{r.description}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {getTerminalName(r)} · {r.affectedArea} · {fmtDate(r.date)}
              </p>
            </div>
            {canCreate && (
              <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-emergency transition-colors p-1"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
