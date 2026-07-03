import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Brain, Sparkles, AlertTriangle, Shield, Bell, FileText, Play, Zap, CheckCircle2, Info, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Occurrence } from '@/lib/types';

interface AISuggestion {
  diagnosis: {
    type: string;
    criticality: 'baixa' | 'média' | 'alta' | 'crítica';
    summary: string;
  };
  suggestedPlan: {
    id: string;
    name: string;
    matchScore: number;
    checklist: { text: string; highlighted: boolean }[];
  } | null;
  actions: string[];
}

const criticalityConfig: Record<string, { color: string; bg: string; label: string }> = {
  baixa: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Baixa' },
  média: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Média' },
  alta: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Alta' },
  crítica: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Crítica' },
};

function analyzeSituation(input: string, occurrence: Occurrence | null, plans: any[]): AISuggestion {
  const text = (input + ' ' + (occurrence?.description || '') + ' ' + (occurrence?.type || '')).toLowerCase();

  let type = 'Incidente Operacional';
  let criticality: AISuggestion['diagnosis']['criticality'] = 'média';
  const actions: string[] = [];

  if (text.includes('incêndio') || text.includes('fogo') || text.includes('chama')) {
    type = 'Incêndio';
    criticality = 'crítica';
    actions.push('Acionar Corpo de Bombeiros', 'Evacuar área imediatamente', 'Ativar sistema de combate a incêndio', 'Isolar perímetro de segurança', 'Notificar entidades reguladoras');
  } else if (text.includes('vazamento') || text.includes('derramamento') || text.includes('químic')) {
    type = 'Vazamento de Produto Químico';
    criticality = 'alta';
    actions.push('Isolar área contaminada', 'Acionar equipe HAZMAT', 'Verificar direção do vento', 'Evacuar zona de risco', 'Notificar órgão ambiental');
  } else if (text.includes('explosão') || text.includes('detonação')) {
    type = 'Explosão';
    criticality = 'crítica';
    actions.push('Evacuar toda a área', 'Acionar SAMU e Bombeiros', 'Isolar perímetro amplo', 'Verificar vítimas', 'Notificar todas as entidades');
  } else if (text.includes('colisão') || text.includes('acidente') || text.includes('navio')) {
    type = 'Acidente Náutico';
    criticality = 'alta';
    actions.push('Acionar Capitania dos Portos', 'Verificar integridade estrutural', 'Preparar contenção de óleo', 'Acionar rebocadores', 'Notificar ANTAQ');
  } else if (text.includes('alagamento') || text.includes('inundação') || text.includes('maré')) {
    type = 'Alagamento / Inundação';
    criticality = 'alta';
    actions.push('Evacuar áreas baixas', 'Proteger equipamentos elétricos', 'Acionar Defesa Civil', 'Monitorar nível da água', 'Suspender operações portuárias');
  } else {
    actions.push('Avaliar situação no local', 'Registrar ocorrência formalmente', 'Acionar equipe de segurança', 'Monitorar evolução do evento', 'Notificar supervisão');
  }

  if (occurrence) {
    if (occurrence.criticality === 'crítica') criticality = 'crítica';
    else if (occurrence.criticality === 'alta' && criticality !== 'crítica') criticality = 'alta';
    type = occurrence.type || type;
  }

  // Match best plan
  let bestPlan: AISuggestion['suggestedPlan'] = null;
  if (plans.length > 0) {
    const scored = plans.map(p => {
      const planText = (p.name + ' ' + p.description + ' ' + (p.checklist?.map((c: any) => c.text).join(' ') || '')).toLowerCase();
      let score = 0;
      const words = text.split(/\s+/).filter(w => w.length > 3);
      words.forEach(w => { if (planText.includes(w)) score++; });
      if (planText.includes(type.toLowerCase())) score += 5;
      return { plan: p, score };
    }).sort((a, b) => b.score - a.score);

    const top = scored[0];
    if (top.score > 0) {
      bestPlan = {
        id: top.plan.id,
        name: top.plan.name,
        matchScore: Math.min(Math.round((top.score / 10) * 100), 98),
        checklist: (top.plan.checklist || []).map((c: any) => ({
          text: c.text,
          highlighted: text.split(/\s+/).some((w: string) => w.length > 3 && c.text.toLowerCase().includes(w)),
        })),
      };
    }
  }

  return {
    diagnosis: {
      type,
      criticality,
      summary: `Situação identificada como "${type}" com nível de criticidade ${criticality}. ${occurrence ? `Baseado na ocorrência ${occurrence.incNumber || occurrence.id}.` : 'Análise baseada na descrição fornecida.'}`,
    },
    suggestedPlan: bestPlan,
    actions,
  };
}

