import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { RequireAuth } from './guards/RequireAuth';
import { RequireAccess } from './guards/RequireAccess';
import { AppShell } from './layout/AppShell';
import { EmergencyDispatchProvider, useEmergencyDispatch } from './layout/EmergencyDispatchProvider';
import { defaultPathForUser, pathForView, situationRoomPath } from './layout/nav-config';

// Telas (Etapa 1: permanecem em components/pae — movem para modules/ na Etapa 3)
import { LoginScreen } from '@/components/pae/LoginScreen';
import { MobileActionPanel } from '@/components/pae/MobileActionPanel';
import { MyPanelView } from '@/components/pae/MyPanelView';
import { COPView } from '@/components/pae/COPView';
import { DashboardView } from '@/components/pae/DashboardView';
import { TerminalsView } from '@/components/pae/TerminalsView';
import { EntitiesView } from '@/components/pae/EntitiesView';
import { UsersView } from '@/components/pae/UsersView';
import { PermissionsView } from '@/components/pae/PermissionsView';
import { AccessLevelsView } from '@/components/pae/AccessLevelsView';
import { NotificationRulesView } from '@/components/pae/NotificationRulesView';
import { OrchestrationView } from '@/components/pae/OrchestrationView';
import { AICommandView } from '@/components/pae/AICommandView';
import { RisksView } from '@/components/pae/RisksView';
import { PlansView } from '@/components/pae/PlansView';
import { OccurrencesView } from '@/components/pae/OccurrencesView';
import { SituationRoomView } from '@/components/pae/SituationRoomView';
import { EmergencyMapView } from '@/components/pae/EmergencyMapView';
import { DocumentsView } from '@/components/pae/DocumentsView';
import { BadgePAEView } from '@/components/pae/BadgePAEView';
import { OperationalSafetyView } from '@/components/pae/OperationalSafetyView';
import { TrainingsView } from '@/components/pae/TrainingsView';
import { EPIsView } from '@/components/pae/EPIsView';
import { ComplianceView } from '@/components/pae/ComplianceView';
import { ModulesView } from '@/components/pae/ModulesView';
import { OrgChartView } from '@/components/pae/OrgChartView';
import { AboutView } from '@/components/pae/AboutView';
import NotFound from '@/pages/NotFound';

/* ── Page wrappers ─────────────────────────────────────────────────────────── */

/** /login — pública; se já autenticado, volta para a rota de origem. */
function LoginPage() {
  const { user } = useAuth();
  const location = useLocation();
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from || '/'} replace />;
  }
  return <LoginScreen />;
}

/**
 * Rota index "/": no mobile exibe o painel de ações (tela cheia, sem shell);
 * no desktop redireciona para a rota inicial do perfil.
 */
function IndexGate() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { openDispatch } = useEmergencyDispatch();

  if (isMobile) {
    return (
      <MobileActionPanel
        onDispatchEmergency={openDispatch}
        onOpenSituationRoom={(id) => navigate(situationRoomPath(id))}
        onNavigate={(viewId) => navigate(pathForView(viewId))}
        onOpenFullSystem={() => navigate(defaultPathForUser(user))}
      />
    );
  }
  return <Navigate to={defaultPathForUser(user)} replace />;
}

/** Wrapper para telas que abrem a Sala de Situação via callback. */
function withSituationRoomNav(View: React.ComponentType<{ onOpenSituationRoom?: (id: string) => void }>) {
  return function PageWithSituationRoomNav() {
    const navigate = useNavigate();
    return <View onOpenSituationRoom={(id) => navigate(situationRoomPath(id))} />;
  };
}

const CopPage = withSituationRoomNav(COPView);
const OccurrencesPage = withSituationRoomNav(OccurrencesView);
const OrchestrationPage = withSituationRoomNav(OrchestrationView);

/** /ocorrencias/:id/sala-de-situacao — deep-link da Sala de Situação. */
function SituationRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useAuth();
  const navigate = useNavigate();

  const occurrence = data.occurrences.find(o => o.id === id);
  if (!id || !occurrence) return <Navigate to="/ocorrencias" replace />;

  // Volta no histórico quando possível; em deep-link direto, cai na lista.
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  return (
    <SituationRoomView
      occurrenceId={id}
      onBack={() => (canGoBack ? navigate(-1) : navigate('/ocorrencias'))}
    />
  );
}

/* ── Árvore de rotas ───────────────────────────────────────────────────────── */

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Autenticadas */}
        <Route element={<RequireAuth />}>
          <Route element={<EmergencyDispatchProvider />}>
            {/* Index: painel mobile (tela cheia) ou redirect por perfil */}
            <Route path="/" element={<IndexGate />} />

            {/* Shell (sidebar + header + footer) + guard de acesso por rota */}
            <Route element={<AppShell />}>
              <Route element={<RequireAccess />}>
              <Route path="/meu-painel" element={<MyPanelView />} />
              <Route path="/centro-de-operacoes" element={<CopPage />} />
              <Route path="/dashboard" element={<DashboardView />} />

              {/* PAE / Emergência */}
              <Route path="/ocorrencias" element={<OccurrencesPage />} />
              <Route path="/ocorrencias/:id/sala-de-situacao" element={<SituationRoomPage />} />
              <Route path="/orquestracao" element={<OrchestrationPage />} />
              <Route path="/ai-command" element={<AICommandView />} />
              <Route path="/riscos" element={<RisksView />} />
              <Route path="/planos-de-acao" element={<PlansView />} />
              <Route path="/mapa-de-emergencia" element={<EmergencyMapView />} />
              <Route path="/documentos" element={<DocumentsView />} />
              <Route path="/cracha-do-pae" element={<BadgePAEView />} />

              {/* Segurança Operacional */}
              <Route path="/seguranca" element={<OperationalSafetyView />} />
              <Route path="/seguranca/treinamentos" element={<TrainingsView />} />
              <Route path="/seguranca/epis" element={<EPIsView />} />
              <Route path="/seguranca/conformidade" element={<ComplianceView />} />

              {/* Administração */}
              <Route path="/terminais" element={<TerminalsView />} />
              <Route path="/entidades" element={<EntitiesView />} />
              <Route path="/usuarios" element={<UsersView />} />
              <Route path="/permissoes" element={<PermissionsView />} />
              <Route path="/niveis-de-acesso" element={<AccessLevelsView />} />
              <Route path="/acionamento-entidades" element={<NotificationRulesView />} />
              <Route path="/pacotes-do-sistema" element={<ModulesView />} />
              <Route path="/organograma" element={<OrgChartView />} />
              <Route path="/sobre" element={<AboutView />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
