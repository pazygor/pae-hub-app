import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Terminal } from '@/lib/types';
import { useTerminals, useTerminalMutations } from '@/api';
import { Plus, X, Loader2 } from 'lucide-react';

export function TerminalsPage() {
  const { user } = useAuth();
  const { data: terminals = [], isLoading, isError } = useTerminals();
  const { create, update, remove: removeMut } = useTerminalMutations();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Terminal, 'id'>>({ name: '', responsible: '', contact: '', location: '', lat: 0, lng: 0, status: 'Ativo' });

  // A API já devolve os terminais no escopo do papel (admin: todos).
  const visibleTerminals = terminals;
  const isAdmin = user?.role === 'admin';
  const saving = create.isPending || update.isPending;

  const openNew = () => {
    setForm({ name: '', responsible: '', contact: '', location: '', lat: 0, lng: 0, status: 'Ativo' });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (t: Terminal) => {
    setForm({ name: t.name, responsible: t.responsible, contact: t.contact, location: t.location, lat: t.lat, lng: t.lng, status: t.status });
    setEditId(t.id);
    setShowForm(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const onSuccess = () => { setShowForm(false); toast.success(editId ? 'Terminal atualizado' : 'Terminal cadastrado'); };
    const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar terminal');
    if (editId) update.mutate({ id: editId, form }, { onSuccess, onError });
    else create.mutate(form, { onSuccess, onError });
  };

  const remove = (id: string) => {
    if (!confirm('Inativar este terminal?')) return;
    removeMut.mutate(id, {
      onSuccess: () => toast.success('Terminal inativado'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao inativar'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Gestão de Terminais</h2>
        {isAdmin && (
          <button onClick={openNew} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-2 rounded-md font-bold hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Terminal
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm">{editId ? 'Editar Terminal' : 'Novo Terminal'}</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Nome</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Responsável</label>
              <input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Contato</label>
              <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Localização</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Latitude</label>
              <input type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Longitude</label>
              <input type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Terminal['status'] }))} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option>Ativo</option>
                <option>Inativo</option>
                <option>Revisão</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editId ? 'Salvar Alterações' : 'Cadastrar Terminal'}
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
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3 hidden md:table-cell">Contato</th>
                <th className="px-4 py-3 hidden lg:table-cell">Localização</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground"><Loader2 size={16} className="animate-spin inline mr-2" />Carregando terminais...</td></tr>
              )}
              {isError && !isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-primary">Falha ao carregar terminais da API.</td></tr>
              )}
              {!isLoading && !isError && visibleTerminals.map(t => (
                <tr key={t.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.responsible}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono-data hidden md:table-cell">{t.contact}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{t.location}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      t.status === 'Ativo' ? 'bg-success/10 text-success' : t.status === 'Revisão' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                    }`}>{t.status}</span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(t)} className="text-primary font-bold text-xs hover:underline">Editar</button>
                      <button onClick={() => remove(t.id)} className="text-primary font-bold text-xs hover:underline">Excluir</button>
                    </td>
                  )}
                </tr>
              ))}
              {!isLoading && !isError && visibleTerminals.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum terminal encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
