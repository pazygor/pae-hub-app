import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle as AlertTriangleIcon, X, GraduationCap, HardHat, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getUserActiveConfig } from '@/lib/access-control';
import { useTrainings, useTrainingAssignments, useEpiDeliveries, useCompliance } from '@/api';

/**
 * Alerta de pendências operacionais exibido após o login (movido do PAESystem).
 * Autossuficiente: calcula treinamentos/EPIs/conformidade do usuário e navega
 * para /meu-painel nas ações.
 */
export function PendencyAlertModal() {
  const { user } = useAuth();
  const { data: trainings = [] } = useTrainings();
  const { data: userTrainings = [] } = useTrainingAssignments();
  const { data: userEPIs = [] } = useEpiDeliveries();
  const { data: complianceItems = [] } = useCompliance();
  const navigate = useNavigate();
  const [alertDismissed, setAlertDismissed] = useState(false);

  if (!user) return null;

  // === Pendency calculation (dados reais da API — Fase 5b) ===
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { safetySubModules: activeSubs } = getUserActiveConfig(user);
  // Pendências do PRÓPRIO usuário — só treinamentos EXPLICITAMENTE atribuídos a ele
  // (mesma regra do Meu Painel). Um registro sem conclusão = atribuído/PENDENTE; com
  // conclusão e vencido = VENCIDO. Não conta o catálogo inteiro (isso inflava admin/
  // outros terminais).
  const myTrainingRecords = userTrainings.filter(ut => ut.userId === user.id);
  const myTrainingIds = [...new Set(myTrainingRecords.map(r => r.trainingId))];
  let pendingTrainings = 0;
  let expiredTrainings = 0;
  if (activeSubs.includes('trainings')) {
    for (const tid of myTrainingIds) {
      // registro atual: pendente tem prioridade; senão o de maior validade
      const rec = myTrainingRecords
        .filter(r => r.trainingId === tid)
        .sort((a, b) => {
          if (!a.completedDate && b.completedDate) return -1;
          if (a.completedDate && !b.completedDate) return 1;
          return String(b.expiryDate ?? '').localeCompare(String(a.expiryDate ?? ''));
        })[0];
      if (!rec) continue;
      if (!rec.completedDate) pendingTrainings++;
      else if (rec.expiryDate && new Date(rec.expiryDate) < now) expiredTrainings++;
    }
  }
  const expiredEPIs = activeSubs.includes('epis')
    ? userEPIs.filter(ue => ue.userId === user.id && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido' && ue.expiryDate && new Date(ue.expiryDate) < now).length
    : 0;
  const soonEPIs = activeSubs.includes('epis')
    ? userEPIs.filter(ue => ue.userId === user.id && ue.usageStatus !== 'substituido' && ue.usageStatus !== 'devolvido' && ue.expiryDate && new Date(ue.expiryDate) >= now && new Date(ue.expiryDate) <= soonThreshold).length
    : 0;
  const ncCompliance = activeSubs.includes('compliance')
    ? complianceItems.filter(ci => ci.status === 'nao_conforme' && (ci.userId === user.id || ci.responsible === user.name)).length
    : 0;
  const totalPendencies = pendingTrainings + expiredTrainings + expiredEPIs + soonEPIs + ncCompliance;
  const showPendencyAlert = totalPendencies > 0 && !alertDismissed;

  const goToPanel = () => {
    setAlertDismissed(true);
    navigate('/meu-painel');
  };

  return (
    <AnimatePresence>
      {showPendencyAlert && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setAlertDismissed(true)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-card border-2 border-warning/30 rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-warning/10 px-6 py-4 flex items-center gap-3 border-b border-warning/20">
              <div className="p-2 bg-warning/20 rounded-lg">
                <AlertTriangleIcon size={20} className="text-warning" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wide">Pendências Operacionais</h3>
                <p className="text-[11px] text-muted-foreground">Você possui itens que requerem atenção</p>
              </div>
              <button onClick={() => setAlertDismissed(true)} className="ml-auto p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {(pendingTrainings > 0 || expiredTrainings > 0) && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${expiredTrainings > 0 ? 'border-primary/30 bg-primary/5' : 'border-warning/30 bg-warning/5'}`}>
                  <div className="flex items-center gap-3">
                    <GraduationCap size={18} className={expiredTrainings > 0 ? 'text-primary' : 'text-warning'} />
                    <div>
                      <p className="text-xs font-bold text-foreground">Treinamentos</p>
                      <p className="text-[10px] text-muted-foreground">
                        {pendingTrainings > 0 && <span>{pendingTrainings} pendente{pendingTrainings > 1 ? 's' : ''}</span>}
                        {pendingTrainings > 0 && expiredTrainings > 0 && <span> · </span>}
                        {expiredTrainings > 0 && <span className="text-primary font-bold">{expiredTrainings} vencido{expiredTrainings > 1 ? 's' : ''}</span>}
                      </p>
                    </div>
                  </div>
                  <button onClick={goToPanel}
                    className="px-3 py-1.5 text-[10px] font-bold bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors">
                    Ver Treinamentos
                  </button>
                </div>
              )}
              {(expiredEPIs > 0 || soonEPIs > 0) && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${expiredEPIs > 0 ? 'border-primary/30 bg-primary/5' : 'border-warning/30 bg-warning/5'}`}>
                  <div className="flex items-center gap-3">
                    <HardHat size={18} className={expiredEPIs > 0 ? 'text-primary' : 'text-warning'} />
                    <div>
                      <p className="text-xs font-bold text-foreground">EPIs</p>
                      <p className="text-[10px] text-muted-foreground">
                        {expiredEPIs > 0 && <span className="text-primary font-bold">{expiredEPIs} vencido{expiredEPIs > 1 ? 's' : ''}</span>}
                        {expiredEPIs > 0 && soonEPIs > 0 && <span> · </span>}
                        {soonEPIs > 0 && <span>{soonEPIs} próximo{soonEPIs > 1 ? 's' : ''} do vencimento</span>}
                      </p>
                    </div>
                  </div>
                  <button onClick={goToPanel}
                    className="px-3 py-1.5 text-[10px] font-bold bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors">
                    Ver EPIs
                  </button>
                </div>
              )}
              {ncCompliance > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-3">
                    <ClipboardCheck size={18} className="text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Conformidade</p>
                      <p className="text-[10px] text-primary font-bold">{ncCompliance} item{ncCompliance > 1 ? 'ns' : ''} não conforme{ncCompliance > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button onClick={goToPanel}
                    className="px-3 py-1.5 text-[10px] font-bold bg-foreground/10 text-foreground rounded-lg hover:bg-foreground/20 transition-colors">
                    Ver Conformidade
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setAlertDismissed(true)}
                className="w-full py-2.5 text-xs font-bold bg-secondary text-muted-foreground rounded-xl hover:bg-secondary/80 transition-colors">
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
