import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Ship, Clock, AlertTriangle, FileText, Siren, Users, Shield, Activity, TrendingUp, BarChart3, PieChart as PieChartIcon, Zap } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, CartesianGrid, RadialBarChart, RadialBar,
} from 'recharts';
import { useOccurrences, useTerminals, useEntities, usePermissions, useUsers } from '@/api';

const STATUS_COLORS = ['hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(220, 70%, 55%)', 'hsl(142, 71%, 45%)'];
const RISK_COLORS = ['hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)'];

const TREND_DATA = [
  { month: 'Out', ocorrencias: 1, riscos: 2 },
  { month: 'Nov', ocorrencias: 3, riscos: 3 },
  { month: 'Dez', ocorrencias: 2, riscos: 2 },
  { month: 'Jan', ocorrencias: 4, riscos: 4 },
  { month: 'Fev', ocorrencias: 1, riscos: 3 },
  { month: 'Mar', ocorrencias: 2, riscos: 3 },
];

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

function AnimatedNumber({ value, duration = 800 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toString().padStart(2, '0')}</>;
}

interface StatCardProps {
  label: string;
  value: number;
  variant?: 'default' | 'accent' | 'emergency' | 'success' | 'warning';
  icon?: React.ElementType;
  delay?: number;
}

function StatCardModern({ label, value, variant = 'default', icon: Icon, delay = 0 }: StatCardProps) {
  const colorMap = {
    default: 'text-foreground',
    accent: 'text-primary',
    emergency: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
  };
  const gradientMap = {
    default: 'from-secondary/50 to-secondary/20',
    accent: 'from-primary/15 to-primary/5',
    emergency: 'from-primary/20 to-primary/5',
    success: 'from-success/15 to-success/5',
    warning: 'from-warning/15 to-warning/5',
  };
  const iconBgMap = {
    default: 'bg-secondary text-muted-foreground',
    accent: 'bg-primary/10 text-primary',
    emergency: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
  };

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${gradientMap[variant]} border border-border p-3 xl:p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 animate-fade-in`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBgMap[variant]}`}>
            <Icon size={15} />
          </div>
        )}
      </div>
      <p className={`text-2xl xl:text-3xl font-mono font-black tracking-tight ${colorMap[variant]}`}>
        <AnimatedNumber value={value} />
      </p>
      {/* Decorative accent */}
      <div className={`absolute -bottom-2 -right-2 w-16 h-16 rounded-full opacity-5 ${variant === 'default' ? 'bg-foreground' : variant === 'accent' || variant === 'emergency' ? 'bg-primary' : variant === 'success' ? 'bg-success' : 'bg-warning'}`} />
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
      {label && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-bold" style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-mono">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const CenterLabel = ({ viewBox, total }: any) => {
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-2xl font-black font-mono">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground text-[10px] font-bold uppercase tracking-wider">total</text>
    </g>
  );
};

