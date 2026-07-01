import { useAuth } from '@/lib/auth-context';
import { AlertCircle } from 'lucide-react';

export function PermissionsView() {
  const { data, setData } = useAuth();

  const togglePermission = (entityId: string, terminalId: string) => {
    setData(d => {
      const perms = [...d.permissions];
      const idx = perms.findIndex(p => p.entityId === entityId);
      if (idx === -1) {
        perms.push({ entityId, terminalIds: [terminalId] });
      } else {
        const tIds = perms[idx].terminalIds;
        if (tIds.includes(terminalId)) {
          perms[idx] = { ...perms[idx], terminalIds: tIds.filter(id => id !== terminalId) };
        } else {
          perms[idx] = { ...perms[idx], terminalIds: [...tIds, terminalId] };
        }
      }
      return { ...d, permissions: perms };
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

      <div className="grid gap-4">
        {data.entities.map(entity => {
          const perm = data.permissions.find(p => p.entityId === entity.id);
          const allowedCount = perm?.terminalIds.length || 0;

          return (
            <div key={entity.id} className="bg-card border border-border rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-foreground">{entity.name}</h4>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{entity.type} · {entity.contact}</p>
                </div>
                <span className="text-xs font-mono-data text-muted-foreground">{allowedCount}/{data.terminals.length} terminais</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.terminals.map(terminal => {
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
      </div>
    </div>
  );
}
