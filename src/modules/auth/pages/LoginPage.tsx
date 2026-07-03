import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { AlertCircle } from 'lucide-react';
import m1Logo from '@/assets/m1-logo.png';

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    document.title = 'Entrar · M1 PAE Hub';
  }, []);

  // Já autenticado → volta para a rota de origem (returnTo) ou para o índice.
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from || '/'} replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ok = login(email, password);
    if (!ok) setError('Email ou senha inválidos.');
  };

  const quickLogin = (email: string, password: string) => {
    login(email, password);
  };

  return (
    <div className="min-h-svh flex items-center justify-center bg-foreground p-6">
      <div className="w-full max-w-md bg-card rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img src={m1Logo} alt="M1 Logo" className="h-[70px] w-auto object-contain" />
          </div>
          <h1 className="text-[28px] font-black tracking-tight text-card-foreground">M1 PAE Hub</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Centro Digital de Gestão de Emergências</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-primary text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            className="w-full h-[48px] bg-primary text-primary-foreground rounded-[8px] text-sm font-bold shadow-md hover:brightness-90 transition-all"
          >
            Entrar
          </button>
        </form>

        {!showDemo ? (
          <div className="text-center">
            <button
              onClick={() => setShowDemo(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Acessar demonstração
            </button>
          </div>
        ) : (
          <div className="border-t border-border pt-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 text-center">Acesso rápido (demo)</p>
            <div className="grid gap-2">
              {[
                { label: 'Administrador', email: 'admin@paehub.com', pass: 'admin123' },
                { label: 'Terminal', email: 'carlos@tecon.com', pass: 'terminal123' },
                { label: 'Entidade', email: 'bombeiro@gov.br', pass: 'entity123' },
              ].map(item => (
                <button
                  key={item.email}
                  onClick={() => quickLogin(item.email, item.pass)}
                  className="w-full py-2 px-4 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors flex justify-between items-center"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono-data">{item.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
