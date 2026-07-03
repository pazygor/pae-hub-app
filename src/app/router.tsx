import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { defaultPathForUser, pathForView, situationRoomPath } from '@/lib/nav-config';
import { RequireAuth } from './guards/RequireAuth';
import { RequireAccess } from './guards/RequireAccess';
import { AppShell } from './layout/AppShell';
import { EmergencyDispatchProvider, useEmergencyDispatch } from './layout/EmergencyDispatchProvider';

// Eager: entrada da aplicação e painel de emergência mobile (precisam ser instantâneos)
import { MobileActionPanel } from '@/components/common/MobileActionPanel';
import { NotFoundPage } from '@/components/common/NotFoundPage';
import { LoginPage } from '@/modules/auth';

// Lazy: páginas do shell (code-splitting por rota — recharts/leaflet/jspdf só
// são baixados quando a tela que os usa é visitada)
const MyPanelPage = lazy(() => import('@/modules/panel/pages/MyPanelPage').then(m => ({ default: m.MyPanelPage })));
const CopPage = lazy(() => import('@/modules/operations/pages/CopPage').then(m => ({ default: m.CopPage })));
const DashboardPage = lazy(() => import('@/modules/operations/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const OccurrencesPage = lazy(() => import('@/modules/emergency/pages/OccurrencesPage').then(m => ({ default: m.OccurrencesPage })));
const SituationRoomPage = lazy(() => import('@/modules/emergency/pages/SituationRoomPage').then(m => ({ default: m.SituationRoomPage })));
const OrchestrationPage = lazy(() => import('@/modules/emergency/pages/OrchestrationPage').then(m => ({ default: m.OrchestrationPage })));
const AiCommandPage = lazy(() => import('@/modules/emergency/pages/AiCommandPage').then(m => ({ default: m.AiCommandPage })));
const RisksPage = lazy(() => import('@/modules/emergency/pages/RisksPage').then(m => ({ default: m.RisksPage })));
const PlansPage = lazy(() => import('@/modules/emergency/pages/PlansPage').then(m => ({ default: m.PlansPage })));
const EmergencyMapPage = lazy(() => import('@/modules/emergency/pages/EmergencyMapPage').then(m => ({ default: m.EmergencyMapPage })));
const DocumentsPage = lazy(() => import('@/modules/emergency/pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const BadgePage = lazy(() => import('@/modules/emergency/pages/BadgePage').then(m => ({ default: m.BadgePage })));
const SafetyOverviewPage = lazy(() => import('@/modules/safety/pages/SafetyOverviewPage').then(m => ({ default: m.SafetyOverviewPage })));
const TrainingsPage = lazy(() => import('@/modules/safety/pages/TrainingsPage').then(m => ({ default: m.TrainingsPage })));
const EpisPage = lazy(() => import('@/modules/safety/pages/EpisPage').then(m => ({ default: m.EpisPage })));
const CompliancePage = lazy(() => import('@/modules/safety/pages/CompliancePage').then(m => ({ default: m.CompliancePage })));
const TerminalsPage = lazy(() => import('@/modules/admin/pages/TerminalsPage').then(m => ({ default: m.TerminalsPage })));
const EntitiesPage = lazy(() => import('@/modules/admin/pages/EntitiesPage').then(m => ({ default: m.EntitiesPage })));
const UsersPage = lazy(() => import('@/modules/admin/pages/UsersPage').then(m => ({ default: m.UsersPage })));
const PermissionsPage = lazy(() => import('@/modules/admin/pages/PermissionsPage').then(m => ({ default: m.PermissionsPage })));
const AccessLevelsPage = lazy(() => import('@/modules/admin/pages/AccessLevelsPage').then(m => ({ default: m.AccessLevelsPage })));
const NotificationRulesPage = lazy(() => import('@/modules/admin/pages/NotificationRulesPage').then(m => ({ default: m.NotificationRulesPage })));
const ModulesPage = lazy(() => import('@/modules/admin/pages/ModulesPage').then(m => ({ default: m.ModulesPage })));
const OrgChartPage = lazy(() => import('@/modules/admin/pages/OrgChartPage').then(m => ({ default: m.OrgChartPage })));
const AboutPage = lazy(() => import('@/modules/admin/pages/AboutPage').then(m => ({ default: m.AboutPage })));

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

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Autenticadas — URL desconhecida sem sessão cai no /login (RequireAuth) */}
        <Route element={<RequireAuth />}>
          <Route element={<EmergencyDispatchProvider />}>
            {/* Index: painel mobile (tela cheia) ou redirect por perfil */}
            <Route path="/" element={<IndexGate />} />

            {/* Shell (sidebar + header + footer) + guard de acesso por rota */}
            <Route element={<AppShell />}>
              <Route element={<RequireAccess />}>
                <Route path="/meu-painel" element={<MyPanelPage />} />
                <Route path="/centro-de-operacoes" element={<CopPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* PAE / Emergência */}
                <Route path="/ocorrencias" element={<OccurrencesPage />} />
                <Route path="/ocorrencias/:id/sala-de-situacao" element={<SituationRoomPage />} />
                <Route path="/orquestracao" element={<OrchestrationPage />} />
                <Route path="/ai-command" element={<AiCommandPage />} />
                <Route path="/riscos" element={<RisksPage />} />
                <Route path="/planos-de-acao" element={<PlansPage />} />
                <Route path="/mapa-de-emergencia" element={<EmergencyMapPage />} />
                <Route path="/documentos" element={<DocumentsPage />} />
                <Route path="/cracha-do-pae" element={<BadgePage />} />

                {/* Segurança Operacional */}
                <Route path="/seguranca" element={<SafetyOverviewPage />} />
                <Route path="/seguranca/treinamentos" element={<TrainingsPage />} />
                <Route path="/seguranca/epis" element={<EpisPage />} />
                <Route path="/seguranca/conformidade" element={<CompliancePage />} />

                {/* Administração */}
                <Route path="/terminais" element={<TerminalsPage />} />
                <Route path="/entidades" element={<EntitiesPage />} />
                <Route path="/usuarios" element={<UsersPage />} />
                <Route path="/permissoes" element={<PermissionsPage />} />
                <Route path="/niveis-de-acesso" element={<AccessLevelsPage />} />
                <Route path="/acionamento-entidades" element={<NotificationRulesPage />} />
                <Route path="/pacotes-do-sistema" element={<ModulesPage />} />
                <Route path="/organograma" element={<OrgChartPage />} />
                <Route path="/sobre" element={<AboutPage />} />

                {/* 404 interno do shell (rota autenticada desconhecida) */}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
