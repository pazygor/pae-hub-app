import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { getAccessLevelMenuFilter, getUserActiveConfig } from '@/lib/access-control';
import { isMenuItemAccessible } from '@/lib/modules';
import { NAV_CONFIG, menuIdForPath } from '@/lib/nav-config';

/**
 * Guard de autorização por rota — substitui o antigo `guardedSetView` do
 * PAESystem, agora protegendo também acesso direto por URL. Aplica, na ordem,
 * as mesmas regras do menu:
 *   1. papel (roles do item de navegação);
 *   2. módulos permitidos por usuário (allowedModules);
 *   3. nível de acesso (estratégico/tático/operacional);
 *   4. licenciamento de módulos do terminal (Response/Safety).
 * Rota bloqueada → redireciona para /meu-painel (acessível a todos os perfis).
 */
export function RequireAccess() {
  const { user, data } = useAuth();
  const location = useLocation();

  // Autenticação é responsabilidade do RequireAuth (acima na árvore).
  if (!user) return null;

  const menuId = menuIdForPath(location.pathname);
  // Rota sem item de navegação mapeado → sem regra adicional.
  if (!menuId) return <Outlet />;

  const item = NAV_CONFIG.find(i => i.id === menuId);
  if (!item) return <Outlet />;

  const blocked = (() => {
    // 1. Papel
    if (!item.roles.includes(user.role)) return true;
    // 2. Módulos permitidos por usuário
    if (user.role !== 'admin' && user.allowedModules && !user.allowedModules.includes(menuId)) return true;
    // 3. Nível de acesso
    const accessFilter = getAccessLevelMenuFilter(user);
    if (accessFilter && !accessFilter.has(menuId)) return true;
    // 4. Licenciamento do terminal
    const { modules, safetySubModules } = getUserActiveConfig(user, data);
    if (user.role !== 'admin' && !isMenuItemAccessible(menuId, modules, safetySubModules)) return true;
    return false;
  })();

  if (blocked) return <Navigate to="/meu-painel" replace />;
  return <Outlet />;
}
