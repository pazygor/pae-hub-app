import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getAccessLevelMenuFilter } from '@/lib/access-control';
import { GlobalSearch } from './GlobalSearch';
import { LoginScreen } from './LoginScreen';
import { MobileActionPanel } from './MobileActionPanel';
import { AppSidebar } from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { DashboardView } from './DashboardView';
import { TerminalsView } from './TerminalsView';
import { EntitiesView } from './EntitiesView';
import { UsersView } from './UsersView';
import { PermissionsView } from './PermissionsView';
import { RisksView } from './RisksView';
import { PlansView } from './PlansView';
import { OccurrencesView } from './OccurrencesView';
import { EmergencyMapView } from './EmergencyMapView';
import { COPView } from './COPView';
import { DocumentsView } from './DocumentsView';
import { SituationRoomView } from './SituationRoomView';
import { AboutView } from './AboutView';
import { BadgePAEView } from './BadgePAEView';
import { AccessLevelsView } from './AccessLevelsView';
import { NotificationRulesView } from './NotificationRulesView';
import { OrchestrationView } from './OrchestrationView';
import { AICommandView } from './AICommandView';
import { TrainingsView } from './TrainingsView';
import { EPIsView } from './EPIsView';
import { OperationalSafetyView } from './OperationalSafetyView';
import { ComplianceView } from './ComplianceView';
import { ModulesView } from './ModulesView';
import { MyPanelView } from './MyPanelView';
import { OrgChartView } from './OrgChartView';
import { Menu, Siren, X, Search, Eye, EyeOff, AlertTriangle as AlertTriangleIcon, GraduationCap, HardHat, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Occurrence, SeverityLevel, EntityNotification } from '@/lib/types';
import { usePresentationMode, maskEmail } from '@/lib/presentation-mode';
import { getDefaultSafetySubModules, getDefaultModules, isMenuItemAccessible } from '@/lib/modules';

function ContentRender({ view, onOpenSituationRoom }: { view: string; onOpenSituationRoom: (id: string) => void }) {
  switch (view) {
    case 'my-panel': return <MyPanelView />;
    case 'cop': return <COPView onOpenSituationRoom={onOpenSituationRoom} />;
    case 'dashboard': return <DashboardView />;
    case 'terminals': return <TerminalsView />;
    case 'entities': return <EntitiesView />;
    case 'users': return <UsersView />;
    case 'permissions': return <PermissionsView />;
    case 'access-levels': return <AccessLevelsView />;
    case 'notification-rules': return <NotificationRulesView />;
    case 'orchestration': return <OrchestrationView onOpenSituationRoom={onOpenSituationRoom} />;
    case 'ai-command': return <AICommandView />;
    case 'safety': return <OperationalSafetyView />;
    case 'trainings': return <TrainingsView />;
    case 'epis': return <EPIsView />;
    case 'compliance': return <ComplianceView />;
    case 'risks': return <RisksView />;
    case 'plans': return <PlansView />;
    case 'occurrences': return <OccurrencesView onOpenSituationRoom={onOpenSituationRoom} />;
    case 'map': return <EmergencyMapView />;
    case 'documents': return <DocumentsView />;
    case 'badge': return <BadgePAEView />;
    case 'modules': return <ModulesView />;
    case 'org-chart': return <OrgChartView />;
    case 'about': return <AboutView />;
    default: return <div className="text-muted-foreground italic">Módulo em desenvolvimento.</div>;
  }
}

const viewLabels: Record<string, string> = {
  'my-panel': 'Meu Painel',
  cop: 'Centro de Operações',
  dashboard: 'Dashboard',
  terminals: 'Terminais',
  entities: 'Entidades',
  users: 'Usuários',
  permissions: 'Permissões',
  'access-levels': 'Níveis de Acesso',
  'notification-rules': 'Acionamento de Entidades',
  orchestration: 'Orquestração de Emergência',
  'ai-command': 'AI Command',
  safety: 'Centro de Segurança Operacional',
  trainings: 'Centro de Segurança Operacional',
  epis: 'Centro de Segurança Operacional',
  compliance: 'Centro de Segurança Operacional',
  risks: 'Riscos',
  plans: 'Planos de Ação',
  occurrences: 'Ocorrências',
  map: 'Mapa de Emergência',
  documents: 'Biblioteca de Documentos',
  badge: 'Crachá do PAE',
  modules: 'Pacotes do Sistema',
  'org-chart': 'Organograma',
  about: 'Sobre o Sistema',
};

