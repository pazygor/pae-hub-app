import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useAuth } from '@/lib/auth-context';
import { Terminal, TimelineEvent } from '@/lib/types';
import { Ship, AlertTriangle, Siren, Clock, CheckCircle, Shield, User, Bell, Play, RefreshCw, MapPin, Radio } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { situationRoomPath } from '@/lib/nav-config';
import 'leaflet/dist/leaflet.css';

export function CopPage() {
  const navigate = useNavigate();
  const openSituationRoom = (id: string) => navigate(situationRoomPath(id));
  const { user, data } = useAuth();
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  const visibleTerminalIds = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return data.terminals.map(t => t.id);
    if (user.role === 'terminal') return user.linkId ? [user.linkId] : [];
    if (user.role === 'entity') return data.permissions.find(p => p.entityId === user.linkId)?.terminalIds || [];
    return [];
  }, [user, data]);

  const visibleTerminals = useMemo(() => data.terminals.filter(t => visibleTerminalIds.includes(t.id)), [data.terminals, visibleTerminalIds]);
  const risks = useMemo(() => data.risks.filter(r => visibleTerminalIds.includes(r.terminalId)), [data.risks, visibleTerminalIds]);
  const occurrences = useMemo(() => data.occurrences.filter(o => visibleTerminalIds.includes(o.terminalId)), [data.occurrences, visibleTerminalIds]);

  const openOccurrences = occurrences.filter(o => o.status !== 'resolvido');
  const emergencyOccurrences = occurrences.filter(o => o.criticality === 'crítica' || o.status === 'emergência ativa');
  const highRisks = risks.filter(r => r.level === 'alto');
  const resolvedLast24h = occurrences.filter(o => {
    if (o.status !== 'resolvido') return false;
    const resolved = o.timeline?.find(e => e.type === 'ocorrência resolvida');
    if (!resolved) return false;
    return (Date.now() - new Date(resolved.dateTime).getTime()) < 86400000;
  });

  // Gather all timeline events across visible occurrences
  const allTimelineEvents = useMemo(() => {
    const events: (TimelineEvent & { terminalName: string; occType: string })[] = [];
    occurrences.forEach(o => {
      const tName = data.terminals.find(t => t.id === o.terminalId)?.name || '';
      (o.timeline || []).forEach(ev => {
        events.push({ ...ev, terminalName: tName, occType: o.type });
      });
    });
    return events.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).slice(0, 15);
  }, [occurrences, data.terminals]);

  const getMarkerColor = (terminalId: string): string => {
    const active = data.occurrences.filter(o => o.terminalId === terminalId && o.status !== 'resolvido');
    if (active.length > 0) return 'hsl(0, 72%, 51%)';
    const high = data.risks.filter(r => r.terminalId === terminalId && r.level === 'alto');
    if (high.length > 0) return 'hsl(38, 92%, 50%)';
    return 'hsl(142, 71%, 45%)';
  };

  const formatTime = (dt: string) => new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dt: string) => {
    const d = new Date(dt);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const eventIcon = (type: string) => {
    switch (type) {
      case 'ocorrência registrada': return <AlertTriangle size={12} />;
      case 'equipe acionada': return <User size={12} />;
      case 'plano de emergência ativado': return <Play size={12} />;
      case 'entidade notificada': return <Bell size={12} />;
      case 'ação executada': return <CheckCircle size={12} />;
      case 'atualização de status': return <RefreshCw size={12} />;
      case 'ocorrência resolvida': return <CheckCircle size={12} />;
      default: return <Clock size={12} />;
    }
  };

  // Map init
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const center: [number, number] = visibleTerminals.length > 0
      ? [visibleTerminals.reduce((s, t) => s + t.lat, 0) / visibleTerminals.length, visibleTerminals.reduce((s, t) => s + t.lng, 0) / visibleTerminals.length]
      : [-23.9618, -46.3322];

    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(center, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    visibleTerminals.forEach(t => {
      const color = getMarkerColor(t.id);
      const marker = L.circleMarker([t.lat, t.lng], {
        radius: 12, fillColor: color, color: '#ffffff', weight: 2, fillOpacity: 0.95,
      }).addTo(map);
      marker.bindTooltip(t.name, { direction: 'top', offset: [0, -10], className: 'cop-tooltip' });
      marker.on('click', () => setSelectedTerminal(t));
      markersRef.current.push(marker);
    });
    if (visibleTerminals.length > 0) {
      map.fitBounds(L.latLngBounds(visibleTerminals.map(t => [t.lat, t.lng] as [number, number])), { padding: [40, 40], maxZoom: 14 });
    }
  }, [visibleTerminals, data.occurrences, data.risks]);

  if (!user) return null;

  const selectedStats = selectedTerminal ? (() => {
    const tRisks = data.risks.filter(r => r.terminalId === selectedTerminal.id);
    const tOcc = data.occurrences.filter(o => o.terminalId === selectedTerminal.id);
    return { risks: tRisks.length, highRisks: tRisks.filter(r => r.level === 'alto').length, openOcc: tOcc.filter(o => o.status !== 'resolvido').length, totalOcc: tOcc.length };
  })() : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-primary" />
          <div>
            <h2 className="text-lg font-black text-foreground leading-tight">Centro de Operações Portuárias</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Monitoramento em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] font-bold text-success uppercase tracking-wider">Sistema Ativo</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Terminais" value={visibleTerminals.length} variant="accent" icon={Ship} />
        <StatCard label="Ocorrências Abertas" value={openOccurrences.length} variant={openOccurrences.length > 0 ? 'warning' : 'default'} icon={Siren} />
        <StatCard label="Riscos Críticos" value={highRisks.length} variant={highRisks.length > 0 ? 'emergency' : 'default'} icon={AlertTriangle} />
        <StatCard label="Resolvidas (24h)" value={resolvedLast24h.length} variant="success" icon={CheckCircle} />
      </div>

      {/* Emergências Ativas - Quick access to Situation Room */}
      {emergencyOccurrences.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-primary/20 flex items-center gap-2">
            <Radio size={14} className="text-primary animate-pulse" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Emergências Ativas</h3>
            <span className="ml-auto text-[10px] font-mono-data bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{emergencyOccurrences.length}</span>
          </div>
          <div className="divide-y divide-primary/10">
            {emergencyOccurrences.map(o => (
              <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-mono bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{o.incNumber}</span>
                    <span className="text-xs font-bold text-foreground">{o.type}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      o.status === 'emergência ativa' ? 'bg-primary/20 text-primary font-black' : 'bg-primary/10 text-primary'
                    }`}>{o.status}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      o.criticality === 'crítica' ? 'bg-primary/20 text-primary font-black' : 'bg-warning/10 text-warning'
                    }`}>{o.criticality}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{data.terminals.find(t => t.id === o.terminalId)?.name} · {formatDate(o.dateTime)}</p>
                </div>
                <button
                  onClick={() => openSituationRoom(o.id)}
                  className="px-3 py-2 text-[10px] font-bold bg-primary text-primary-foreground rounded-lg shadow-lg shadow-primary/30 animate-pulse hover:animate-none hover:opacity-90 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Radio size={12} /> Abrir Sala de Situação
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map (spans 2 cols) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden relative" style={{ minHeight: 420 }}>
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%', minHeight: 420 }} />
          {/* Legend overlay */}
          <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 flex gap-3 text-[10px] z-[1000]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> Risco alto</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Ocorrência</span>
          </div>
          {/* Selected terminal overlay */}
          {selectedTerminal && selectedStats && (
            <div className="absolute top-3 left-3 bg-card/95 backdrop-blur border border-border rounded-xl p-4 w-72 z-[1000] shadow-lg">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-sm text-foreground">{selectedTerminal.name}</h4>
                <button onClick={() => setSelectedTerminal(null)} className="text-muted-foreground hover:text-foreground"><MapPin size={14} /></button>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">{selectedTerminal.location}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-background rounded-lg p-2">
                  <p className="text-lg font-mono-data font-bold text-foreground">{selectedStats.openOcc.toString().padStart(2, '0')}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Abertas</p>
                </div>
                <div className="bg-background rounded-lg p-2">
                  <p className="text-lg font-mono-data font-bold text-foreground">{selectedStats.highRisks.toString().padStart(2, '0')}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Críticos</p>
                </div>
                <div className="bg-background rounded-lg p-2">
                  <p className="text-lg font-mono-data font-bold text-foreground">{selectedStats.risks.toString().padStart(2, '0')}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">Riscos</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: active occurrences */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 420 }}>
          <div className="p-3 border-b border-border flex items-center gap-2 shrink-0">
            <Siren size={14} className="text-primary" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Ocorrências Ativas</h3>
            <span className="ml-auto text-[10px] font-mono-data bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{openOccurrences.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {openOccurrences.length === 0 && (
              <div className="p-6 text-center">
                <CheckCircle size={24} className="text-success mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma ocorrência ativa</p>
              </div>
            )}
            {openOccurrences.map(o => (
              <div key={o.id} className="px-3 py-2.5 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-foreground">{o.type}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    o.status === 'aberto' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                  }`}>{o.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{data.terminals.find(t => t.id === o.terminalId)?.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono-data">{formatDate(o.dateTime)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline operacional */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Linha do Tempo Operacional</h3>
        </div>
        <div className="p-4 pl-6">
          {allTimelineEvents.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum evento registrado.</p>}
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-3">
              {allTimelineEvents.map((ev, i) => (
                <div key={ev.id + i} className="relative flex gap-3">
                  <div className="relative z-10 w-4 h-4 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5 ring-2 ring-card text-muted-foreground">
                    {eventIcon(ev.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono-data text-muted-foreground">{formatTime(ev.dateTime)}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{ev.terminalName}</span>
                    </div>
                    <p className="text-xs text-foreground">{ev.description}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User size={9} /> {ev.userName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
