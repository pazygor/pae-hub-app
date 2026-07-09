import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Terminal } from '@/lib/types';
import { useTerminals, useTerminalMutations, useUsers, geocodingApi, lookupCep } from '@/api';
import { formatPhoneBR, formatCEP } from '@/lib/masks';
import { Plus, X, Loader2, Trash2, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const STATUS_OPTIONS: Terminal['status'][] = ['Ativo', 'Inativo', 'Revisão'];
const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const EMPTY: Omit<Terminal, 'id'> = {
  name: '', responsible: '', contact: '', location: '',
  cep: '', street: '', number: '', neighborhood: '', city: '', state: '',
  lat: 0, lng: 0, status: 'Ativo',
};

export function TerminalsPage() {
  const { user } = useAuth();
  const { data: terminals = [], isLoading, isError } = useTerminals();
  const { data: users = [] } = useUsers();
  const { create, update, remove: removeMut, hardDelete } = useTerminalMutations();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Terminal | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Terminal | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState<Omit<Terminal, 'id'>>(EMPTY);

  const visibleTerminals = terminals;
  const isAdmin = user?.role === 'admin';
  const saving = create.isPending || update.isPending;
  const coordsOk = !!(form.lat && form.lng);
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');

  // Responsável: usuários de terminal da organização (o vínculo é só informativo
  // — o terminal deste form pode ainda não existir, então não filtramos por ele).
  const responsibleOptions = users
    .filter(u => u.role === 'terminal')
    .map(u => ({ name: u.name, terminalName: terminals.find(t => t.id === u.linkId)?.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (t: Terminal) => {
    setForm({
      name: t.name, responsible: t.responsible, contact: formatPhoneBR(t.contact), location: t.location,
      cep: t.cep, street: t.street, number: t.number, neighborhood: t.neighborhood, city: t.city, state: t.state,
      lat: t.lat, lng: t.lng, status: t.status,
    });
    setEditId(t.id);
    setShowForm(true);
  };

  const onCepChange = async (value: string) => {
    const masked = formatCEP(value);
    setForm(f => ({ ...f, cep: masked }));
    if (masked.replace(/\D/g, '').length === 8) {
      const addr = await lookupCep(masked);
      if (addr) {
        setForm(f => ({
          ...f,
          street: addr.street ?? f.street,
          neighborhood: addr.neighborhood ?? f.neighborhood,
          city: addr.city ?? f.city,
          state: addr.state ?? f.state,
        }));
      }
    }
  };

  const localizar = async () => {
    setGeocoding(true);
    try {
      const coords = await geocodingApi.coordinates({
        cep: form.cep, street: form.street, number: form.number,
        neighborhood: form.neighborhood, city: form.city, state: form.state,
      });
      if (coords) {
        setForm(f => ({ ...f, lat: coords.latitude, lng: coords.longitude }));
        toast.success('Terminal localizado — coordenadas atualizadas');
      } else {
        toast.warning('Não foi possível localizar. Verifique o CEP/endereço.');
      }
    } catch {
      toast.error('Falha ao localizar o terminal');
    } finally {
      setGeocoding(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome do terminal'); return; }
    if (!form.responsible.trim()) { toast.error('Informe o responsável'); return; }
    if (!form.contact.trim()) { toast.error('Informe o contato'); return; }
    const onSuccess = () => { setShowForm(false); toast.success(editId ? 'Terminal atualizado' : 'Terminal cadastrado'); };
    if (editId) update.mutate({ id: editId, form }, { onSuccess, onError });
    else create.mutate(form, { onSuccess, onError });
  };

  const confirmInactivate = () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    removeMut.mutate(deleteTarget.id, {
      onSuccess: () => toast.success(`Terminal ${name} inativado`),
      onError,
    });
    setDeleteTarget(null);
  };

  const confirmHardDelete = () => {
    if (!hardDeleteTarget) return;
    const name = hardDeleteTarget.name;
    hardDelete.mutate(hardDeleteTarget.id, {
      onSuccess: () => toast.success(`Terminal ${name} excluído permanentemente`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao excluir', { duration: 8000 }),
    });
    setHardDeleteTarget(null);
  };

  const inputCls = 'w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary';
  const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Gestão de Terminais</h2>
        {isAdmin && (
          <button onClick={openNew} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-2 rounded-md font-bold cursor-pointer hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Terminal
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm">{editId ? 'Editar Terminal' : 'Novo Terminal'}</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
          </div>
          <form onSubmit={save} className="space-y-5">
            {/* Dados básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Responsável *</label>
                <Select value={form.responsible || undefined} onValueChange={v => setForm(f => ({ ...f, responsible: v }))}>
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione o responsável..." /></SelectTrigger>
                  <SelectContent>
                    {responsibleOptions.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum usuário de terminal cadastrado</div>}
                    {responsibleOptions.map(o => (
                      <SelectItem key={o.name} value={o.name} className="cursor-pointer">
                        {o.name}{o.terminalName ? <span className="text-muted-foreground"> — {o.terminalName}</span> : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelCls}>Contato *</label>
                <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: formatPhoneBR(e.target.value) }))} placeholder="(13) 99999-0000" inputMode="tel" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Terminal['status'] }))}>
                  <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="cursor-pointer">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Endereço + geolocalização */}
            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-primary" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Endereço & Localização</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>CEP</label>
                  <input value={form.cep} onChange={e => onCepChange(e.target.value)} placeholder="00000-000" inputMode="numeric" className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Rua / Logradouro</label>
                  <input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Número</label>
                  <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Bairro</label>
                  <input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cidade</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Estado (UF)</label>
                  <Select value={form.state || undefined} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                    <SelectTrigger className="cursor-pointer"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {UF_OPTIONS.map(uf => <SelectItem key={uf} value={uf} className="cursor-pointer">{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Localizar + indicador de coordenadas */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={localizar}
                  disabled={geocoding || (!form.cep && !form.city)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-secondary text-secondary-foreground rounded-md border border-border cursor-pointer hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {geocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                  {coordsOk ? 'Atualizar localização' : 'Localizar terminal'}
                </button>
                {coordsOk ? (
                  <span className="flex items-center gap-1.5 text-xs text-success font-medium">
                    <CheckCircle2 size={14} /> Localizado ({form.lat.toFixed(5)}, {form.lng.toFixed(5)})
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-warning font-medium">
                    <AlertTriangle size={14} /> Coordenadas não configuradas
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Preencha o CEP para completar o endereço automaticamente; depois clique em <strong>Localizar</strong> para
                obter as coordenadas (usadas no mapa do COP e na rota da Sala de Situação).
              </p>
            </div>

            <div>
              <button type="submit" disabled={saving} className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
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
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    <span className="inline-flex items-center gap-1">
                      {t.lat && t.lng ? <MapPin size={11} className="text-success shrink-0" /> : null}
                      {t.location || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      t.status === 'Ativo' ? 'bg-success/10 text-success' : t.status === 'Revisão' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                    }`}>{t.status}</span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => openEdit(t)} className="text-primary font-bold text-xs cursor-pointer hover:underline">Editar</button>
                      <button onClick={() => setDeleteTarget(t)} className="text-primary font-bold text-xs cursor-pointer hover:underline">Inativar</button>
                      <button onClick={() => setHardDeleteTarget(t)} className="text-destructive font-bold text-xs cursor-pointer hover:underline">Excluir</button>
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

      {/* Confirmação de inativação (AlertDialog — substitui o confirm() nativo) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="p-1.5 bg-primary/10 rounded-lg"><Trash2 size={16} className="text-primary" /></span>
              Inativar terminal?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O terminal <strong className="text-foreground font-semibold">{deleteTarget?.name}</strong> deixará de
              aparecer nas operações (ocorrências, mapa, dashboard). Os dados históricos são preservados e ele pode
              ser reativado editando o status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmInactivate} className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão PERMANENTE (admin) — bloqueada pela API se houver vínculos */}
      <AlertDialog open={!!hardDeleteTarget} onOpenChange={open => { if (!open) setHardDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="p-1.5 bg-destructive/10 rounded-lg"><Trash2 size={16} className="text-destructive" /></span>
              Excluir terminal permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O terminal <strong className="text-foreground font-semibold">{hardDeleteTarget?.name}</strong> será
              <strong className="text-destructive"> removido para sempre</strong> do banco de dados — diferente de
              "Inativar", esta ação <strong>não pode ser desfeita</strong>. Se houver ocorrências, riscos, planos ou
              usuários vinculados a este terminal, a exclusão será recusada e você verá o motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHardDelete} className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