export function DashboardPage() {
  // `data` só para riscos/planos (mock até a Fase 5a)
  const { user, data } = useAuth();
  // Ocorrências já chegam escopadas por papel/terminal do back
  const { data: occurrences = [] } = useOccurrences();
  const { data: terminals = [] } = useTerminals();
  const { data: entities = [] } = useEntities();
  const { data: permissions = [] } = usePermissions();
  const { data: users = [] } = useUsers(user?.role === 'admin');

  const visibleTerminalIds = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return terminals.map(t => t.id);
    if (user.role === 'terminal') return user.linkId ? [user.linkId] : [];
    if (user.role === 'entity') return permissions.find(p => p.entityId === user.linkId)?.terminalIds || [];
    return [];
  }, [user, terminals, permissions]);

  const visibleTerminals = useMemo(() => terminals.filter(t => visibleTerminalIds.includes(t.id)), [terminals, visibleTerminalIds]);

  if (!user) return null;

  const risks = data.risks.filter(r => visibleTerminalIds.includes(r.terminalId));
  const plans = data.plans.filter(p => visibleTerminalIds.includes(p.terminalId));

  const activeTerminals = visibleTerminals.filter(t => t.status === 'Ativo').length;
  const activePlans = plans.filter(p => p.status === 'ativo').length;
  const openOccurrences = occurrences.filter(o => o.status !== 'resolvido').length;
  const highRisks = risks.filter(r => r.level === 'alto').length;

  const roleLabel = user.role === 'admin' ? 'Administrador' : user.role === 'terminal' ? 'Terminal' : 'Entidade';
  const linkedName = user.role === 'terminal'
    ? terminals.find(t => t.id === user.linkId)?.name
    : user.role === 'entity'
    ? entities.find(e => e.id === user.linkId)?.name
    : null;

  const occByStatus = [
    { name: 'Aberto', value: occurrences.filter(o => o.status === 'aberto').length },
    { name: 'Em Atendimento', value: occurrences.filter(o => o.status === 'em atendimento').length },
    { name: 'Emergência Ativa', value: occurrences.filter(o => o.status === 'emergência ativa').length },
    { name: 'Resolvido', value: occurrences.filter(o => o.status === 'resolvido').length },
  ].filter(d => d.value > 0);

  const riskByLevel = [
    { name: 'Baixo', value: risks.filter(r => r.level === 'baixo').length },
    { name: 'Médio', value: risks.filter(r => r.level === 'médio').length },
    { name: 'Alto', value: risks.filter(r => r.level === 'alto').length },
  ].filter(d => d.value > 0);

  const totalOcc = occByStatus.reduce((sum, d) => sum + d.value, 0);

  // Risk by terminal
  const riskByTerminal = visibleTerminals.map(t => ({
    name: t.name.replace(/Terminal\s*/i, '').substring(0, 15),
    alto: risks.filter(r => r.terminalId === t.id && r.level === 'alto').length,
    médio: risks.filter(r => r.terminalId === t.id && r.level === 'médio').length,
    baixo: risks.filter(r => r.terminalId === t.id && r.level === 'baixo').length,
  }));

  // Operational health (radial)
  const resolvedPct = occurrences.length > 0 ? Math.round((occurrences.filter(o => o.status === 'resolvido').length / occurrences.length) * 100) : 100;
  const activePlanPct = plans.length > 0 ? Math.round((activePlans / plans.length) * 100) : 0;
  const healthData = [
    { name: 'Planos Ativos', value: activePlanPct, fill: 'hsl(142, 71%, 45%)' },
    { name: 'Resolvidas', value: resolvedPct, fill: 'hsl(220, 70%, 55%)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h2 className="text-xl font-black text-foreground">Bem-vindo, {user.name}</h2>
        <p className="text-sm text-muted-foreground">
          Perfil: <span className="font-semibold text-primary">{roleLabel}</span>
          {linkedName && <> — {linkedName}</>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCardModern label="Terminais" value={visibleTerminals.length} variant="accent" icon={Ship} delay={0} />
        {user.role === 'admin' && <StatCardModern label="Entidades" value={entities.length} icon={Shield} delay={50} />}
        {user.role === 'admin' && <StatCardModern label="Usuários" value={users.length} icon={Users} delay={100} />}
        <StatCardModern label="Riscos Críticos" value={highRisks} variant={highRisks > 0 ? 'emergency' : 'default'} icon={AlertTriangle} delay={150} />
        <StatCardModern label="Planos Ativos" value={activePlans} variant="success" icon={FileText} delay={200} />
        <StatCardModern label="Ocorrências Abertas" value={openOccurrences} variant={openOccurrences > 0 ? 'warning' : 'default'} icon={Siren} delay={250} />
      </div>

      {/* Charts Row 1: Donut + Risk Bars + Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Donut Chart */}
        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
          <h3 className="font-bold text-sm text-foreground mb-1 flex items-center gap-2">
            <PieChartIcon size={15} className="text-primary" />
            Ocorrências por Status
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Distribuição atual</p>
          {occByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={occByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={4}
                  stroke="none"
                  animationBegin={200}
                  animationDuration={800}
                >
                  {occByStatus.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                  <CenterLabel total={totalOcc} />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', fontWeight: 700 }}
                  formatter={(value: string) => <span className="text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground italic">Sem dados</div>
          )}
        </div>

        {/* Stacked Risk by Terminal */}
        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
          <h3 className="font-bold text-sm text-foreground mb-1 flex items-center gap-2">
            <BarChart3 size={15} className="text-warning" />
            Riscos por Terminal
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Agrupados por criticidade</p>
          {riskByTerminal.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={riskByTerminal} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" opacity={0.3} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(0,0%,50%)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0,0%,50%)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="baixo" stackId="a" fill={RISK_COLORS[0]} radius={[0, 0, 0, 0]} name="Baixo" animationDuration={800} />
                <Bar dataKey="médio" stackId="a" fill={RISK_COLORS[1]} name="Médio" animationDuration={800} />
                <Bar dataKey="alto" stackId="a" fill={RISK_COLORS[2]} radius={[4, 4, 0, 0]} name="Alto" animationDuration={800} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} formatter={(v: string) => <span className="text-foreground">{v}</span>} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground italic">Sem dados</div>
          )}
        </div>

        {/* Operational Health */}
        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
          <h3 className="font-bold text-sm text-foreground mb-1 flex items-center gap-2">
            <Zap size={15} className="text-success" />
            Saúde Operacional
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Indicadores consolidados</p>
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={healthData} startAngle={180} endAngle={0} barSize={14}>
              <RadialBar dataKey="value" cornerRadius={8} animationDuration={1000} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} formatter={(v: string) => <span className="text-foreground">{v}</span>} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="text-center bg-background rounded-lg p-2">
              <p className="text-lg font-mono font-black text-success">{activePlanPct}%</p>
              <p className="text-[9px] text-muted-foreground font-bold uppercase">Planos Ativos</p>
            </div>
            <div className="text-center bg-background rounded-lg p-2">
              <p className="text-lg font-mono font-black" style={{ color: 'hsl(220, 70%, 55%)' }}>{resolvedPct}%</p>
              <p className="text-[9px] text-muted-foreground font-bold uppercase">Resolvidas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Trend + Risk Level */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trend Area Chart */}
        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
          <h3 className="font-bold text-sm text-foreground mb-1 flex items-center gap-2">
            <TrendingUp size={15} className="text-primary" />
            Tendência (6 meses)
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Ocorrências vs Riscos</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={TREND_DATA}>
              <defs>
                <linearGradient id="gradOcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,20%)" opacity={0.3} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(0,0%,50%)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(0,0%,50%)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ocorrencias" name="Ocorrências" stroke="hsl(0, 72%, 51%)" fill="url(#gradOcc)" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(0, 72%, 51%)' }} animationDuration={1000} />
              <Area type="monotone" dataKey="riscos" name="Riscos" stroke="hsl(38, 92%, 50%)" fill="url(#gradRisk)" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(38, 92%, 50%)' }} animationDuration={1000} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} formatter={(v: string) => <span className="text-foreground">{v}</span>} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Level Distribution */}
        {riskByLevel.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 animate-fade-in" style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}>
            <h3 className="font-bold text-sm text-foreground mb-1 flex items-center gap-2">
              <AlertTriangle size={15} className="text-warning" />
              Distribuição de Riscos
            </h3>
            <p className="text-[10px] text-muted-foreground mb-3">Por nível de criticidade</p>
            <div className="space-y-4 mt-6">
              {riskByLevel.map((item, i) => {
                const max = Math.max(...riskByLevel.map(r => r.value));
                const pct = max > 0 ? (item.value / max) * 100 : 0;
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{item.name}</span>
                      <span className="text-xs font-mono font-black" style={{ color: RISK_COLORS[i] }}>{item.value}</span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: RISK_COLORS[i],
                          animation: `grow-bar 1s ease-out ${i * 200}ms backwards`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 p-3 bg-background rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total de Riscos</span>
                <span className="text-lg font-mono font-black text-foreground">{risks.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Open occurrences */}
      {openOccurrences > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Siren size={16} className="text-primary" />
            <h3 className="font-bold text-sm text-foreground">Ocorrências Ativas</h3>
            <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{openOccurrences}</span>
          </div>
          <div className="divide-y divide-border">
            {occurrences.filter(o => o.status !== 'resolvido').map(o => (
              <div key={o.id} className="px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{o.type}</p>
                  <p className="text-xs text-muted-foreground">{o.terminalName || terminals.find(t => t.id === o.terminalId)?.name} · {o.description}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  o.status === 'aberto' ? 'bg-primary/10 text-primary'
                  : o.status === 'emergência ativa' ? 'bg-primary/20 text-primary'
                  : 'bg-warning/10 text-warning'
                }`}>{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High risks */}
      {highRisks > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in" style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}>
          <div className="p-4 border-b border-border flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            <h3 className="font-bold text-sm text-foreground">Riscos de Alta Criticidade</h3>
            <span className="text-[10px] font-mono bg-warning/10 text-warning px-2 py-0.5 rounded-full font-bold">{highRisks}</span>
          </div>
          <div className="divide-y divide-border">
            {risks.filter(r => r.level === 'alto').map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.type}</p>
                  <p className="text-xs text-muted-foreground">{terminals.find(t => t.id === r.terminalId)?.name} · {r.affectedArea}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary">alto</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent actions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in" style={{ animationDelay: '800ms', animationFillMode: 'backwards' }}>
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Clock size={16} className="text-muted-foreground" />
          <h3 className="font-bold text-sm text-foreground">Ações Recentes</h3>
        </div>
        <div className="divide-y divide-border">
          {[
            { text: 'PAE do Terminal Norte atualizado', time: '10 min' },
            { text: 'Corpo de Bombeiros realizou inspeção no Terminal Químico Sul', time: '25 min' },
            { text: 'Novo registro de simulado cadastrado', time: '1h' },
            { text: 'Permissão de acesso atualizada para IBAMA', time: '2h' },
          ].map((item, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between text-sm hover:bg-secondary/30 transition-colors">
              <span className="text-foreground">{item.text}</span>
              <span className="text-muted-foreground text-xs shrink-0 ml-4">Há {item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Terminals */}
      {visibleTerminals.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in" style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}>
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Ship size={16} className="text-muted-foreground" />
            <h3 className="font-bold text-sm text-foreground">Terminais Monitorados</h3>
            <span className="text-[10px] font-mono bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-bold">{visibleTerminals.length}</span>
          </div>
          <div className="divide-y divide-border">
            {visibleTerminals.map(t => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.location} · {t.responsible}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  t.status === 'Ativo' ? 'bg-success/10 text-success' : t.status === 'Revisão' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes grow-bar {
          from { width: 0%; }
        }
      `}</style>
    </div>
  );
}
