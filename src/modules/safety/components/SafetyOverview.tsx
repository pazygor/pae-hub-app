import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/common/StatCard';
import { GraduationCap, HardHat, AlertTriangle, Users, ClipboardCheck, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface Props {
  hasTrainings?: boolean;
  hasEPIs?: boolean;
  hasCompliance?: boolean;
  onNavigate?: (tab: string) => void;
}

export type SafetyStatus = 'operacional' | 'atencao' | 'nao_conforme';

const STATUS_COLORS: Record<SafetyStatus, string> = {
  operacional: 'hsl(142, 71%, 45%)',
  atencao: 'hsl(38, 92%, 50%)',
  nao_conforme: 'hsl(0, 72%, 51%)',
};

const STATUS_LABELS: Record<SafetyStatus, string> = {
  operacional: 'Operacional',
  atencao: 'Atenção',
  nao_conforme: 'Não Conforme',
};

const STATUS_CONFIG: Record<SafetyStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  operacional: { label: 'Operacional', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
  atencao: { label: 'Atenção', color: 'text-warning', bg: 'bg-warning/10', icon: AlertCircle },
  nao_conforme: { label: 'Não Conforme', color: 'text-primary', bg: 'bg-primary/10', icon: XCircle },
};

function getUserSafetyStatus(
  userId: string,
  data: any,
  now: Date,
  soonDate: Date,
  checkTrainings: boolean,
  checkEPIs: boolean
): SafetyStatus {
  const uTrainings = checkTrainings ? data.userTrainings.filter((ut: any) => ut.userId === userId) : [];
  const uEPIs = checkEPIs ? data.userEPIs.filter((ue: any) => ue.userId === userId) : [];
  const mandatoryTrainings = checkTrainings ? data.trainings.filter((t: any) => t.mandatory) : [];

  const hasMissing = mandatoryTrainings.some(
    (t: any) => !uTrainings.some((ut: any) => ut.trainingId === t.id && new Date(ut.expiryDate) >= now)
  );
  const hasExpiredT = uTrainings.some((ut: any) => new Date(ut.expiryDate) < now);
  const hasExpiredE = uEPIs.some((ue: any) => ue.expiryDate && new Date(ue.expiryDate) < now);

  if (hasMissing || hasExpiredT || hasExpiredE) return 'nao_conforme';

  const hasSoonT = uTrainings.some((ut: any) => {
    const d = new Date(ut.expiryDate);
    return d >= now && d <= soonDate;
  });
  const hasSoonE = uEPIs.some((ue: any) => {
    if (!ue.expiryDate) return false;
    const d = new Date(ue.expiryDate);
    return d >= now && d <= soonDate;
  });

  if (hasSoonT || hasSoonE) return 'atencao';
  return 'operacional';
}

export function SafetyOverview({ hasTrainings = true, hasEPIs = true, hasCompliance = true, onNavigate }: Props) {
  const { data } = useAuth();
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const userStatuses = useMemo(() =>
    data.users.map(u => ({
      user: u,
      status: getUserSafetyStatus(u.id, data, now, soon, hasTrainings, hasEPIs),
    })),
    [data, hasTrainings, hasEPIs]
  );

  const operacionalCount = userStatuses.filter(s => s.status === 'operacional').length;
  const atencaoCount = userStatuses.filter(s => s.status === 'atencao').length;
  const naoConformeCount = userStatuses.filter(s => s.status === 'nao_conforme').length;

  const complianceIndex = data.users.length > 0
    ? Math.round((operacionalCount / data.users.length) * 100)
    : 100;

  // Stats
  const expiredTrainings = hasTrainings ? data.userTrainings.filter((ut: any) => new Date(ut.expiryDate) < now).length : 0;
  const expiredEPIs = hasEPIs ? data.userEPIs.filter((ue: any) => ue.expiryDate && new Date(ue.expiryDate) < now).length : 0;
  const validTrainings = hasTrainings ? data.userTrainings.filter((ut: any) => new Date(ut.expiryDate) >= now).length : 0;
  const validEPIs = hasEPIs ? data.userEPIs.filter((ue: any) => !ue.expiryDate || new Date(ue.expiryDate) >= now).length : 0;

  // Pie data
  const pieData = [
    { name: 'Operacional', value: operacionalCount, color: STATUS_COLORS.operacional },
    { name: 'Atenção', value: atencaoCount, color: STATUS_COLORS.atencao },
    { name: 'Não Conforme', value: naoConformeCount, color: STATUS_COLORS.nao_conforme },
  ].filter(d => d.value > 0);

  // Bar: per terminal
  const terminalData = data.terminals.map(terminal => {
    const tUsers = data.users.filter(u => u.linkId === terminal.id);
    const statuses = tUsers.map(u => getUserSafetyStatus(u.id, data, now, soon, hasTrainings, hasEPIs));
    return {
      name: terminal.name.length > 16 ? terminal.name.substring(0, 16) + '…' : terminal.name,
      Operacional: statuses.filter(s => s === 'operacional').length,
      Atenção: statuses.filter(s => s === 'atencao').length,
      'Não Conforme': statuses.filter(s => s === 'nao_conforme').length,
    };
  });

  // Expiring soon
  const expiringSoonTrainings = hasTrainings ? data.userTrainings.filter((ut: any) => {
    const d = new Date(ut.expiryDate);
    return d >= now && d <= soon;
  }) : [];
  const expiringSoonEPIs = hasEPIs ? data.userEPIs.filter((ue: any) => {
    if (!ue.expiryDate) return false;
    const d = new Date(ue.expiryDate);
    return d >= now && d <= soon;
  }) : [];

  // Non-compliant users sorted by criticality
  const nonCompliant = useMemo(() => {
    return userStatuses
      .filter(s => s.status === 'nao_conforme')
      .map(({ user }) => {
        const expT = hasTrainings ? data.userTrainings.filter((ut: any) => ut.userId === user.id && new Date(ut.expiryDate) < now) : [];
        const expE = hasEPIs ? data.userEPIs.filter((ue: any) => ue.userId === user.id && ue.expiryDate && new Date(ue.expiryDate) < now) : [];
        const mandMissing = hasTrainings ? data.trainings.filter((t: any) => t.mandatory).filter(
          (t: any) => !data.userTrainings.some((ut: any) => ut.trainingId === t.id && ut.userId === user.id && new Date(ut.expiryDate) >= now)
        ) : [];
        return { user, expT, expE, mandMissing, totalIssues: expT.length + expE.length + mandMissing.length };
      })
      .sort((a, b) => b.totalIssues - a.totalIssues);
  }, [userStatuses, data, hasTrainings, hasEPIs]);

  // Ring indicator
  const ringColor = complianceIndex >= 80 ? 'text-success' : complianceIndex >= 50 ? 'text-warning' : 'text-primary';
  const ringStroke = complianceIndex >= 80 ? STATUS_COLORS.operacional : complianceIndex >= 50 ? STATUS_COLORS.atencao : STATUS_COLORS.nao_conforme;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (complianceIndex / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* 1. Compliance Index + Status cards */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Ring indicator */}
        <div className="bg-card border rounded-xl p-6 flex flex-col items-center justify-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Índice de Conformidade</p>
          <div className="relative w-[130px] h-[130px]">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="54" stroke="hsl(0,0%,20%)" strokeWidth="8" fill="none" />
              <circle
                cx="60" cy="60" r="54"
                stroke={ringStroke}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold font-mono ${ringColor}`}>{complianceIndex}%</span>
            </div>
          </div>
        </div>

        {/* Status cards */}
        <div className="bg-card border border-success/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <CheckCircle2 size={28} className="text-success mb-2" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Operacional</p>
          <p className="text-4xl font-mono font-bold text-success">{operacionalCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">usuários em dia</p>
        </div>

        <div className="bg-card border border-warning/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <AlertCircle size={28} className="text-warning mb-2" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Atenção</p>
          <p className="text-4xl font-mono font-bold text-warning">{atencaoCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">itens vencendo em breve</p>
        </div>

        <div className="bg-card border border-primary/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <XCircle size={28} className="text-primary mb-2" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Não Conforme</p>
          <p className="text-4xl font-mono font-bold text-primary">{naoConformeCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">pendências ativas</p>
        </div>
      </div>

      {/* 2. Non-compliant users */}
      {nonCompliant.length > 0 && (
        <div className="bg-card border border-primary/20 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/10 flex items-center gap-2">
            <XCircle size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Usuários Não Conformes</h3>
            <span className="ml-auto text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{nonCompliant.length}</span>
          </div>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
            {nonCompliant.map(({ user, expT, expE, mandMissing }) => (
              <div key={user.id} className="px-5 py-3 flex items-start gap-3">
                <XCircle size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {mandMissing.map((t: any) => (
                      <span key={t.id} className="text-xs text-primary">⚠ Obrigatório ausente: {t.name}</span>
                    ))}
                    {expT.map((ut: any) => {
                      const t = data.trainings.find((tr: any) => tr.id === ut.trainingId);
                      return <span key={ut.id} className="text-xs text-primary">⚠ Treinamento vencido: {t?.name}</span>;
                    })}
                    {expE.map((ue: any) => {
                      const e = data.epis.find((ep: any) => ep.id === ue.epiId);
                      return <span key={ue.id} className="text-xs text-primary">⚠ EPI vencido: {e?.name}</span>;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Distribuição de Status</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(0,0%,10%)', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Conformidade por Terminal</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={terminalData} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(0,0%,45%)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0,0%,45%)' }} />
                <Tooltip contentStyle={{ background: 'hsl(0,0%,10%)', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                <Bar dataKey="Operacional" stackId="a" fill={STATUS_COLORS.operacional} />
                <Bar dataKey="Atenção" stackId="a" fill={STATUS_COLORS.atencao} />
                <Bar dataKey="Não Conforme" stackId="a" fill={STATUS_COLORS.nao_conforme} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Stat cards row - only show relevant ones */}
      <div className={`grid grid-cols-2 ${hasTrainings && hasEPIs ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
        {hasTrainings && (
          <>
            <StatCard label="Treinamentos" value={data.trainings.length} icon={GraduationCap} variant="accent" />
            <StatCard label="Trein. Vencidos" value={expiredTrainings} icon={AlertTriangle} variant={expiredTrainings > 0 ? 'emergency' : 'default'} />
          </>
        )}
        {hasEPIs && (
          <>
            <StatCard label="EPIs Cadastrados" value={data.epis.length} icon={HardHat} variant="accent" />
            <StatCard label="EPIs Vencidos" value={expiredEPIs} icon={AlertTriangle} variant={expiredEPIs > 0 ? 'emergency' : 'default'} />
          </>
        )}
      </div>

      {/* 5. Expiring soon */}
      {(expiringSoonTrainings.length > 0 || expiringSoonEPIs.length > 0) && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className="text-warning" />
            <h3 className="text-sm font-bold text-warning uppercase tracking-wide">Vencendo em 30 dias</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {expiringSoonTrainings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Treinamentos</p>
                <div className="space-y-1">
                  {expiringSoonTrainings.map((ut: any) => {
                    const training = data.trainings.find((t: any) => t.id === ut.trainingId);
                    const user = data.users.find((u: any) => u.id === ut.userId);
                    return (
                      <div key={ut.id} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 text-xs">
                        <span className="font-medium text-foreground">{training?.name}</span>
                        <span className="text-muted-foreground">{user?.name} — {new Date(ut.expiryDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {expiringSoonEPIs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">EPIs</p>
                <div className="space-y-1">
                  {expiringSoonEPIs.map((ue: any) => {
                    const epi = data.epis.find((e: any) => e.id === ue.epiId);
                    const user = data.users.find((u: any) => u.id === ue.userId);
                    return (
                      <div key={ue.id} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 text-xs">
                        <span className="font-medium text-foreground">{epi?.name}</span>
                        <span className="text-muted-foreground">{user?.name} — {new Date(ue.expiryDate!).toLocaleDateString('pt-BR')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Quick access - only show available modules */}
      {onNavigate && (
        <div className={`grid ${[hasTrainings, hasEPIs, hasCompliance].filter(Boolean).length === 3 ? 'md:grid-cols-3' : [hasTrainings, hasEPIs, hasCompliance].filter(Boolean).length === 2 ? 'md:grid-cols-2' : ''} gap-4`}>
          {hasTrainings && (
            <button onClick={() => onNavigate('trainings')} className="bg-card border rounded-xl p-5 text-left hover:border-primary/40 transition-colors group">
              <GraduationCap size={24} className="text-primary mb-3" />
              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">Treinamentos</h4>
              <p className="text-xs text-muted-foreground mt-1">{validTrainings} em dia · {expiredTrainings} vencidos</p>
            </button>
          )}
          {hasEPIs && (
            <button onClick={() => onNavigate('epis')} className="bg-card border rounded-xl p-5 text-left hover:border-primary/40 transition-colors group">
              <HardHat size={24} className="text-primary mb-3" />
              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">EPIs</h4>
              <p className="text-xs text-muted-foreground mt-1">{validEPIs} válidos · {expiredEPIs} vencidos</p>
            </button>
          )}
          {hasCompliance && (
            <button onClick={() => onNavigate('compliance')} className="bg-card border rounded-xl p-5 text-left hover:border-primary/40 transition-colors group">
              <ClipboardCheck size={24} className="text-primary mb-3" />
              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">Conformidade</h4>
              <p className="text-xs text-muted-foreground mt-1">{naoConformeCount} não conforme(s)</p>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
