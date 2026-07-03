import m1Logo from '@/assets/m1-logo.png';

export function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <img src={m1Logo} alt="M1 Logo" className="h-16 w-auto object-contain mx-auto" />
        <h1 className="text-2xl font-black tracking-tight text-foreground">M1 PAE Hub</h1>
        <p className="text-sm text-muted-foreground">Centro Digital de Gestão de Emergências</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Sobre o Sistema</h2>
        <p className="text-sm text-foreground leading-relaxed">
          O <strong>M1 PAE Hub</strong> é uma plataforma digital desenvolvida para apoiar a gestão de emergências operacionais em ambientes críticos como terminais portuários, instalações industriais e operações logísticas.
        </p>
        <p className="text-sm text-foreground leading-relaxed">
          A plataforma permite registrar riscos, monitorar ocorrências, coordenar respostas e acompanhar incidentes em tempo real por meio de um centro de comando digital.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Informações</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Versão</p>
            <p className="font-bold text-foreground">2026</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Ambiente</p>
            <p className="font-bold text-foreground">Demonstração</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Desenvolvido por</p>
            <p className="font-bold text-foreground">M1</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Plataforma</p>
            <p className="font-bold text-foreground">M1 PAE Hub</p>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        © M1 – Todos os direitos reservados
      </p>
    </div>
  );
}
