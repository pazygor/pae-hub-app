import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useTerminals, useTerminalMutations } from '@/api';
import {
  PRODUCT_MODULES, COMMAND_BRAND, ProductModule, SafetySubModule,
  SAFETY_SUBMODULE_LABELS, getPackageName,
} from '@/lib/modules';
import { Puzzle, Check, X, Building2, Zap, Shield, Layers, GraduationCap, HardHat, ClipboardCheck, Loader2, Lock } from 'lucide-react';

const PACKAGE_CARDS = [
  { key: 'response' as const, icon: Zap, ...PRODUCT_MODULES.emergency_management },
  { key: 'safety' as const, icon: Shield, ...PRODUCT_MODULES.operational_safety },
  { key: 'command' as const, icon: Layers, label: COMMAND_BRAND.label, brandName: COMMAND_BRAND.brandName, description: COMMAND_BRAND.description },
];

const SUB_MODULE_ICONS: Record<SafetySubModule, React.ElementType> = {
  trainings: GraduationCap,
  epis: HardHat,
  compliance: ClipboardCheck,
};

// Toggles reais de Safety (Conformidade é derivada, não é toggle).
const SAFETY_TOGGLES: SafetySubModule[] = ['trainings', 'epis'];
const PRODUCT_MODULE_KEYS: ProductModule[] = ['emergency_management', 'operational_safety'];

/** Conformidade acende sozinha quando há Treinamento OU EPI. */
const hasCompliance = (subs: SafetySubModule[]) => subs.includes('trainings') || subs.includes('epis');

type Cfg = { modules: ProductModule[]; safetySubs: SafetySubModule[] };

