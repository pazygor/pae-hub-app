import { ReactNode, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { toast } from 'sonner';
import { Loader2, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { geocodingApi, lookupCep } from '@/api';
import { formatCEP } from '@/lib/masks';
import 'leaflet/dist/leaflet.css';

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

// Centro padrão quando ainda não há coordenadas (Porto de Santos — mesmo default do mapa).
const DEFAULT_CENTER: [number, number] = [-23.9618, -46.3322];
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

// PIN via divIcon (SVG inline) — o ícone padrão do Leaflet quebra no bundler
// (assets png); as outras telas usam CircleMarker, mas ele não é arrastável.
const PIN_ICON = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 25 15 25s15-13.8 15-25C30 6.7 23.3 0 15 0z" fill="hsl(0,72%,51%)" stroke="#fff" stroke-width="2"/>
    <circle cx="15" cy="15" r="5.5" fill="#fff"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 38],
});

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
  // decimais; sincroniza quando a coordenada muda por fora (Localizar/edição/PIN).
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  // Mini-mapa do PIN (item 5): clicar/arrastar ↔ lat/lng + endereço (reverso).
  const [reverseLoading, setReverseLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Handlers do Leaflet são registrados uma vez; a ref evita closure sobre um onChange antigo.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // PIN manual (clique/arrasto): grava lat/lng na hora e busca o endereço reverso
  // para SUBSTITUIR o endereço anterior (decisão 2026-07-18). Reatribuída a cada
  // render e guardada em ref — os handlers do Leaflet são registrados só uma vez.
  const applyPinRef = useRef<(lat: number, lng: number) => void>(() => {});
  applyPinRef.current = (lat: number, lng: number) => {
    const rlat = round6(lat), rlng = round6(lng);
    onChangeRef.current({ lat: rlat, lng: rlng });
    setReverseLoading(true);
    geocodingApi.address({ latitude: rlat, longitude: rlng })
      .then(addr => {
        // Substituição completa: campo que o reverso não trouxer fica vazio, para o
        // endereço nunca misturar o ponto novo com resíduo do antigo. Sem resposta
        // (rede/erro) mantém o endereço atual — não apaga à toa.
        if (addr) onChangeRef.current({
          cep: addr.cep ? formatCEP(addr.cep) : '',
          street: addr.street ?? '',
          number: addr.number ?? '',
          neighborhood: addr.neighborhood ?? '',
          city: addr.city ?? '',
          state: addr.state ?? '',
        });
      })
      .catch(() => { /* silencioso: lat/lng já atualizados; endereço preservado */ })
      .finally(() => setReverseLoading(false));
  };

  useEffect(() => {
    if (parseFloat(latText) !== value.lat) setLatText(value.lat ? String(value.lat) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lat]);
  useEffect(() => {
    if (parseFloat(lngText) !== value.lng) setLngText(value.lng ? String(value.lng) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lng]);

  // Cria o mini-mapa (uma vez). scrollWheelZoom desligado para não sequestrar o
  // scroll do formulário; zoom pelos botões ou duplo clique.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const hasCoords = !!(value.lat && value.lng);
    const map = L.map(mapContainerRef.current, { scrollWheelZoom: false })
      .setView(hasCoords ? [value.lat, value.lng] : DEFAULT_CENTER, hasCoords ? 16 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      applyPinRef.current(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;
    // Formulários abrem com animação/condicional — recalcula o tamanho após o layout
    // para não renderizar tiles cinza.
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza o PIN com lat/lng (Localizar, edição manual ou clique/arrasto).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value.lat && !value.lng) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const pos: [number, number] = [value.lat, value.lng];
    if (!markerRef.current) {
      const marker = L.marker(pos, { draggable: true, icon: PIN_ICON, title: 'Arraste para ajustar a posição' });
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        applyPinRef.current(p.lat, p.lng);
      });
      marker.addTo(map);
      markerRef.current = marker;
      map.setView(pos, Math.max(map.getZoom(), 15));
    } else {
      markerRef.current.setLatLng(pos);
      // Recentraliza só se o PIN saiu da vista (ex.: Localizar mudou a cidade).
      if (!map.getBounds().contains(pos)) map.setView(pos, Math.max(map.getZoom(), 15));
    }
  }, [value.lat, value.lng]);

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

      {/* PIN no mapa (item 5): clicar/arrastar posiciona → atualiza lat/lng E o endereço (reverso) */}
      <div>
        <label className={labelCls}>PIN no mapa</label>
        <div className="relative z-0 rounded-lg border border-border overflow-hidden">
          <div ref={mapContainerRef} className="h-56 w-full" />
          {reverseLoading && (
            <div className="absolute top-2 right-2 z-[400] flex items-center gap-1.5 bg-card/95 border border-border rounded-md px-2 py-1 text-[10px] font-bold text-muted-foreground shadow-sm">
              <Loader2 size={12} className="animate-spin" /> Buscando endereço…
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {coordsOk
            ? <>Arraste o <strong>PIN</strong> (ou clique no mapa) para ajustar — o <strong>endereço</strong> é atualizado pelo ponto.</>
            : <>Clique no mapa para <strong>posicionar o PIN</strong> — ou use o botão Localizar pelo endereço.</>}
        </p>
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
        {hint ?? <>Preencha o CEP para completar o endereço; clique em <strong>Localizar</strong> para obter as coordenadas — você pode ajustar pelo <strong>PIN no mapa</strong> ou pela <strong>latitude/longitude</strong> antes de salvar.</>}
      </p>
    </div>
  );
}
