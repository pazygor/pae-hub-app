import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { defaultPathForUser, pathForView, situationRoomPath } from '@/lib/nav-config';
import { RequireAuth } from './guards/RequireAuth';
import { RequireAccess } from './guards/RequireAccess';
import { AppShell } from './layout/AppShell';
import { EmergencyDispatchProvider, useEmergencyDispatch } from './layout/EmergencyDispatchProvider';

import { MobileActionPanel } from '@/components/common/MobileActionPanel';
import { LoginPage } from '@/modules/auth';
import { MyPanelPage } from '@/modules/panel';
import { CopPage, DashboardPage } from '@/modules/operations';
import {
  OccurrencesPage, SituationRoomPage, OrchestrationPage, AiCommandPage,
  RisksPage, PlansPage, EmergencyMapPage, DocumentsPage, BadgePage,
} from '@/modules/emergency';
import { SafetyOverviewPage, TrainingsPage, EpisPage, CompliancePage } from '@/modules/safety';
import {
  TerminalsPage, EntitiesPage, UsersPage, PermissionsPage, AccessLevelsPage,
  NotificationRulesPage, ModulesPage, OrgChartPage, AboutPage,
} from '@/modules/admin';
import NotFound from '@/pages/NotFound';

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

        {/* Autenticadas */}
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
