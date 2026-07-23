import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/api/auth';
import { TERMS_VERSION, TERMS_TITLE, TERMS_TEXT, TERMS_FOOTER, needsTermsAcceptance } from '@/lib/terms';

/**
 * Termo de Consentimento (item 6). Modal BLOQUEANTE no primeiro acesso (ou quando a
 * versão do termo muda): não fecha por ESC, clique-fora ou X. Só "Aceito" libera;
 * "Recusar" desloga. O aceite é gravado no back (log imutável + gating no User).
 */
export function ConsentTermsModal() {
  const { user, logout, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!needsTermsAcceptance(user)) return null;

  const accept = async () => {
    setBusy(true);
    try {
      await authApi.acceptTerms(TERMS_VERSION);
      await refreshUser(); // fecha o modal (needsTermsAcceptance passa a ser false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o aceite.');
      setBusy(false);
    }
  };

  const decline = () => {
    toast.message('Para usar o PAE Hub é necessário aceitar o Termo de Consentimento.');
    logout();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-foreground tracking-tight truncate">{TERMS_TITLE}</h2>
              <p className="text-[11px] text-muted-foreground">Versão {TERMS_VERSION} · leitura obrigatória no primeiro acesso</p>
            </div>
          </div>

          {/* Texto rolável */}
          <div className="px-6 py-5 overflow-y-auto space-y-3 text-[13px] leading-relaxed text-muted-foreground">
            {TERMS_TEXT.map((p, i) => (
              <p key={i} className={i === 0 ? 'text-foreground font-semibold' : ''}>{p}</p>
            ))}
            <div className="pt-3 mt-2 border-t border-border">
              <p className="text-xs font-bold text-foreground">{TERMS_FOOTER.brand}</p>
              <p className="text-[11px] text-muted-foreground">{TERMS_FOOTER.tagline}</p>
            </div>
          </div>

          {/* Ações */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 shrink-0 bg-card">
            <button
              onClick={decline}
              disabled={busy}
              className="px-4 py-2.5 text-xs font-bold text-muted-foreground rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Recusar e sair
            </button>
            <button
              onClick={accept}
              disabled={busy}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Aceito
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
