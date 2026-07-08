import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { isMenuAllowedForUser, getUserActiveConfig } from '@/lib/access-control';
import { isMenuItemAccessible } from '@/lib/modules';
import { NAV_CONFIG, menuIdForPath } from '@/lib/nav-config';

/**
 * Guard de autorização por rota — protege também o acesso direto por URL,
 * espelhando exatamente as regras do menu (AppSidebar):
 *   1. autoridade dos toggles de Níveis de Acesso (papel/nível para o resto);
 *   2. licenciamento de módulos do terminal (Response/Safety).
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
    // 1. Autoridade dos toggles de Níveis de Acesso (papel/nível para o resto)
    if (!isMenuAllowedForUser(user, menuId, item.roles)) return true;
    // 2. Licenciamento do terminal (Pacotes do Sistema)
    const { modules, safetySubModules } = getUserActiveConfig(user, data);
    if (user.role !== 'admin' && !isMenuItemAccessible(menuId, modules, safetySubModules)) return true;
    return false;
  })();

  if (blocked) return <Navigate to="/meu-painel" replace />;
  return <Outlet />;
}
