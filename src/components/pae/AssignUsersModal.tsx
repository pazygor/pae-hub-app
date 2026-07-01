import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AppUser, Terminal } from '@/lib/types';
import { Search, CheckCircle, CheckSquare2, Users, X, Filter } from 'lucide-react';

interface AssignUsersModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  users: AppUser[];
  terminals: Terminal[];
  alreadyAssignedIds: Set<string>;
  onConfirm: (userIds: string[]) => void;
}

export function AssignUsersModal({
  open, onClose, title, description, confirmLabel, users, terminals, alreadyAssignedIds, onConfirm,
}: AssignUsersModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [terminalFilter, setTerminalFilter] = useState('all');

  const eligible = useMemo(() => {
    return users.filter(u => {
      if (u.role === 'admin') return false;
      if (alreadyAssignedIds.has(u.id)) return false;
      if (terminalFilter !== 'all' && u.linkId !== terminalFilter) return false;
      if (search && !u.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [users, alreadyAssignedIds, terminalFilter, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const ids = eligible.map(u => u.id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) { ids.forEach(id => next.delete(id)); } else { ids.forEach(id => next.add(id)); }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onConfirm(Array.from(selected));
    setSelected(new Set());
    setSearch('');
    setTerminalFilter('all');
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch('');
    setTerminalFilter('all');
    onClose();
  };

  const allSelected = eligible.length > 0 && eligible.every(u => selected.has(u.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users size={18} className="text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="px-6 py-3 border-b space-y-2 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-secondary/50 border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>
            <select
              value={terminalFilter}
              onChange={e => setTerminalFilter(e.target.value)}
              className="text-xs bg-secondary/50 border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Todos os terminais</option>
              {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            {eligible.length > 0 && (
              <button onClick={toggleAll} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                <CheckSquare2 size={11} /> {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {selected.size > 0 && <span className="font-bold text-primary">{selected.size}</span>}
              {selected.size > 0 ? ` de ${eligible.length} selecionado(s)` : `${eligible.length} disponível(is)`}
            </span>
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0">
          {eligible.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {search ? 'Nenhum usuário encontrado.' : 'Todos os usuários já estão atribuídos.'}
            </div>
          ) : (
            <div className="space-y-1">
              {eligible.map(u => {
                const terminal = u.linkId ? terminals.find(t => t.id === u.linkId) : null;
                const isSelected = selected.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-background border-transparent hover:bg-secondary/50 hover:border-border'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {isSelected && <CheckCircle size={12} className="text-primary-foreground" />}
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected ? 'bg-primary/20 text-primary' : 'bg-secondary text-foreground'
                    }`}>
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                      {terminal && <p className="text-[10px] text-muted-foreground truncate">{terminal.name}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between shrink-0">
          <button onClick={handleClose} className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {confirmLabel} ({selected.size})
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
