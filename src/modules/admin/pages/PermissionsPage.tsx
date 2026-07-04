import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useEntities, useTerminals, usePermissions, usePermissionMutations } from '@/api';

export function PermissionsPage() {
  const { data: entities = [], isLoading: loadingEntities } = useEntities();
  const { data: terminals = [] } = useTerminals();
  const { data: permissions = [], isLoading: loadingPerms } = usePermissions();
  const { set } = usePermissionMutations();

  const isLoading = loadingEntities || loadingPerms;

  const togglePermission = (entityId: string, terminalId: string) => {
    const current = permissions.find(p => p.entityId === entityId)?.terminalIds || [];
    const next = current.includes(terminalId)
      ? current.filter(id => id !== terminalId)
      : [...current, terminalId];
    set.mutate({ entityId, terminalIds: next }, {
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar permissão'),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Gestão de Permissões</h2>

      <div className="bg-accent/5 border border-accent/20 p-4 rounded-lg flex gap-3 items-start">
        <AlertCircle className="text-accent shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-foreground">
          Como <strong>Administrador</strong>, defina quais entidades externas podem visualizar os dados de cada terminal portuário. Clique nos terminais para ativar/desativar o acesso.
        </p>
      </div>

      {isLoading && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin inline mr-2" />Carregando permissões...
        </div>
      )}

      {!isLoading && (
        <div className="grid gap-4">
          {entities.map(entity => {
            const perm = permissions.find(p => p.entityId === entity.id);
            const allowedCount = perm?.terminalIds.length || 0;

            return (
              <div key={entity.id} className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-foreground">{entity.name}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{entity.type} · {entity.contact}</p>
                  </div>
                  <span className="text-xs font-mono-data text-muted-foreground">{allowedCount}/{terminals.length} terminais</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {terminals.map(terminal => {
                    const isPermitted = perm?.terminalIds.includes(terminal.id) || false;
                    return (
                      <button
                        key={terminal.id}
                        onClick={() => togglePermission(entity.id, terminal.id)}
                        className={`px-4 py-2 rounded-md border text-xs font-bold transition-all ${
                          isPermitted
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-card border-border text-muted-foreground hover:border-foreground/30'
                        }`}
                      >
                        {terminal.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {entities.length === 0 && (
            <p className="text-sm text-muted-foreground italic bg-card border border-border rounded-lg p-6">Nenhuma entidade cadastrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