export function AiCommandPage() {
  const { data } = useAuth();
  const [input, setInput] = useState('');
  const [selectedOccurrence, setSelectedOccurrence] = useState<string>('');
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showOccurrenceSelect, setShowOccurrenceSelect] = useState(false);

  const activeOccurrences = useMemo(
    () => data.occurrences.filter(o => o.status !== 'resolvido'),
    [data.occurrences]
  );

  const selectedOcc = useMemo(
    () => data.occurrences.find(o => o.id === selectedOccurrence) || null,
    [data.occurrences, selectedOccurrence]
  );

  const handleAnalyze = () => {
    if (!input.trim() && !selectedOcc) return;
    setAnalyzing(true);
    // Simulate AI processing delay
    setTimeout(() => {
      const result = analyzeSituation(input, selectedOcc, data.plans);
      setSuggestion(result);
      setAnalyzing(false);
    }, 1500);
  };

  const crit = suggestion ? criticalityConfig[suggestion.diagnosis.criticality] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">AI Command</h2>
          <p className="text-sm text-muted-foreground">Assistente inteligente de apoio à gestão de emergências</p>
        </div>
      </div>

      {/* Input section */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-3">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Descreva a situação ou selecione uma ocorrência..."
              className="min-h-[100px] resize-none bg-muted/30"
            />

            {/* Occurrence selector */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <button
                  onClick={() => setShowOccurrenceSelect(!showOccurrenceSelect)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className={selectedOcc ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedOcc ? `${selectedOcc.incNumber || selectedOcc.id} — ${selectedOcc.type}` : 'Vincular ocorrência ativa...'}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
                {showOccurrenceSelect && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedOccurrence(''); setShowOccurrenceSelect(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50"
                    >
                      Nenhuma
                    </button>
                    {activeOccurrences.map(o => (
                      <button
                        key={o.id}
                        onClick={() => { setSelectedOccurrence(o.id); setShowOccurrenceSelect(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                      >
                        <span>{o.incNumber || o.id} — {o.type}</span>
                        <Badge variant="outline" className="text-[10px] ml-2">{o.criticality}</Badge>
                      </button>
                    ))}
                    {activeOccurrences.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma ocorrência ativa</p>
                    )}
                  </div>
                )}
              </div>

              <Button onClick={handleAnalyze} disabled={analyzing || (!input.trim() && !selectedOcc)} className="gap-2">
                {analyzing ? (
                  <>
                    <span className="animate-spin">
                      <Sparkles size={16} />
                    </span>
                    Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Analisar com IA
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Disclaimer */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
        <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          As sugestões são geradas por inteligência artificial com base nos dados do sistema. Toda decisão final deve ser validada pelo operador responsável.
        </p>
      </div>

      {/* Results */}
      {suggestion && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          {/* Diagnosis */}
          <Card className={`border ${crit?.bg}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle size={18} className={crit?.color} />
                Diagnóstico da Situação
                <Badge variant="outline" className={`ml-auto ${crit?.color} border-current`}>
                  {crit?.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tipo:</span>
                <span className="text-sm font-semibold text-foreground">{suggestion.diagnosis.type}</span>
              </div>
              <p className="text-sm text-muted-foreground">{suggestion.diagnosis.summary}</p>
            </CardContent>
          </Card>

          {/* Suggested Plan */}
          {suggestion.suggestedPlan && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText size={18} className="text-primary" />
                  Plano de Ação Sugerido
                  <Badge className="ml-auto bg-primary/10 text-primary border-primary/20" variant="outline">
                    {suggestion.suggestedPlan.matchScore}% aderência
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-semibold text-foreground">{suggestion.suggestedPlan.name}</p>
                <div className="space-y-1.5">
                  {suggestion.suggestedPlan.checklist.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 px-3 py-2 rounded-md text-sm ${
                        item.highlighted
                          ? 'bg-primary/10 border border-primary/20 text-foreground'
                          : 'bg-muted/20 text-muted-foreground'
                      }`}
                    >
                      <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${item.highlighted ? 'text-primary' : 'text-muted-foreground/50'}`} />
                      <span>{item.text}</span>
                      {item.highlighted && (
                        <Badge variant="outline" className="ml-auto text-[9px] text-primary border-primary/30 shrink-0">
                          IA
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap size={18} className="text-yellow-400" />
                Ações Recomendadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {suggestion.actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/20 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-foreground">{action}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="gap-2 h-auto py-3 flex-col">
              <Play size={18} className="text-primary" />
              <span className="text-xs">Aplicar plano sugerido</span>
            </Button>
            <Button variant="outline" className="gap-2 h-auto py-3 flex-col border-red-500/30 hover:bg-red-500/10">
              <Shield size={18} className="text-red-400" />
              <span className="text-xs">Disparar emergência</span>
            </Button>
            <Button variant="outline" className="gap-2 h-auto py-3 flex-col">
              <Bell size={18} className="text-yellow-400" />
              <span className="text-xs">Notificar entidades</span>
            </Button>
            <Button variant="outline" className="gap-2 h-auto py-3 flex-col">
              <FileText size={18} className="text-muted-foreground" />
              <span className="text-xs">Gerar relatório</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
