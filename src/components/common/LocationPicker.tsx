import { ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { geocodingApi, lookupCep } from '@/api';
import { formatCEP } from '@/lib/masks';

const UF_OPTIONS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export interface LocationValue {
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
}

interface Props {
  value: LocationValue;
  onChange: (patch: Partial<LocationValue>) => void;
  /** Palavra usada nas mensagens ("terminal", "elemento", "risco"). */
  entityLabel?: string;
  /** Texto de ajuda opcional abaixo dos campos. */
  hint?: ReactNode;
}

const inputCls = 'w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1';

/**
 * Bloco reutilizável de localização: endereço (com CEP-autofill) + botão Localizar
 * (geocodifica no back, considerando o número — Fase 6) + latitude/longitude
 * EDITÁVEIS (o Localizar preenche, mas o usuário pode ajustar o pin na mão).
 * Usado em Terminais, Mapa de Emergência e Riscos.
 */
export function LocationPicker({ value, onChange, entityLabel = 'endereço', hint }: Props) {
  const [cepLoading, setCepLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  // Texto local dos campos lat/lng — evita reescrever enquanto o usuário digita
  // decimais; sincroniza quando a coordenada muda por fora (Localizar/edição).
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');

  useEffect(() => {
    if (parseFloat(latText) !== value.lat) setLatText(value.lat ? String(value.lat) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lat]);
  useEffect(() => {
    if (parseFloat(lngText) !== value.lng) setLngText(value.lng ? String(value.lng) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lng]);

  const coordsOk = !!(value.lat && value.lng);
  const fieldSpinner = cepLoading
    ? <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    : null;

  const onCepChange = async (raw: string) => {
    const masked = formatCEP(raw);
    onChange({ cep: masked });
    if (masked.replace(/\D/g, '').length === 8) {
      setCepLoading(true);
      try {
        const addr = await lookupCep(masked);
        if (addr) {
          onChange({
            street: addr.street ?? value.street,
            neighborhood: addr.neighborhood ?? value.neighborhood,
            city: addr.city ?? value.city,
            state: addr.state ?? value.state,
          });
        }
      } finally {
        setCepLoading(false);
      }
    }
  };

  const localizar = async () => {
    setGeocoding(true);
    try {
      const coords = await geocodingApi.coordinates({
        cep: value.cep, street: value.street, number: value.number,
        neighborhood: value.neighborhood, city: value.city, state: value.state,
      });
      if (coords) {
        onChange({ lat: coords.latitude, lng: coords.longitude });
        toast.success('Localizado — coordenadas atualizadas');
      } else {
        toast.warning('Não foi possível localizar. Verifique o CEP/endereço.');
      }
    } catch {
      toast.error(`Falha ao localizar o ${entityLabel}`);
    } finally {
      setGeocoding(false);
    }
  };

  const onLatText = (t: string) => { setLatText(t); const n = parseFloat(t); onChange({ lat: isNaN(n) ? 0 : n }); };
  const onLngText = (t: string) => { setLngText(t); const n = parseFloat(t); onChange({ lng: isNaN(n) ? 0 : n }); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>CEP</label>
          <div className="relative">
            <input value={value.cep ?? ''} onChange={e => onCepChange(e.target.value)} placeholder="00000-000" inputMode="numeric" className={`${inputCls} ${cepLoading ? 'pr-9' : ''}`} />
            {fieldSpinner}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Rua / Logradouro</label>
          <div className="relative">
            <input value={value.street ?? ''} onChange={e => onChange({ street: e.target.value })} disabled={cepLoading} className={`${inputCls} ${cepLoading ? 'pr-9 opacity-60' : ''}`} />
            {fieldSpinner}
          </div>
        </div>
        <div>
          <label className={labelCls}>Número</label>
          <input value={value.number ?? ''} onChange={e => onChange({ number: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Bairro</label>
          <div className="relative">
            <input value={value.neighborhood ?? ''} onChange={e => onChange({ neighborhood: e.target.value })} disabled={cepLoading} className={`${inputCls} ${cepLoading ? 'pr-9 opacity-60' : ''}`} />
            {fieldSpinner}
          </div>
        </div>
        <div>
          <label className={labelCls}>Cidade</label>
          <div className="relative">
            <input value={value.city ?? ''} onChange={e => onChange({ city: e.target.value })} disabled={cepLoading} className={`${inputCls} ${cepLoading ? 'pr-9 opacity-60' : ''}`} />
            {fieldSpinner}
          </div>
        </div>
        <div>
          <label className={labelCls}>Estado (UF)</label>
          <Select value={value.state || undefined} onValueChange={v => onChange({ state: v })} disabled={cepLoading}>
            <SelectTrigger className={`cursor-pointer ${cepLoading ? 'opacity-60' : ''}`}>
              {cepLoading ? <Loader2 size={14} className="animate-spin text-muted-foreground" /> : <SelectValue placeholder="UF" />}
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {UF_OPTIONS.map(uf => <SelectItem key={uf} value={uf} className="cursor-pointer">{uf}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Localizar + coordenadas editáveis */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={localizar}
          disabled={geocoding || (!value.cep && !value.city)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-secondary text-secondary-foreground rounded-md border border-border cursor-pointer hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {geocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          {coordsOk ? 'Atualizar localização' : 'Localizar'}
        </button>
        {coordsOk ? (
          <span className="flex items-center gap-1.5 text-xs text-success font-medium">
            <CheckCircle2 size={14} /> Localizado
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-warning font-medium">
            <AlertTriangle size={14} /> Coordenadas não configuradas
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className={labelCls}>Latitude</label>
          <input value={latText} onChange={e => onLatText(e.target.value)} inputMode="decimal" placeholder="-23.96083" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Longitude</label>
          <input value={lngText} onChange={e => onLngText(e.target.value)} inputMode="decimal" placeholder="-46.33218" className={inputCls} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {hint ?? <>Preencha o CEP para completar o endereço; clique em <strong>Localizar</strong> para obter as coordenadas — você pode <strong>ajustar a latitude/longitude manualmente</strong> antes de salvar.</>}
      </p>
    </div>
  );
}
