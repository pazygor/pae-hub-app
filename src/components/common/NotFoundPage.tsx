import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin } from 'lucide-react';

/** 404 interno do shell — rota autenticada desconhecida. */
export function NotFoundPage() {
  const location = useLocation();

  useEffect(() => {
    document.title = 'Página não encontrada · M1 PAE Hub';
    console.error('404: rota inexistente:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 bg-primary/10 rounded-2xl mb-4">
        <MapPin size={32} className="text-primary" />
      </div>
      <h1 className="text-3xl font-black text-foreground">404</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A página <span className="font-mono text-foreground">{location.pathname}</span> não existe.
      </p>
      <Link
        to="/"
        className="mt-6 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 transition-all"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
