import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { AppUser, UserRole, AccessLevel } from '@/lib/types';
import { Plus, X, Loader2 } from 'lucide-react';
import { usePresentationMode, maskEmail, maskName } from '@/lib/presentation-mode';
import { getVisibleUsers, canManage } from '@/lib/access-control';
import { useUsers, useTerminals, useUserMutations, UserInput } from '@/api';

export function UsersPage() {
  const { user, data } = useAuth();
  const { presentationMode } = usePresentationMode();
  const { data: users = [], isLoading, isError } = useUsers();
  const { data: terminals = [] } = useTerminals();
  const { create, update, setStatus } = useUserMutations();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'terminal' as UserRole, linkId: '', accessLevel: '' as AccessLevel | '', tacticalManagerId: '' });
  const saving = create.isPending || update.isPending;

  const openNew = () => { setForm({ name: '', email: '', password: '', phone: '', role: 'terminal', linkId: '', accessLevel: '', tacticalManagerId: '' }); setEditId(null); setShowForm(true); };
  const openEdit = (u: AppUser) => { setForm({ name: u.name, email: u.email, password: '', phone: u.phone || '', role: u.role, linkId: u.linkId || '', accessLevel: u.accessLevel || '', tacticalManagerId: u.tacticalManagerId || '' }); setEditId(u.id); setShowForm(true); };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // Vínculo com terminal só se aplica ao papel 'terminal' (entidades → Fase 4b/5c).
    const input: UserInput = {
      name: form.name,
      role: form.role,
      accessLevel: form.accessLevel || null,
      terminalId: form.role === 'terminal' ? (form.linkId || undefined) : undefined,
      tacticalManagerId: form.tacticalManagerId || null,
      phone: form.phone || undefined,
    };
    if (form.password) input.password = form.password;
    const onSuccess = () => { setShowForm(false); toast.success(editId ? 'Usuário atualizado' : 'Usuário cadastrado'); };
    const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar usuário');
    if (editId) {
      update.mutate({ id: editId, input }, { onSuccess, onError });
    } else {
      create.mutate({ ...input, email: form.email, password: form.password }, { onSuccess, onError });
    }
  };

  const inativar = (id: string) => {
    if (!confirm('Inativar este usuário? Ele perde o acesso ao sistema.')) return;
    setStatus.mutate({ id, status: 'INACTIVE' }, {
      onSuccess: () => toast.success('Usuário inativado'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao inativar'),
    });
  };

  const getLinkName = (u: AppUser) => {
    if (u.role === 'terminal') return terminals.find(t => t.id === u.linkId)?.name || '—';
    if (u.role === 'entity') return data.entities.find(e => e.id === u.linkId)?.name || '—';
    return '—';
  };

  const getTacticalManagerName = (u: AppUser) => {
    if (!u.tacticalManagerId) return '—';
    return users.find(m => m.id === u.tacticalManagerId)?.name || '—';
  };

  const roleLabel = (r: UserRole) => r === 'admin' ? 'Administrador' : r === 'terminal' ? 'Terminal' : 'Entidade';
  const accessLabel = (l?: AccessLevel) => l === 'estratégico' ? 'Estratégico' : l === 'operacional' ? 'Operacional' : l === 'tático' ? 'Tático' : '—';

  const linkOptions = form.role === 'terminal' ? terminals : form.role === 'entity' ? data.entities : [];

  // Tático users available as managers
  const tacticalUsers = users.filter(u => u.accessLevel === 'tático');

  const pm = presentationMode;
  const userCanManage = canManage(user);

  // Hierarchy-based visibility (admin → todos)
  const visibleUsers = getVisibleUsers(user, users);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Gestão de Usuários</h2>
        {userCanManage && (
          <button onClick={openNew} className="flex items-center gap-1.5 text-xs bg-accent text-accent-foreground px-3 py-2 rounded-md font-bold hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Usuário
          </button>
        )}
      </div>

      {pm && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center gap-2">
          <span className="text-accent text-xs">👁</span>
          <p className="text-xs text-accent font-medium">
            <strong>Modo Apresentação ativo</strong> — Dados pessoais estão mascarados. Esta tela permite gerenciar todos os usuários do sistema, seus perfis e níveis de acesso.
          </p>
        </div>
      )}

      {/* Hierarchy info for non-admin */}
      {user && user.accessLevel === 'tático' && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Visão Tática</strong> — Você visualiza apenas os usuários operacionais vinculados a você.
          </p>
        </div>
      )}
      {user && user.accessLevel === 'estratégico' && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Visão Estratégica</strong> — Você visualiza todos os usuários do seu terminal. Gestão de cadastro é restrita ao nível Tático ou Administrador.
          </p>
        </div>
      )}

      {showForm && userCanManage && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm">{editId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Nome</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Senha {editId && <span className="normal-case text-muted-foreground/70">(deixe em branco p/ manter)</span>}</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!editId} minLength={8} placeholder={editId ? '••••••••' : 'mín. 8 caracteres'} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Telefone (WhatsApp)</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(13) 99999-0000" className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Perfil</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole, linkId: '' }))} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="admin">Administrador</option>
                <option value="terminal">Terminal</option>
                <option value="entity">Entidade</option>
              </select>
            </div>
            {form.role !== 'admin' && (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Vínculo</label>
                <select value={form.linkId} onChange={e => setForm(f => ({ ...f, linkId: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                  <option value="">Selecione...</option>
                  {linkOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                </select>
              </div>
            )}
            {form.role !== 'admin' && (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Nível de Acesso</label>
                <select value={form.accessLevel} onChange={e => setForm(f => ({ ...f, accessLevel: e.target.value as AccessLevel | '' }))} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                  <option value="">Selecione...</option>
                  <option value="estratégico">Estratégico</option>
                  <option value="tático">Tático</option>
                  <option value="operacional">Operacional</option>
                </select>
              </div>
            )}
            {form.accessLevel === 'operacional' && (
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Gestor Tático</label>
                <select value={form.tacticalManagerId} onChange={e => setForm(f => ({ ...f, tacticalManagerId: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                  <option value="">Selecione...</option>
                  {tacticalUsers.map(tu => <option key={tu.id} value={tu.id}>{tu.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="w-full py-2 bg-accent text-accent-foreground rounded-md text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
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
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3 hidden md:table-cell">Nível</th>
                <th className="px-4 py-3 hidden md:table-cell">Vínculo</th>
                <th className="px-4 py-3 hidden lg:table-cell">Gestor Tático</th>
                {userCanManage && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground"><Loader2 size={16} className="animate-spin inline mr-2" />Carregando usuários...</td></tr>
              )}
              {isError && !isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-primary">Falha ao carregar usuários da API.</td></tr>
              )}
              {!isLoading && !isError && visibleUsers.map(u => (
                <tr key={u.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{pm ? maskName(u.name) : u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono-data text-xs">{pm ? maskEmail(u.email) : u.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-secondary text-foreground">
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      u.accessLevel === 'estratégico' ? 'bg-primary/10 text-primary' 
                      : u.accessLevel === 'operacional' ? 'bg-warning/10 text-warning' 
                      : u.accessLevel === 'tático' ? 'bg-accent/10 text-accent' 
                      : 'text-muted-foreground'
                    }`}>
                      {accessLabel(u.accessLevel)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{getLinkName(u)}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">{getTacticalManagerName(u)}</td>
                  {userCanManage && (
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(u)} className="text-accent font-bold text-xs hover:underline">Editar</button>
                      {u.role !== 'admin' && (
                        <button onClick={() => inativar(u.id)} className="text-emergency font-bold text-xs hover:underline">Inativar</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