export function ModulesPage() {
  const { user } = useAuth();
  const { data: terminals = [], isLoading, isError } = useTerminals();
  const { updateModules } = useTerminalMutations();
  // Edições locais por terminal (só o que foi mexido); o resto reflete a API.
  const [edits, setEdits] = useState<Record<string, Cfg>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!user || user.role !== 'admin') {
    return <p className="text-muted-foreground text-sm">Acesso restrito ao administrador.</p>;
  }

  const cfgOf = (t: { id: string; activeModules?: string[]; activeSafetySubModules?: string[] }): Cfg =>
    edits[t.id] ?? {
      modules: (t.activeModules ?? []) as ProductModule[],
      safetySubs: (t.activeSafetySubModules ?? []) as SafetySubModule[],
    };
  const isDirty = (id: string) => !!edits[id];

  const setCfg = (id: string, next: Cfg) => setEdits(prev => ({ ...prev, [id]: next }));

  const toggleModule = (t: any, mod: ProductModule) => {
    const cur = cfgOf(t);
    const has = cur.modules.includes(mod);
    const modules = has ? cur.modules.filter(m => m !== mod) : [...cur.modules, mod];
    // Desligou Safety → zera os sub-módulos.
    const safetySubs = modules.includes('operational_safety') ? cur.safetySubs : [];
    setCfg(t.id, { modules, safetySubs });
  };

  const toggleSub = (t: any, sub: SafetySubModule) => {
    const cur = cfgOf(t);
    const has = cur.safetySubs.includes(sub);
    setCfg(t.id, { ...cur, safetySubs: has ? cur.safetySubs.filter(s => s !== sub) : [...cur.safetySubs, sub] });
  };

  const save = (t: any) => {
    const cur = cfgOf(t);
    setSavingId(t.id);
    updateModules.mutate(
      { id: t.id, activeModules: cur.modules, activeSafetySubModules: cur.safetySubs.filter(s => s !== 'compliance') },
      {
        onSuccess: () => { setEdits(prev => { const n = { ...prev }; delete n[t.id]; return n; }); toast.success(`Módulos de "${t.name}" salvos`); },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar módulos'),
        onSettled: () => setSavingId(null),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Puzzle size={20} className="text-primary" />
        <div>
          <h2 className="text-lg font-black uppercase tracking-wider text-foreground">Pacotes do Sistema</h2>
          <p className="text-xs text-muted-foreground">Gerencie os pacotes e módulos ativos por terminal (empresa-cliente)</p>
        </div>
      </div>

      {/* Package cards (informativo) */}
      <div className="grid md:grid-cols-3 gap-4">
        {PACKAGE_CARDS.map(pkg => (
          <div key={pkg.key} className={`bg-card border rounded-xl p-5 ${pkg.key === 'command' ? 'border-primary/30 ring-1 ring-primary/10' : ''}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pkg.key === 'command' ? 'bg-primary/15' : 'bg-secondary'}`}>
                <pkg.icon size={20} className={pkg.key === 'command' ? 'text-primary' : 'text-muted-foreground'} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">M1 PAE Hub</p>
                <h4 className="text-sm font-black text-foreground tracking-tight">{pkg.label}</h4>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{pkg.description}</p>
            {pkg.key === 'command' && (
              <div className="mt-3">
                <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded">Pacote Completo</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Config por terminal */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Building2 size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Configuração por Terminal</h3>
        </div>

        {isLoading && <p className="px-5 py-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando terminais...</p>}
        {isError && !isLoading && <p className="px-5 py-6 text-sm text-primary">Falha ao carregar os terminais.</p>}
        {!isLoading && !isError && terminals.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground italic">Nenhum terminal cadastrado.</p>}

        <div className="divide-y divide-border">
          {terminals.map(terminal => {
            const cfg = cfgOf(terminal);
            const pkgName = getPackageName(cfg.modules);
            const hasSafety = cfg.modules.includes('operational_safety');
            const compliance = hasCompliance(cfg.safetySubs);
            const dirty = isDirty(terminal.id);
            return (
              <div key={terminal.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{terminal.name}</p>
                    <p className="text-[10px] text-muted-foreground">{terminal.location}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{pkgName}</span>
                    <button
                      onClick={() => save(terminal)}
                      disabled={!dirty || savingId === terminal.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingId === terminal.id && <Loader2 size={12} className="animate-spin" />}
                      {dirty ? 'Salvar' : 'Salvo'}
                    </button>
                  </div>
                </div>

                {/* Pacotes */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Pacotes</p>
                  <div className="flex gap-3 flex-wrap">
                    {PRODUCT_MODULE_KEYS.map(key => {
                      const isActive = cfg.modules.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleModule(terminal, key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                            isActive ? 'bg-success/10 border-success/30 text-success' : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/30'
                          }`}
                        >
                          {isActive ? <Check size={14} /> : <X size={14} />}
                          {PRODUCT_MODULES[key].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Safety sub-módulos */}
                {hasSafety && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Módulos Safety</p>
                    <div className="flex gap-2 flex-wrap items-center">
                      {SAFETY_TOGGLES.map(sub => {
                        const isActive = cfg.safetySubs.includes(sub);
                        const Icon = SUB_MODULE_ICONS[sub];
                        return (
                          <button
                            key={sub}
                            onClick={() => toggleSub(terminal, sub)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
                              isActive ? 'bg-success/10 border-success/30 text-success' : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/30'
                            }`}
                          >
                            <Icon size={13} />
                            {isActive ? <Check size={12} /> : <X size={12} />}
                            {SAFETY_SUBMODULE_LABELS[sub]}
                          </button>
                        );
                      })}
                      {/* Conformidade — derivada (não é toggle) */}
                      <div
                        title="Ativada automaticamente quando há Treinamento ou EPI"
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          compliance ? 'bg-success/10 border-success/30 text-success' : 'bg-secondary/30 border-border text-muted-foreground'
                        }`}
                      >
                        <ClipboardCheck size={13} />
                        <Lock size={11} />
                        {SAFETY_SUBMODULE_LABELS.compliance}
                        <span className="text-[9px] uppercase font-bold opacity-70">(auto)</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">A <strong>Conformidade</strong> é ativada automaticamente quando o terminal tem <strong>Treinamento</strong> ou <strong>EPI</strong>.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
