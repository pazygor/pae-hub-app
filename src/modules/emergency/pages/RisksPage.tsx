import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Risk, RiskLevel } from '@/lib/types';
import { Plus, AlertTriangle, Trash2, Loader2, Pencil, Filter, MapPin } from 'lucide-react';
import { useRisks, useRiskMutations, useTerminals } from '@/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { LocationPicker } from '@/components/common/LocationPicker';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const LEVEL_OPTIONS: RiskLevel[] = ['baixo', 'médio', 'alto'];

const emptyForm = {
  type: '', description: '', level: 'médio' as RiskLevel, affectedArea: '', terminalId: '',
  cep: '', street: '', number: '', neighborhood: '', city: '', state: '', lat: 0, lng: 0,
};

export function RisksPage() {
  const { user } = useAuth();
  const { data: risks = [], isLoading, isError } = useRisks();
  const { data: terminals = [] } = useTerminals();
  const { create, update, remove } = useRiskMutations();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Risk | null>(null);
  const [filterTerminal, setFilterTerminal] = useState<string>('all');
  const [form, setForm] = useState({ ...emptyForm });

  const canCreate = user?.role === 'admin' || user?.role === 'terminal';
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Falha na operação');
  const inputCls = 'w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary';
  const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1';

  // `useTerminals()` já vem escopado pelo back conforme Níveis de Acesso (casa +
  // allowedTerminals). O filtro aparece para qualquer perfil que tenha acesso a
  // mais de um terminal; as opções são exatamente esses terminais.
  const showTerminalFilter = terminals.length > 1;

  if (!user) return null;

  const openNew = () => { setForm({ ...emptyForm }); setEditId(null); setShowForm(true); };
  const openEdit = (r: Risk) => {
    setForm({
      type: r.type, description: r.description, level: r.level, affectedArea: r.affectedArea || '',
      terminalId: r.terminalId || '',
      cep: r.cep ?? '', street: r.street ?? '', number: r.number ?? '',
      neighborhood: r.neighborhood ?? '', city: r.city ?? '', state: r.state ?? '',
      lat: r.lat ?? 0, lng: r.lng ?? 0,
    });
    setEditId(r.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm({ ...emptyForm }); };

  const handleSave = () => {
    if (!form.type.trim()) { toast.error('Informe o tipo de risco'); return; }
    if (!form.description.trim()) { toast.error('Informe a descrição do risco'); return; }
    if (!editId && user.role === 'admin' && !form.terminalId) { toast.error('Selecione o terminal'); return; }
    const input = {
      type: form.type,
      description: form.description,
      level: form.level,
      affectedArea: form.affectedArea || undefined,
      lat: form.lat || undefined,
      lng: form.lng || undefined,
      cep: form.cep || undefined, street: form.street || undefined, number: form.number || undefined,
      neighborhood: form.neighborhood || undefined, city: form.city || undefined, state: form.state || undefined,
      ...(user.role === 'admin' && form.terminalId ? { terminalId: form.terminalId } : {}),
    };
    const onSuccess = () => { closeForm(); toast.success(editId ? 'Risco atualizado' : 'Risco cadastrado'); };
    if (editId) update.mutate({ id: editId, input }, { onSuccess, onError });
    else create.mutate(input, { onSuccess, onError });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const type = deleteTarget.type;
    remove.mutate(deleteTarget.id, { onSuccess: () => toast.success(`Risco "${type}" removido`), onError });
    setDeleteTarget(null);
  };

  const levelColor = (l: RiskLevel) =>
    l === 'alto' ? 'bg-emergency/10 text-emergency' : l === 'médio' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success';

  const getTerminalName = (r: { terminalId: string; terminalName?: string }) =>
    (r as any).terminalName || terminals.find(t => t.id === r.terminalId)?.name || r.terminalId;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  const filteredRisks = risks.filter(r => filterTerminal === 'all' || r.terminalId === filterTerminal);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-warning" />
          <h2 className="text-lg font-bold text-foreground">Cadastro de Riscos</h2>
        </div>
        {canCreate && (
          <button onClick={() => (showForm ? closeForm() : openNew())} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Risco
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <p className="text-sm font-bold text-foreground">{editId ? 'Editar Risco' : 'Novo Risco'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo de risco *</label>
              <input placeholder="Ex.: Curto-circuito, vazamento químico..." value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nível</label>
              <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v as RiskLevel }))}>
                <SelectTrigger className="cursor-pointer capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map(l => <SelectItem key={l} value={l} className="cursor-pointer capitalize">{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Área afetada</label>
              <input placeholder="Ex.: Berço 101, pátio de contêineres..." value={form.affectedArea} onChange={e => setForm(f => ({ ...f, affectedArea: e.target.value }))} className={inputCls} />
            </div>
            {user.role === 'admin' && !editId && (
              <div>
                <label className={labelCls}>Terminal *</label>
                <Select value={form.terminalId} onValueChange={v => setForm(f => ({ ...f, terminalId: v }))}>
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione o terminal..." /></SelectTrigger>
                  <SelectContent>
                    {terminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Descrição *</label>
            <textarea placeholder="Descreva o risco..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} min-h-[60px]`} />
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={14} className="text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Localização (opcional)</span>
            </div>
            <LocationPicker
              value={form}
              onChange={patch => setForm(f => ({ ...f, ...patch }))}
              entityLabel="risco"
              hint={<>Informe o endereço e clique em <strong>Localizar</strong>, ou ajuste a latitude/longitude manualmente para marcar o ponto exato do risco.</>}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={create.isPending || update.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-1.5">
              {(create.isPending || update.isPending) && <Loader2 size={12} className="animate-spin" />} Salvar
            </button>
            <button onClick={closeForm} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-md cursor-pointer hover:bg-secondary/80 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtro por terminal (admin e entidade) */}
      {showTerminalFilter && (
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-muted-foreground" />
          <Select value={filterTerminal} onValueChange={setFilterTerminal}>
            <SelectTrigger className="w-auto min-w-[180px] cursor-pointer h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">Todos os terminais</SelectItem>
              {terminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {filterTerminal !== 'all' && (
            <button onClick={() => setFilterTerminal('all')} className="text-[10px] text-primary font-bold hover:underline cursor-pointer">Limpar filtro</button>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground font-mono-data">{filteredRisks.length} risco(s)</span>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando riscos...</p>
        )}
        {isError && !isLoading && <p className="p-4 text-sm text-primary">Falha ao carregar riscos da API.</p>}
        {!isLoading && !isError && filteredRisks.length === 0 && <p className="p-4 text-sm text-muted-foreground italic">Nenhum risco encontrado.</p>}
        {filteredRisks.map(r => (
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
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(r)} title="Editar" className="text-muted-foreground hover:text-primary transition-colors p-1 cursor-pointer"><Pencil size={14} /></button>
                <button onClick={() => setDeleteTarget(r)} title="Excluir" className="text-muted-foreground hover:text-emergency transition-colors p-1 cursor-pointer"><Trash2 size={14} /></button>
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
              Remover risco?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O risco <strong className="text-foreground font-semibold">{deleteTarget?.type}</strong> será removido do
              cadastro. Esta ação não pode ser desfeita.
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
