import { useState } from 'react';
import { toast } from 'sonner';
import { Entity } from '@/lib/types';
import { Plus, X, Loader2 } from 'lucide-react';
import { usePresentationMode, maskContact } from '@/lib/presentation-mode';
import { useEntities, useEntityMutations } from '@/api';

export function EntitiesPage() {
  const { presentationMode } = usePresentationMode();
  const { data: entities = [], isLoading, isError } = useEntities();
  const { create, update, remove: removeMut } = useEntityMutations();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Entity, 'id'>>({ name: '', type: '', contact: '', status: 'Ativo' });
  const saving = create.isPending || update.isPending;

  const openNew = () => { setForm({ name: '', type: '', contact: '', status: 'Ativo' }); setEditId(null); setShowForm(true); };
  const openEdit = (e: Entity) => { setForm({ name: e.name, type: e.type, contact: e.contact, status: e.status }); setEditId(e.id); setShowForm(true); };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const onSuccess = () => { setShowForm(false); toast.success(editId ? 'Entidade atualizada' : 'Entidade cadastrada'); };
    const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar entidade');
    if (editId) update.mutate({ id: editId, form }, { onSuccess, onError });
    else create.mutate(form, { onSuccess, onError });
  };

  const inativar = (id: string) => {
    if (!confirm('Inativar esta entidade?')) return;
    removeMut.mutate(id, {
      onSuccess: () => toast.success('Entidade inativada'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao inativar'),
    });
  };

  const pm = presentationMode;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Gestão de Entidades</h2>
        <button onClick={openNew} className="flex items-center gap-1.5 text-xs bg-accent text-accent-foreground px-3 py-2 rounded-md font-bold hover:opacity-90 transition-opacity">
          <Plus size={14} /> Nova Entidade
        </button>
      </div>

      {pm && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center gap-2">
          <span className="text-accent text-xs">👁</span>
          <p className="text-xs text-accent font-medium">
            <strong>Modo Apresentação ativo</strong> — Dados de contato estão mascarados. Esta tela permite cadastrar e gerenciar as entidades envolvidas no PAE.
          </p>
        </div>
      )}

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm">{editId ? 'Editar Entidade' : 'Nova Entidade'}</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Nome</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="">Selecione...</option>
                <option>Emergência</option>
                <option>Autoridade Portuária</option>
                <option>Regulatório</option>
                <option>Ambiental</option>
                <option>Segurança</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Contato</label>
              <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Entity['status'] }))} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={saving} className="w-full py-2 bg-accent text-accent-foreground rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editId ? 'Salvar Alterações' : 'Cadastrar Entidade'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 hidden md:table-cell">Contato</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground"><Loader2 size={16} className="animate-spin inline mr-2" />Carregando entidades...</td></tr>
              )}
              {isError && !isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-primary">Falha ao carregar entidades da API.</td></tr>
              )}
              {!isLoading && !isError && entities.map(e => (
                <tr key={e.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{e.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.type}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono-data hidden md:table-cell">{pm ? maskContact(e.contact) : e.contact}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      e.status === 'Ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    }`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(e)} className="text-accent font-bold text-xs hover:underline">Editar</button>
                    <button onClick={() => inativar(e.id)} className="text-emergency font-bold text-xs hover:underline">Inativar</button>
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && entities.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma entidade cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
