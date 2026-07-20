/**
 * Conteúdo do tooltip dos gráficos de pizza/rosca.
 *
 * Por que existe: no `<Pie>` o recharts monta o `tooltipPayload` sem o campo
 * `color` (diferente do `<Bar>`, que o deriva do `fill`). O tooltip padrão então
 * aplica `color: entry.color || '#000'` — preto sobre o balão escuro, ou seja,
 * texto invisível. Como `itemStyle` só aceita uma cor fixa para todos os itens,
 * a cor por série precisa vir daqui: lemos o `fill` do próprio dado.
 */

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  payload?: { fill?: string };
}

interface Props {
  /** Injetados pelo recharts. */
  active?: boolean;
  payload?: TooltipEntry[];
}

export function PieTooltipContent({ active, payload = [] }: Props) {
  if (!active || payload.length === 0) return null;

  return (
    <div className="rounded-lg bg-[hsl(0,0%,10%)] px-3 py-2 shadow-lg">
      {payload.map((entry, i) => (
        <p key={i} className="text-xs font-medium" style={{ color: entry.payload?.fill }}>
          {entry.name}: <span className="font-mono font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}
