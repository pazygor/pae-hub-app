import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Modo de visualização em telas pequenas (<780px) — Fase 1.D.
 *
 * É o sucessor do `mobileFullSystem` do protótipo, agora convivendo com rotas:
 * - `fullSystem = false` (padrão): experiência mobile — painel de ações em `/`
 *   e telas renderizadas no `MobileShell` (sem sidebar).
 * - `fullSystem = true`: usuário escolheu "Sistema Completo" — telas renderizam
 *   no `AppShell` completo mesmo em tela pequena.
 *
 * Persistido em sessionStorage para sobreviver a F5 (a sessão de auth também
 * sobrevive desde a Fase 1.C — os dois juntos mantêm o usuário onde estava).
 * Em telas ≥780px o flag é ignorado (desktop usa sempre o shell completo).
 */

const STORAGE_KEY = 'pae.mobileFullSystem';

interface ViewModeContextType {
  fullSystem: boolean;
  /** Botão "Sistema Completo" do painel mobile. */
  enterFullSystem: () => void;
  /** Botão "← Painel" (volta à experiência mobile). */
  exitFullSystem: () => void;
}

const ViewModeContext = createContext<ViewModeContextType>({
  fullSystem: false,
  enterFullSystem: () => {},
  exitFullSystem: () => {},
});

export function useViewMode() {
  return useContext(ViewModeContext);
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [fullSystem, setFullSystem] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_KEY) === '1',
  );

  const enterFullSystem = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setFullSystem(true);
  }, []);

  const exitFullSystem = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setFullSystem(false);
  }, []);

  return (
    <ViewModeContext.Provider value={{ fullSystem, enterFullSystem, exitFullSystem }}>
      {children}
    </ViewModeContext.Provider>
  );
}
