import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppUser, AccessLevel, ALL_MODULES, MODULE_LABELS, ModuleId } from '@/lib/types';
import { ShieldCheck, User, ChevronDown, ChevronUp, Check, X, Ship, Siren } from 'lucide-react';

const ACCESS_LEVELS: { value: AccessLevel; label: string; description: string; color: string }[] = [
  { value: 'estratégico', label: 'Estratégico', description: 'Visão geral, indicadores e relatórios', color: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'tático', label: 'Tático', description: 'Execução em campo, registros e checklist', color: 'bg-accent/10 text-accent border-accent/20' },
  { value: 'operacional', label: 'Operacional', description: 'Gestão de ocorrências, planos e riscos', color: 'bg-warning/10 text-warning border-warning/20' },
];

const OCCURRENCE_TYPES = [
  'Princípio de incêndio', 'Vazamento', 'Emergência', 'Explosão',
  'Queda de carga', 'Acidente de trabalho', 'Contaminação ambiental', 'Outros',
];

// Modules accessible to non-admin roles for restriction
const RESTRICTABLE_MODULES: ModuleId[] = [
  'cop', 'dashboard', 'terminals', 'risks', 'plans', 'occurrences', 'map', 'documents', 'badge', 'about',
];

export function AccessLevelsPage() {
  const { user, data, setData } = useAuth();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  if (!user || user.role !== 'admin') return null;

  const nonAdminUsers = data.users.filter(u => u.role !== 'admin');

  const updateUser = (userId: string, updates: Partial<AppUser>) => {
    setData(d => ({
      ...d,
      users: d.users.map(u => u.id === userId ? { ...u, ...updates } : u),
    }));
  };

  const toggleModule = (userId: string, moduleId: string) => {
    const usr = data.users.find(u => u.id === userId);
    if (!usr) return;
    const current = usr.allowedModules || RESTRICTABLE_MODULES.map(String);
    const updated = current.includes(moduleId)
      ? current.filter(m => m !== moduleId)
      : [...current, moduleId];
    updateUser(userId, { allowedModules: updated });
  };

  const toggleTerminal = (userId: string, terminalId: string) => {
    const usr = data.users.find(u => u.id === userId);
    if (!usr) return;
    const current = usr.allowedTerminals || data.terminals.map(t => t.id);
    const updated = current.includes(terminalId)
      ? current.filter(t => t !== terminalId)
      : [...current, terminalId];
    updateUser(userId, { allowedTerminals: updated });
  };

  const toggleOccurrenceType = (userId: string, type: string) => {
    const usr = data.users.find(u => u.id === userId);
    if (!usr) return;
    const current = usr.allowedOccurrenceTypes || OCCURRENCE_TYPES;
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    updateUser(userId, { allowedOccurrenceTypes: updated });
  };

  const getLinkName = (u: AppUser) => {
    if (u.role === 'terminal') return data.terminals.find(t => t.id === u.linkId)?.name || '—';
    if (u.role === 'entity') return data.entities.find(e => e.id === u.linkId)?.name || '—';
    return '—';
  };

  const accessLevelColor = (level?: AccessLevel) => {
    return ACCESS_LEVELS.find(l => l.value === level)?.color || 'bg-secondary text-muted-foreground border-border';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <ShieldCheck size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Níveis de Acesso</h2>
          <p className="text-xs text-muted-foreground">Controle hierárquico de acesso por usuário, módulo e terminal</p>
        </div>
      </div>

      {/* Level Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ACCESS_LEVELS.map(level => (
          <div key={level.value} className={`rounded-xl border p-4 ${level.color}`}>
            <h3 className="text-sm font-bold uppercase tracking-wider">{level.label}</h3>
            <p className="text-[11px] mt-1 opacity-80">{level.description}</p>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Configure o <strong className="text-foreground">nível hierárquico</strong>, os <strong className="text-foreground">módulos acessíveis</strong>,
          os <strong className="text-foreground">terminais visíveis</strong> e os <strong className="text-foreground">tipos de ocorrência</strong> permitidos para cada usuário.
          Administradores possuem acesso irrestrito.
        </p>
      </div>

      {/* User list */}
      <div className="space-y-3">
        {nonAdminUsers.length === 0 && (
          <p className="text-sm text-muted-foreground italic bg-card border border-border rounded-xl p-4">Nenhum usuário não-administrador cadastrado.</p>
        )}

        {nonAdminUsers.map(u => {
          const isExpanded = expandedUserId === u.id;
          const userModules = u.allowedModules || RESTRICTABLE_MODULES.map(String);
          const userTerminals = u.allowedTerminals || data.terminals.map(t => t.id);
          const userOccTypes = u.allowedOccurrenceTypes || OCCURRENCE_TYPES;

          return (
            <div key={u.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* User Header */}
              <button
                onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary rounded-lg">
                    <User size={16} className="text-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground">{u.email} · {getLinkName(u)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${u.role === 'terminal' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                    {u.role === 'terminal' ? 'Terminal' : 'Entidade'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${accessLevelColor(u.accessLevel)}`}>
                    {u.accessLevel || 'Não definido'}
                  </span>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded Config */}
              {isExpanded && (
                <div className="border-t border-border p-4 space-y-5">
                  {/* Access Level */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Nível Hierárquico</label>
                    <div className="grid grid-cols-3 gap-2">
                      {ACCESS_LEVELS.map(level => (
                        <button
                          key={level.value}
                          onClick={() => updateUser(u.id, { accessLevel: level.value })}
                          className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                            u.accessLevel === level.value
                              ? level.value === 'estratégico'
                                ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                                : level.value === 'operacional'
                                  ? 'bg-warning text-warning-foreground border-warning shadow-lg shadow-warning/20'
                                  : 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20'
                              : 'bg-secondary text-secondary-foreground border-border hover:border-muted-foreground'
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tactical Manager (for Operacional users) */}
                  {u.accessLevel === 'operacional' && (
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Gestor Tático</label>
                      <select
                        value={u.tacticalManagerId || ''}
                        onChange={e => updateUser(u.id, { tacticalManagerId: e.target.value || undefined })}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-background border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Nenhum</option>
                        {data.users.filter(tu => tu.accessLevel === 'tático').map(tu => (
                          <option key={tu.id} value={tu.id}>{tu.name}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">O gestor tático será responsável por este usuário operacional.</p>
                    </div>
                  )}

                  {/* Module Restrictions */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      Módulos Acessíveis ({userModules.length}/{RESTRICTABLE_MODULES.length})
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                      {RESTRICTABLE_MODULES.map(moduleId => {
                        const isAllowed = userModules.includes(moduleId);
                        return (
                          <button
                            key={moduleId}
                            onClick={() => toggleModule(u.id, moduleId)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all border ${
                              isAllowed
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-secondary/50 text-muted-foreground border-border line-through opacity-60'
                            }`}
                          >
                            {isAllowed ? <Check size={12} /> : <X size={12} />}
                            {MODULE_LABELS[moduleId]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Terminal Restrictions */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      Terminais Visíveis ({userTerminals.length}/{data.terminals.length})
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {data.terminals.map(terminal => {
                        const isAllowed = userTerminals.includes(terminal.id);
                        return (
                          <button
                            key={terminal.id}
                            onClick={() => toggleTerminal(u.id, terminal.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all border ${
                              isAllowed
                                ? 'bg-accent/10 text-accent border-accent/20'
                                : 'bg-secondary/50 text-muted-foreground border-border line-through opacity-60'
                            }`}
                          >
                            {isAllowed ? <Ship size={12} /> : <X size={12} />}
                            {terminal.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Occurrence Type Restrictions */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      Tipos de Ocorrência ({userOccTypes.length}/{OCCURRENCE_TYPES.length})
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                      {OCCURRENCE_TYPES.map(type => {
                        const isAllowed = userOccTypes.includes(type);
                        return (
                          <button
                            key={type}
                            onClick={() => toggleOccurrenceType(u.id, type)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all border ${
                              isAllowed
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-secondary/50 text-muted-foreground border-border line-through opacity-60'
                            }`}
                          >
                            {isAllowed ? <Siren size={12} /> : <X size={12} />}
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
