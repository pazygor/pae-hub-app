import * as React from "react";

// Fase 1.D: abaixo de 780px o sistema entra na experiência mobile
// (painel de ações + MobileShell). Definido pelo gestor.
const MOBILE_BREAKPOINT = 780;

function computeIsMobile(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile(): boolean {
  // Inicializador síncrono (SPA pura, sem SSR) — evita o "flash" de um
  // valor `false` transitório enquanto o efeito ainda não rodou. Esse flash
  // era inofensivo em componentes que só leem o valor, mas era fatal no
  // IndexGate: ele faz um <Navigate> síncrono baseado em isMobile, e um
  // `false` transitório disparava um redirect incorreto para fora do painel
  // antes do valor real (`true`) chegar.
  const [isMobile, setIsMobile] = React.useState<boolean>(computeIsMobile);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(computeIsMobile());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