export function PAESystem() {
  const { presentationMode, togglePresentationMode } = usePresentationMode();
  const { user, data, setData } = useAuth();
  const isMobile = useIsMobile();
  const [mobileFullSystem, setMobileFullSystem] = useState(false);
  const [view, setView] = useState(() => {
    // Operacional users default to personal panel
    if (user && user.role !== 'admin' && user.accessLevel === 'operacional') return 'my-panel';
    return 'dashboard';
  });

  // Guard: redirect if user navigates to a restricted view (access level + module licensing)
  const accessFilter = getAccessLevelMenuFilter(user);
  const userActiveConfig = (() => {
    if (!user || user.role === 'admin') return { modules: getDefaultModules(), safetySubModules: getDefaultSafetySubModules() };
    const terminalId = user.linkId;
    if (!terminalId) return { modules: getDefaultModules(), safetySubModules: getDefaultSafetySubModules() };
    const config = data.terminalModules?.find(tm => tm.terminalId === terminalId);
    return {
      modules: config ? config.activeModules : getDefaultModules(),
      safetySubModules: config?.activeSafetySubModules ?? getDefaultSafetySubModules(),
    };
  })();

  const guardedSetView = (v: string) => {
    // Block by access level
    if (accessFilter && !accessFilter.has(v)) {
      setView('my-panel');
      return;
    }
    // Block by module licensing (non-admin)
    if (user && user.role !== 'admin' && !isMenuItemAccessible(v, userActiveConfig.modules, userActiveConfig.safetySubModules)) {
      setView('my-panel');
      return;
    }
    setView(v);
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [situationRoomOccId, setSituationRoomOccId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({
    description: '',
    severity: 'alta' as SeverityLevel,
    terminalId: '',
  });

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSearch(s => !s);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!user) return <LoginScreen />;

  // === Pendency alert calculation ===
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const activeSubs = (() => {
    if (user.role === 'admin') return getDefaultSafetySubModules();
    const config = data.terminalModules?.find(tm => tm.terminalId === user.linkId);
    return config?.activeSafetySubModules ?? getDefaultSafetySubModules();
  })();
  const pendingTrainings = activeSubs.includes('trainings')
    ? data.trainings.filter(t => t.mandatory && !data.userTrainings.some(ut => ut.userId === user.id && ut.trainingId === t.id && new Date(ut.expiryDate) >= now)).length
    : 0;
  const expiredTrainings = activeSubs.includes('trainings')
    ? data.userTrainings.filter(ut => ut.userId === user.id && new Date(ut.expiryDate) < now).length
    : 0;
  const expiredEPIs = activeSubs.includes('epis')
    ? data.userEPIs.filter(ue => ue.userId === user.id && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido' && ue.expiryDate && new Date(ue.expiryDate) < now).length
    : 0;
  const soonEPIs = activeSubs.includes('epis')
    ? data.userEPIs.filter(ue => ue.userId === user.id && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido' && ue.expiryDate && new Date(ue.expiryDate) >= now && new Date(ue.expiryDate) <= soonThreshold).length
    : 0;
  const ncCompliance = activeSubs.includes('compliance')
    ? (data.complianceItems || []).filter(ci => ci.status === 'nao_conforme' && (ci.userId === user.id || ci.responsible === user.name)).length
    : 0;
  const totalPendencies = pendingTrainings + expiredTrainings + expiredEPIs + soonEPIs + ncCompliance;
  const showPendencyAlert = totalPendencies > 0 && !alertDismissed;

  // Mobile Action Panel (unless user chose full system)
  if (isMobile && !mobileFullSystem && !situationRoomOccId) {
    return (
      <>
        <MobileActionPanel
          onDispatchEmergency={() => {
            setEmergencyForm({
              description: '',
              severity: 'alta',
              terminalId: user.role === 'terminal' ? (user.linkId || '') : '',
            });
            setShowEmergencyModal(true);
            setMobileFullSystem(true);
          }}
          onOpenSituationRoom={(id) => {
            setSituationRoomOccId(id);
            setMobileFullSystem(true);
          }}
          onNavigate={(v) => {
            guardedSetView(v);
            setMobileFullSystem(true);
          }}
          onOpenFullSystem={() => setMobileFullSystem(true)}
        />
      </>
    );
  }

  const canDispatchEmergency = user.role === 'admin' || user.role === 'terminal';
  const roleLabel = user.role === 'admin' ? 'ADMIN' : user.role === 'terminal' ? 'TERMINAL' : 'ENTIDADE';

  const visibleTerminals = user.role === 'admin'
    ? data.terminals
    : user.role === 'terminal' && user.linkId
      ? data.terminals.filter(t => t.id === user.linkId)
      : [];

  const generateIncNumber = () => {
    const existing = data.occurrences
      .map(o => o.incNumber)
      .filter(n => n && n.startsWith('INC-'))
      .map(n => parseInt(n.replace('INC-', ''), 10))
      .filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return `INC-${next.toString().padStart(4, '0')}`;
  };

  const handleEmergencyDispatch = () => {
    if (!emergencyForm.description) return;
    const terminalId = emergencyForm.terminalId || (user.role === 'terminal' ? user.linkId! : visibleTerminals[0]?.id);
    if (!terminalId) return;
    const now = new Date().toISOString();
    const ts = Date.now();
    const incNumber = generateIncNumber();
    const occId = `o${ts}`;

    // Find matching notification rules for 'Emergência' type
    const matchingRules = data.notificationRules.filter(r => r.occurrenceType === 'Emergência');

    // Build notification timeline events
    const notificationEvents = matchingRules.map((rule, idx) => {
      const entityName = data.entities.find(e => e.id === rule.entityId)?.name || rule.entityId;
      const contact = data.entities.find(e => e.id === rule.entityId)?.contact || '';
      return {
        id: `tl${ts + 2 + idx}`,
        dateTime: now,
        type: 'entidade notificada' as const,
        description: `${entityName} notificada automaticamente${contact ? ` via ${contact}` : ''}${rule.mandatory ? ' [OBRIGATÓRIA]' : ''}`,
        userName: 'Sistema',
      };
    });

    // Build entity notification records
    const newNotifications: EntityNotification[] = matchingRules.map((rule, idx) => ({
      id: `en${ts + idx}`,
      occurrenceId: occId,
      entityId: rule.entityId,
      dateTime: now,
      status: 'Notificada' as const,
      mandatory: rule.mandatory,
    }));

    const newOcc: Occurrence = {
      id: occId,
      incNumber,
      terminalId,
      dateTime: now,
      type: 'Emergência',
      description: emergencyForm.description,
      status: 'emergência ativa',
      criticality: 'alta',
      severity: emergencyForm.severity,
      responsible: user.name,
      team: '',
      timeline: [
        { id: `tl${ts}`, dateTime: now, type: 'ocorrência registrada', description: `[DISPARO DE EMERGÊNCIA] ${emergencyForm.description}`, userName: user.name },
        { id: `tl${ts + 1}`, dateTime: now, type: 'plano de emergência ativado', description: `Emergência disparada com severidade ${emergencyForm.severity.toUpperCase()} — resposta imediata iniciada`, userName: user.name },
        ...notificationEvents,
      ],
    };
    setData(d => ({
      ...d,
      occurrences: [...d.occurrences, newOcc],
      entityNotifications: [...d.entityNotifications, ...newNotifications],
    }));
    setShowEmergencyModal(false);
    setEmergencyForm({ description: '', severity: 'alta', terminalId: '' });
    setSituationRoomOccId(newOcc.id);
  };

  return (
    <div className="flex h-svh bg-background overflow-hidden">
      {/* Pendency Alert Modal */}
      <AnimatePresence>
        {showPendencyAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setAlertDismissed(true)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card border-2 border-warning/30 rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-warning/10 px-6 py-4 flex items-center gap-3 border-b border-warning/20">
                <div className="p-2 bg-warning/20 rounded-lg">
                  <AlertTriangleIcon size={20} className="text-warning" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wide">Pendências Operacionais</h3>
                  <p className="text-[11px] text-muted-foreground">Você possui itens que requerem atenção</p>
                </div>
                <button onClick={() => setAlertDismissed(true)} className="ml-auto p-1.5 rounded-lg hover:bg-secondary transition-colors">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {(pendingTrainings > 0 || expiredTrainings > 0) && (
                  <div className={`flex items-center justify-between p-3 rounded-xl border ${expiredTrainings > 0 ? 'border-primary/30 bg-primary/5' : 'border-warning/30 bg-warning/5'}`}>
                    <div className="flex items-center gap-3">
                      <GraduationCap size={18} className={expiredTrainings > 0 ? 'text-primary' : 'text-warning'} />
                      <div>
                        <p className="text-xs font-bold text-foreground">Treinamentos</p>
                        <p className="text-[10px] text-muted-foreground">
                          {pendingTrainings > 0 && <span>{pendingTrainings} pendente{pendingTrainings > 1 ? 's' : ''}</span>}
                          {pendingTrainings > 0 && expiredTrainings > 0 && <span> · </span>}
                          {expiredTrainings > 0 && <span className="text-primary font-bold">{expiredTrainings} vencido{expiredTrainings > 1 ? 's' : ''}</span>}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => { setView('my-panel'); setAlertDismissed(true); }}
                      className="px-3 py-1.5 text-[10px] font-bold bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors">
                      Ver Treinamentos
                    </button>
                  </div>
                )}
                {(expiredEPIs > 0 || soonEPIs > 0) && (
                  <div className={`flex items-center justify-between p-3 rounded-xl border ${expiredEPIs > 0 ? 'border-primary/30 bg-primary/5' : 'border-warning/30 bg-warning/5'}`}>
                    <div className="flex items-center gap-3">
                      <HardHat size={18} className={expiredEPIs > 0 ? 'text-primary' : 'text-warning'} />
                      <div>
                        <p className="text-xs font-bold text-foreground">EPIs</p>
                        <p className="text-[10px] text-muted-foreground">
                          {expiredEPIs > 0 && <span className="text-primary font-bold">{expiredEPIs} vencido{expiredEPIs > 1 ? 's' : ''}</span>}
                          {expiredEPIs > 0 && soonEPIs > 0 && <span> · </span>}
                          {soonEPIs > 0 && <span>{soonEPIs} próximo{soonEPIs > 1 ? 's' : ''} do vencimento</span>}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => { setView('my-panel'); setAlertDismissed(true); }}
                      className="px-3 py-1.5 text-[10px] font-bold bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors">
                      Ver EPIs
                    </button>
                  </div>
                )}
                {ncCompliance > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck size={18} className="text-primary" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Conformidade</p>
                        <p className="text-[10px] text-primary font-bold">{ncCompliance} item{ncCompliance > 1 ? 'ns' : ''} não conforme{ncCompliance > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <button onClick={() => { setView('my-panel'); setAlertDismissed(true); }}
                      className="px-3 py-1.5 text-[10px] font-bold bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors">
                      Ver Conformidade
                    </button>
                  </div>
                )}
              </div>
              <div className="px-5 pb-5">
                <button onClick={() => setAlertDismissed(true)}
                  className="w-full py-2.5 text-xs font-bold bg-secondary text-muted-foreground rounded-xl hover:bg-secondary/80 transition-colors">
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <GlobalSearch
        open={showSearch}
        onOpenChange={setShowSearch}
        onNavigate={(v) => { guardedSetView(v); setSituationRoomOccId(null); }}
        onOpenSituationRoom={(id) => setSituationRoomOccId(id)}
      />
      <AppSidebar
        currentView={view}
        setView={guardedSetView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Global Emergency Alert */}
        {data.occurrences.some(o => o.status === 'emergência ativa') && (
          <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-2 shrink-0 animate-pulse">
            <Siren size={16} />
            <span className="text-xs font-black uppercase tracking-widest">⚠ EMERGÊNCIA ATIVA ⚠</span>
            <span className="text-[10px] font-bold opacity-80">
              — {data.occurrences.filter(o => o.status === 'emergência ativa').map(o => {
                const t = data.terminals.find(t => t.id === o.terminalId);
                return t ? t.name : o.type;
              }).join(' | ')}
            </span>
          </div>
        )}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && mobileFullSystem && (
              <button
                onClick={() => { setMobileFullSystem(false); setSituationRoomOccId(null); }}
                className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors text-[11px] font-bold"
              >
                ← Painel
              </button>
            )}
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-primary">M1</span>
              <span className="text-[10px] text-muted-foreground">|</span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {situationRoomOccId ? 'Sala de Situação' : (viewLabels[view] || view)}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePresentationMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg transition-colors border ${
                presentationMode
                  ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                  : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80 hover:text-foreground'
              }`}
              title={presentationMode ? 'Desativar modo apresentação' : 'Ativar modo apresentação'}
            >
              {presentationMode ? <EyeOff size={14} /> : <Eye size={14} />}
              <span className="hidden sm:inline">{presentationMode ? 'Apresentação' : 'Apresentar'}</span>
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary text-muted-foreground text-[11px] rounded-lg hover:bg-secondary/80 hover:text-foreground transition-colors border border-border"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
            </button>
            {canDispatchEmergency && (
              <button
                onClick={() => {
                  setEmergencyForm({
                    description: '',
                    severity: 'alta',
                    terminalId: user.role === 'terminal' ? (user.linkId || '') : '',
                  });
                  setShowEmergencyModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-lg shadow-lg shadow-primary/30 hover:brightness-110 transition-all animate-pulse hover:animate-none"
              >
                <Siren size={14} />
                <span className="hidden sm:inline">Disparar Emergência</span>
              </button>
            )}
            <span className="text-[9px] font-medium px-2 py-0.5 bg-accent/10 text-accent rounded-full border border-accent/20 hidden md:inline">DEMO</span>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">{roleLabel}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{presentationMode ? maskEmail(user.email) : user.email}</span>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {situationRoomOccId ? (
            <SituationRoomView
              occurrenceId={situationRoomOccId}
              onBack={() => setSituationRoomOccId(null)}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              >
                <ContentRender view={view} onOpenSituationRoom={(id) => setSituationRoomOccId(id)} />
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        <footer className="h-10 border-t border-border bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-primary">M1</span>
            <span className="text-[10px] text-muted-foreground">PAE Hub — Plataforma de Gestão de Emergências Operacionais</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">2026</span>
            <span className="text-[10px] text-muted-foreground">© M1 – Todos os direitos reservados</span>
          </div>
        </footer>
      </main>

      {/* Emergency Dispatch Modal */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowEmergencyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-card border-2 border-primary/30 rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-primary px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-foreground/20 rounded-lg">
                    <Siren size={20} className="text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-primary-foreground uppercase tracking-wide">Disparar Emergência</h3>
                    <p className="text-[11px] text-primary-foreground/70">Criar ocorrência crítica com resposta imediata</p>
                  </div>
                </div>
                <button onClick={() => setShowEmergencyModal(false)} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
                  <X size={18} className="text-primary-foreground" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
                  <Siren size={16} className="text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium">
                    Esta ação criará uma ocorrência com criticidade <strong>Alta</strong> e status <strong>Emergência Ativa</strong>. A Sala de Situação será aberta automaticamente.
                  </p>
                </div>

                {user.role === 'admin' && visibleTerminals.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Terminal</label>
                    <select
                      value={emergencyForm.terminalId}
                      onChange={e => setEmergencyForm(f => ({ ...f, terminalId: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecione o terminal...</option>
                      {visibleTerminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Descrição da emergência *</label>
                  <textarea
                    value={emergencyForm.description}
                    onChange={e => setEmergencyForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descreva brevemente a situação de emergência..."
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Grau de Severidade *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['baixa', 'média', 'alta'] as SeverityLevel[]).map(sev => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setEmergencyForm(f => ({ ...f, severity: sev }))}
                        className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                          emergencyForm.severity === sev
                            ? sev === 'alta'
                              ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30'
                              : sev === 'média'
                                ? 'bg-warning text-warning-foreground border-warning shadow-lg shadow-warning/30'
                                : 'bg-success text-success-foreground border-success shadow-lg shadow-success/30'
                            : 'bg-secondary text-secondary-foreground border-border hover:border-muted-foreground'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowEmergencyModal(false)}
                    className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold hover:bg-secondary/80 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEmergencyDispatch}
                    disabled={!emergencyForm.description || (user.role === 'admin' && visibleTerminals.length > 1 && !emergencyForm.terminalId)}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-black uppercase tracking-wider shadow-lg shadow-primary/30 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Siren size={16} />
                    Disparar Emergência
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
