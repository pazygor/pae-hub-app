import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

/**
 * Guard de autenticação: sem sessão → redireciona para /login guardando a rota
 * de origem (returnTo). Na integração com a API real (Fase 1.C), apenas a fonte
 * do `user` muda — este guard permanece igual.
 */
export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
