import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

/**
 * Guard de autenticação: sem sessão → redireciona para /login guardando a rota
 * de origem (returnTo). Durante a reidratação da sessão (token salvo →
 * /auth/me), exibe um loader em vez de redirecionar — evita "flash" de login
 * em F5/deep-link com sessão válida.
 */
export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-xs text-muted-foreground uppercase tracking-widest">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
