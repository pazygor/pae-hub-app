import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { NotificationRule } from '@/lib/types';
import { Bell, Plus, X, Shield, AlertTriangle, Trash2 } from 'lucide-react';
import { useEntities, useNotificationRules, useNotificationRuleMutations, useEntityNotifications } from '@/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const OCCURRENCE_TYPES = [
  'Princípio de incêndio', 'Vazamento', 'Emergência', 'Explosão',
  'Queda de carga', 'Acidente de trabalho', 'Contaminação ambiental', 'Outros',
];

export function NotificationRulesPage() {
  const { user } = useAuth();
  const { data: entities = [] } = useEntities();
  const { data: notificationRules = [] } = useNotificationRules();
  // Histórico real de acionamentos (EntityNotification — Fase 3)
  const { data: entityNotifications = [] } = useEntityNotifications();
  const { create, setMandatory, remove } = useNotificationRuleMutations();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotificationRule | null>(null);
  const [form, setForm] = useState({ occurrenceType: '', entityId: '', mandatory: false });

  if (!user || user.role !== 'admin') return null;

  const getEntityName = (id: string) => entities.find(e => e.id === id)?.name || id;

  const addRule = () => {
    if (!form.occurrenceType) { toast.error('Selecione o tipo de ocorrência'); return; }
    if (!form.entityId) { toast.error('Selecione a entidade'); return; }
    create.mutate(
      { occurrenceType: form.occurrenceType, entityId: form.entityId, mandatory: form.mandatory },
      {
        onSuccess: () => { setForm({ occurrenceType: '', entityId: '', mandatory: false }); setShowForm(false); toast.success('Regra adicionada'); },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao adicionar regra'),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const label = `${getEntityName(deleteTarget.entityId)} · ${deleteTarget.occurrenceType}`;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => toast.success(`Regra removida (${label})`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao remover regra'),
    });
    setDeleteTarget(null);
  };

  const toggleMandatory = (id: string) => {
    const rule = notificationRules.find(r => r.id === id);
    if (!rule) return;
    setMandatory.mutate({ id, mandatory: !rule.mandatory }, {
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao atualizar regra'),
    });
  };

  // Group rules by occurrence type
  const groupedRules: Record<string, NotificationRule[]> = {};
  notificationRules.forEach(rule => {
    if (!groupedRules[rule.occurrenceType]) groupedRules[rule.occurrenceType] = [];
    groupedRules[rule.occurrenceType].push(rule);
  });

  // Notification history
  const recentNotifications = [...entityNotifications]
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
    .slice(0, 20);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-warning/10 rounded-xl">
            <Bell size={20} className="text-warning" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Acionamento de Entidades</h2>
            <p className="text-xs text-muted-foreground">Parametrização e histórico de notificações automáticas</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Nova Regra
        </button>
      </div>

      {/* Info */}
      <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
        <Bell size={16} className="text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Configure quais entidades devem ser <strong className="text-foreground">notificadas automaticamente</strong> para cada tipo de ocorrência.
          Entidades marcadas como <strong className="text-primary">obrigatórias</strong> serão sempre acionadas ao disparar uma emergência do tipo correspondente.
        </p>
      </div>

      {/* New Rule Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Nova Regra de Notificação</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Tipo de Ocorrência</label>
              <Select value={form.occurrenceType || undefined} onValueChange={v => setForm(f => ({ ...f, occurrenceType: v }))}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {OCCURRENCE_TYPES.map(t => <SelectItem key={t} value={t} className="cursor-pointer">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Entidade</label>
              <Select value={form.entityId || undefined} onValueChange={v => setForm(f => ({ ...f, entityId: v }))}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {entities.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma entidade cadastrada</div>}
                  {entities.map(e => <SelectItem key={e.id} value={e.id} className="cursor-pointer">{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, mandatory: !f.mandatory }))}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border-2 cursor-pointer transition-all ${
                form.mandatory
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-secondary-foreground border-border'
              }`}
            >
              <Shield size={14} />
              {form.mandatory ? 'Obrigatória' : 'Opcional'}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {form.mandatory ? 'Esta entidade será sempre notificada automaticamente' : 'Notificação recomendada, mas não obrigatória'}
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold cursor-pointer hover:bg-secondary/80 transition-colors">
              Cancelar
            </button>
            <button
              onClick={addRule}
              disabled={create.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Adicionar Regra
            </button>
          </div>
        </div>
      )}

      {/* Rules by Occurrence Type */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Regras por Tipo de Ocorrência</h3>
        {Object.keys(groupedRules).length === 0 && (
          <p className="text-sm text-muted-foreground italic bg-card border border-border rounded-xl p-4">Nenhuma regra configurada.</p>
        )}
        {Object.entries(groupedRules).map(([type, rules]) => (
          <div key={type} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-secondary/50 flex items-center gap-2">
              <AlertTriangle size={14} className="text-warning" />
              <span className="text-sm font-bold text-foreground">{type}</span>
              <span className="text-[10px] text-muted-foreground ml-1">({rules.length} entidade{rules.length > 1 ? 's' : ''})</span>
            </div>
            <div className="divide-y divide-border">
              {rules.map(rule => (
                <div key={rule.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield size={14} className={rule.mandatory ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-sm text-foreground font-medium">{getEntityName(rule.entityId)}</span>
                    <button
                      onClick={() => toggleMandatory(rule.id)}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                        rule.mandatory
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-secondary text-muted-foreground border-border'
                      }`}
                    >
                      {rule.mandatory ? 'Obrigatória' : 'Opcional'}
                    </button>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(rule)}
                    className="text-muted-foreground hover:text-emergency transition-colors p-1 cursor-pointer"
                    title="Remover regra"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Notification History */}
      {recentNotifications.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Histórico de Notificações</h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Ocorrência</th>
                    <th className="px-4 py-3">Entidade</th>
                    <th className="px-4 py-3">Data/Hora</th>
                    <th className="px-4 py-3">Obrigatória</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentNotifications.map(n => (
                    <tr key={n.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-foreground font-medium text-xs">{n.incNumber || n.occurrenceId}</td>
                      <td className="px-4 py-3 text-foreground text-xs">{n.entityName || getEntityName(n.entityId)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                        {new Date(n.dateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        {n.mandatory ? (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Sim</span>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Não</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          n.status === 'Notificada' ? 'bg-success/10 text-success'
                          : n.status === 'Confirmada' ? 'bg-accent/10 text-accent'
                          : 'bg-warning/10 text-warning'
                        }`}>
                          {n.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de remoção (AlertDialog — substitui o X direto) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="p-1.5 bg-primary/10 rounded-lg"><Trash2 size={16} className="text-primary" /></span>
              Remover regra de acionamento?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A entidade <strong className="text-foreground font-semibold">{deleteTarget ? getEntityName(deleteTarget.entityId) : ''}</strong> deixará
              de ser acionada automaticamente para ocorrências do tipo
              <strong className="text-foreground font-semibold"> {deleteTarget?.occurrenceType}</strong>. Esta ação não pode ser desfeita.
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
