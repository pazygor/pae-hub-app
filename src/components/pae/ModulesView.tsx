import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PRODUCT_MODULES, COMMAND_BRAND, ProductModule, SafetySubModule, ALL_SAFETY_SUBMODULES, SAFETY_SUBMODULE_LABELS, TerminalModuleConfig, getDefaultModules, getDefaultSafetySubModules, getPackageName } from '@/lib/modules';
import { Puzzle, Check, X, Save, Building2, Zap, Shield, Layers, GraduationCap, HardHat, ClipboardCheck } from 'lucide-react';

const PACKAGE_CARDS = [
  {
    key: 'response' as const,
    module: 'emergency_management' as ProductModule,
    icon: Zap,
    ...PRODUCT_MODULES.emergency_management,
  },
  {
    key: 'safety' as const,
    module: 'operational_safety' as ProductModule,
    icon: Shield,
    ...PRODUCT_MODULES.operational_safety,
  },
  {
    key: 'command' as const,
    module: null,
    icon: Layers,
    label: COMMAND_BRAND.label,
    brandName: COMMAND_BRAND.brandName,
    description: COMMAND_BRAND.description,
  },
];

const SUB_MODULE_ICONS: Record<SafetySubModule, React.ElementType> = {
  trainings: GraduationCap,
  epis: HardHat,
  compliance: ClipboardCheck,
};

export function ModulesView() {
  const { user, data, setData } = useAuth();

  const [configs, setConfigs] = useState<Record<string, { modules: ProductModule[]; safetySubs: SafetySubModule[] }>>(() => {
    const map: Record<string, { modules: ProductModule[]; safetySubs: SafetySubModule[] }> = {};
    for (const t of data.terminals) {
      const existing = data.terminalModules?.find(tm => tm.terminalId === t.id);
      map[t.id] = {
        modules: existing ? [...existing.activeModules] : getDefaultModules(),
        safetySubs: existing?.activeSafetySubModules ? [...existing.activeSafetySubModules] : getDefaultSafetySubModules(),
      };
    }
    return map;
  });

  const [saved, setSaved] = useState(false);

  if (!user || user.role !== 'admin') {
    return <p className="text-muted-foreground text-sm">Acesso restrito ao administrador.</p>;
  }

  const toggleModule = (terminalId: string, mod: ProductModule) => {
    setConfigs(prev => {
      const current = prev[terminalId];
      const has = current.modules.includes(mod);
      const newModules = has ? current.modules.filter(m => m !== mod) : [...current.modules, mod];
      // If disabling operational_safety, clear sub-modules
      const newSafetySubs = !newModules.includes('operational_safety') ? [] : current.safetySubs;
      return { ...prev, [terminalId]: { modules: newModules, safetySubs: newSafetySubs } };
    });
    setSaved(false);
  };

  const toggleSubModule = (terminalId: string, sub: SafetySubModule) => {
    setConfigs(prev => {
      const current = prev[terminalId];
      const has = current.safetySubs.includes(sub);
      return { ...prev, [terminalId]: { ...current, safetySubs: has ? current.safetySubs.filter(s => s !== sub) : [...current.safetySubs, sub] } };
    });
    setSaved(false);
  };

  const saveAll = () => {
    const terminalModules: TerminalModuleConfig[] = Object.entries(configs).map(([terminalId, cfg]) => ({
      terminalId,
      activeModules: cfg.modules,
      activeSafetySubModules: cfg.safetySubs,
    }));
    setData(d => ({ ...d, terminalModules }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const allModules = Object.entries(PRODUCT_MODULES) as [ProductModule, typeof PRODUCT_MODULES[ProductModule]][];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Puzzle size={20} className="text-primary" />
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-foreground">Pacotes do Sistema</h2>
            <p className="text-xs text-muted-foreground">Gerencie os pacotes e módulos ativos por terminal</p>
          </div>
        </div>
        <button onClick={saveAll} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 transition-all">
          <Save size={14} />
          {saved ? 'Salvo!' : 'Salvar Configuração'}
        </button>
      </div>

      {/* Package cards */}
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
              <div className="mt-3 flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded">Pacote Completo</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Terminal configs */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Building2 size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Configuração por Terminal</h3>
        </div>
        <div className="divide-y divide-border">
          {data.terminals.map(terminal => {
            const cfg = configs[terminal.id] || { modules: [], safetySubs: [] };
            const pkgName = getPackageName(cfg.modules);
            const hasSafety = cfg.modules.includes('operational_safety');
            return (
              <div key={terminal.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{terminal.name}</p>
                    <p className="text-[10px] text-muted-foreground">{terminal.location}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {pkgName}
                  </span>
                </div>

                {/* Product modules */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Pacotes</p>
                  <div className="flex gap-3 flex-wrap">
                    {allModules.map(([key, mod]) => {
                      const isActive = cfg.modules.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleModule(terminal.id, key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            isActive
                              ? 'bg-success/10 border-success/30 text-success'
                              : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/30'
                          }`}
                        >
                          {isActive ? <Check size={14} /> : <X size={14} />}
                          {mod.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Safety sub-modules */}
                {hasSafety && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Módulos Safety</p>
                    <div className="flex gap-2 flex-wrap">
                      {ALL_SAFETY_SUBMODULES.map(sub => {
                        const isActive = cfg.safetySubs.includes(sub);
                        const Icon = SUB_MODULE_ICONS[sub];
                        return (
                          <button
                            key={sub}
                            onClick={() => toggleSubModule(terminal.id, sub)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              isActive
                                ? 'bg-success/10 border-success/30 text-success'
                                : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/30'
                            }`}
                          >
                            <Icon size={13} />
                            {isActive ? <Check size={12} /> : <X size={12} />}
                            {SAFETY_SUBMODULE_LABELS[sub]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-secondary/30 border rounded-xl p-5">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Resumo por Terminal</h4>
        <div className="grid md:grid-cols-3 gap-4">
          {data.terminals.map(terminal => {
            const cfg = configs[terminal.id] || { modules: [], safetySubs: [] };
            const pkgName = getPackageName(cfg.modules);
            const hasSafety = cfg.modules.includes('operational_safety');
            return (
              <div key={terminal.id} className="bg-card border rounded-lg p-3">
                <p className="text-xs font-semibold text-foreground mb-1">{terminal.name}</p>
                <p className="text-[10px] font-bold text-primary mb-2">{pkgName}</p>
                <div className="space-y-1">
                  {allModules.map(([key, mod]) => (
                    <div key={key} className="flex items-center gap-2 text-[10px]">
                      {cfg.modules.includes(key) ? <Check size={10} className="text-success" /> : <X size={10} className="text-muted-foreground" />}
                      <span className={cfg.modules.includes(key) ? 'text-foreground' : 'text-muted-foreground line-through'}>{mod.label}</span>
                    </div>
                  ))}
                  {hasSafety && ALL_SAFETY_SUBMODULES.map(sub => (
                    <div key={sub} className="flex items-center gap-2 text-[10px] pl-3">
                      {cfg.safetySubs.includes(sub) ? <Check size={10} className="text-success" /> : <X size={10} className="text-muted-foreground" />}
                      <span className={cfg.safetySubs.includes(sub) ? 'text-foreground' : 'text-muted-foreground line-through'}>{SAFETY_SUBMODULE_LABELS[sub]}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
