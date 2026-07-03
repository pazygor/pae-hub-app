/** Fallback de carregamento das rotas lazy (área de conteúdo do shell). */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        <p className="mt-3 text-xs text-muted-foreground uppercase tracking-widest">Carregando...</p>
      </div>
    </div>
  );
}
