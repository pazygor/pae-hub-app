import { useMemo, useState, useEffect, useRef } from 'react';
import L from 'leaflet';

import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Terminal, MapElement, MapLayerType } from '@/lib/types';
import { Ship, AlertTriangle, Siren, MapPin, X, Clock, Plus, Trash2, Layers, Flame, Droplets, Route, TriangleAlert, Flag, Thermometer } from 'lucide-react';
import { useTerminals, usePermissions, useOccurrences, useRisks, useMapElements, useMapElementMutations } from '@/api';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import 'leaflet/dist/leaflet.css';

const LAYER_CONFIG: Record<MapLayerType, { label: string; color: string; icon: typeof Flame }> = {
  fire_equipment: { label: 'Equipamentos de Incêndio', color: 'hsl(0, 72%, 51%)', icon: Flame },
  hydrant: { label: 'Hidrantes', color: 'hsl(210, 79%, 46%)', icon: Droplets },
  evacuation_route: { label: 'Rotas de Evacuação', color: 'hsl(142, 71%, 45%)', icon: Route },
  risk_area: { label: 'Áreas de Risco', color: 'hsl(38, 92%, 50%)', icon: TriangleAlert },
  meeting_point: { label: 'Pontos de Encontro', color: 'hsl(262, 83%, 58%)', icon: Flag },
};

const ALL_LAYER_TYPES: MapLayerType[] = ['fire_equipment', 'hydrant', 'evacuation_route', 'risk_area', 'meeting_point'];

export function EmergencyMapPage() {
  const { user } = useAuth();
  const { data: terminals = [] } = useTerminals();
  const { data: permissions = [] } = usePermissions();
  const { data: occurrences = [] } = useOccurrences();
  const { data: risks = [] } = useRisks();
  const { data: mapElements = [] } = useMapElements();
  const { create: createElement, remove: removeElement } = useMapElementMutations();
  const [selected, setSelected] = useState<Terminal | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<MapLayerType>>(new Set());
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', layerType: 'fire_equipment' as MapLayerType, description: '', terminalId: '' });
  const [selectedElement, setSelectedElement] = useState<MapElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MapElement | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const elementMarkersRef = useRef<L.CircleMarker[]>([]);
  const heatLayerRef = useRef<L.Layer | null>(null);

  const visibleTerminalIds = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return terminals.map(t => t.id);
    if (user.role === 'terminal') return user.linkId ? [user.linkId] : [];
    if (user.role === 'entity') return permissions.find(p => p.entityId === user.linkId)?.terminalIds || [];
    return [];
  }, [user, terminals, permissions]);

  const visibleTerminals = useMemo(() => terminals.filter(t => visibleTerminalIds.includes(t.id)), [terminals, visibleTerminalIds]);

  const visibleElements = useMemo(() =>
    mapElements.filter(el => visibleTerminalIds.includes(el.terminalId) && activeLayers.has(el.layerType)),
    [mapElements, visibleTerminalIds, activeLayers]
  );

  const canEdit = user?.role === 'admin' || user?.role === 'terminal';
  const inputCls = 'w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary';
  const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1';

  const getMarkerColor = (terminalId: string): string => {
    const activeOccurrences = occurrences.filter(o => o.terminalId === terminalId && o.status !== 'resolvido');
    if (activeOccurrences.length > 0) return 'hsl(0, 72%, 51%)';
    const highRisks = risks.filter(r => r.terminalId === terminalId && r.level === 'alto');
    if (highRisks.length > 0) return 'hsl(38, 92%, 50%)';
    return 'hsl(142, 71%, 45%)';
  };

  const getTerminalStats = (terminalId: string) => {
    const tRisks = risks.filter(r => r.terminalId === terminalId);
    const tOccurrences = occurrences.filter(o => o.terminalId === terminalId);
    const openOcc = tOccurrences.filter(o => o.status !== 'resolvido');
    const lastOcc = tOccurrences.length > 0
      ? [...tOccurrences].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())[0]
      : null;
    return { risks: tRisks, openOcc, lastOcc, totalRisks: tRisks.length, highRisks: tRisks.filter(r => r.level === 'alto').length };
  };

  const formatDate = (dt: string) => {
    const d = new Date(dt);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const toggleLayer = (layer: MapLayerType) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      next.has(layer) ? next.delete(layer) : next.add(layer);
      return next;
    });
  };

  const handleAddElement = () => {
    if (!addForm.name.trim()) { toast.error('Informe o nome do elemento'); return; }
    if (!addForm.description.trim()) { toast.error('Informe a descrição do elemento'); return; }
    if (user?.role === 'admin' && !addForm.terminalId) { toast.error('Selecione o terminal'); return; }
    const terminalId = user?.role === 'terminal' ? user.linkId! : addForm.terminalId || visibleTerminalIds[0];
    const terminal = terminals.find(t => t.id === terminalId);
    if (!terminal) { toast.error('Terminal inválido'); return; }
    // Place near terminal with small random offset
    const offset = () => (Math.random() - 0.5) * 0.003;
    createElement.mutate(
      {
        name: addForm.name,
        layerType: addForm.layerType,
        lat: terminal.lat + offset(),
        lng: terminal.lng + offset(),
        description: addForm.description,
        terminalId,
      },
      {
        onSuccess: () => {
          setActiveLayers(prev => new Set(prev).add(addForm.layerType));
          setAddForm({ name: '', layerType: 'fire_equipment', description: '', terminalId: '' });
          setShowAddForm(false);
          toast.success('Elemento adicionado ao mapa');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao adicionar elemento'),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    removeElement.mutate(deleteTarget.id, {
      onSuccess: () => { setSelectedElement(null); toast.success(`Elemento "${name}" removido`); },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao remover elemento'),
    });
    setDeleteTarget(null);
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const center: [number, number] = visibleTerminals.length > 0
      ? [visibleTerminals.reduce((s, t) => s + t.lat, 0) / visibleTerminals.length, visibleTerminals.reduce((s, t) => s + t.lng, 0) / visibleTerminals.length]
      : [-23.9618, -46.3322];
    const map = L.map(mapContainerRef.current).setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update terminal markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    visibleTerminals.forEach(t => {
      const color = getMarkerColor(t.id);
      const marker = L.circleMarker([t.lat, t.lng], { radius: 14, fillColor: color, color: '#ffffff', weight: 3, fillOpacity: 0.9 }).addTo(map);
      marker.bindTooltip(t.name, { direction: 'top', offset: [0, -10] });
      marker.on('click', () => { setSelected(t); setSelectedElement(null); });
      markersRef.current.push(marker);
    });
    if (visibleTerminals.length > 0) {
      const bounds = L.latLngBounds(visibleTerminals.map(t => [t.lat, t.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [visibleTerminals, occurrences, risks]);

  // Update element markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    elementMarkersRef.current.forEach(m => m.remove());
    elementMarkersRef.current = [];
    visibleElements.forEach(el => {
      const cfg = LAYER_CONFIG[el.layerType];
      const marker = L.circleMarker([el.lat, el.lng], {
        radius: 8,
        fillColor: cfg.color,
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.85,
      }).addTo(map);
      marker.bindTooltip(el.name, { direction: 'top', offset: [0, -8] });
      marker.on('click', () => { setSelectedElement(el); setSelected(null); });
      elementMarkersRef.current.push(marker);
    });
  }, [visibleElements]);

  // Heatmap layer based on risks (canvas overlay, no external dependency)
  const heatPointsRef = useRef<{ lat: number; lng: number; intensity: number }[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (!showHeatmap) return;

    const visibleRisks = risks.filter(r => visibleTerminalIds.includes(r.terminalId));
    const points: { lat: number; lng: number; intensity: number }[] = [];

    visibleRisks.forEach(risk => {
      const terminal = terminals.find(t => t.id === risk.terminalId);
      if (!terminal) return;
      const intensity = risk.level === 'alto' ? 1.0 : risk.level === 'médio' ? 0.5 : 0.2;
      const offset = () => (Math.random() - 0.5) * 0.002;
      points.push({ lat: terminal.lat + offset(), lng: terminal.lng + offset(), intensity });
    });

    heatPointsRef.current = points;

    if (points.length === 0) return;

    const CanvasHeatOverlay = L.Layer.extend({
      onAdd(map: L.Map) {
        this._map = map;
        const pane = map.getPane('overlayPane')!;
        const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer') as HTMLCanvasElement;
        canvas.style.position = 'absolute';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '400';
        pane.appendChild(canvas);
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d')!;
        map.on('moveend zoomend resize', this._redraw, this);
        this._redraw();
      },
      onRemove(map: L.Map) {
        map.off('moveend zoomend resize', this._redraw, this);
        if (this._canvas && this._canvas.parentNode) {
          this._canvas.parentNode.removeChild(this._canvas);
        }
      },
      _redraw() {
        const map = this._map;
        const canvas = this._canvas as HTMLCanvasElement;
        const ctx = this._ctx as CanvasRenderingContext2D;
        const size = map.getSize();
        const topLeft = map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(canvas, topLeft);
        canvas.width = size.x;
        canvas.height = size.y;
        ctx.clearRect(0, 0, size.x, size.y);

        const pts = heatPointsRef.current;
        const radius = 40;

        // Draw each point as a radial gradient on a temporary canvas
        pts.forEach(pt => {
          const point = map.latLngToContainerPoint([pt.lat, pt.lng]);
          const grad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
          grad.addColorStop(0, `rgba(255, 0, 0, ${pt.intensity * 0.6})`);
          grad.addColorStop(0.5, `rgba(255, 165, 0, ${pt.intensity * 0.3})`);
          grad.addColorStop(1, 'rgba(0, 255, 0, 0)');
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        });
      },
    });

    const overlay = new CanvasHeatOverlay();
    overlay.addTo(map);
    heatLayerRef.current = overlay;
  }, [showHeatmap, risks, visibleTerminalIds, terminals]);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-foreground">Mapa de Emergência dos Terminais</h2>
        </div>
        {canEdit && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity">
            <Plus size={14} /> Novo Elemento
          </button>
        )}
      </div>

      {/* Add element form */}
      {showAddForm && canEdit && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome do elemento *</label>
              <input placeholder="Ex.: Extintor CO₂ berço 3" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Camada</label>
              <Select value={addForm.layerType} onValueChange={v => setAddForm(f => ({ ...f, layerType: v as MapLayerType }))}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_LAYER_TYPES.map(lt => <SelectItem key={lt} value={lt} className="cursor-pointer">{LAYER_CONFIG[lt].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {user.role === 'admin' && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Terminal *</label>
                <Select value={addForm.terminalId} onValueChange={v => setAddForm(f => ({ ...f, terminalId: v }))}>
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Selecione o terminal..." /></SelectTrigger>
                  <SelectContent>
                    {visibleTerminals.map(t => <SelectItem key={t.id} value={t.id} className="cursor-pointer">{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Descrição *</label>
            <textarea placeholder="Descreva o elemento..." value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} min-h-[50px]`} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddElement} disabled={createElement.isPending} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-md cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60">Cadastrar</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-md cursor-pointer hover:bg-secondary/80 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-success" /> Sem ocorrências</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-warning" /> Risco alto</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary" /> Ocorrência ativa</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Map area */}
        <div className="flex-1 relative">
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ minHeight: 480 }}>
            <div ref={mapContainerRef} style={{ height: '100%', width: '100%', minHeight: 480 }} />
          </div>

          {/* Layer panel overlay */}
          <div className="absolute top-3 right-3 z-[1000]">
            <button
              onClick={() => setShowLayerPanel(!showLayerPanel)}
              className="flex items-center gap-1.5 px-3 py-2 bg-card/95 backdrop-blur-sm border border-border rounded-lg text-xs font-bold text-foreground shadow-md hover:bg-secondary/80 transition-colors"
            >
              <Layers size={14} /> Camadas
            </button>
            {showLayerPanel && (
              <div className="mt-2 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg p-3 min-w-[220px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Camadas do Mapa</p>
                <div className="space-y-1.5">
                  {ALL_LAYER_TYPES.map(lt => {
                    const cfg = LAYER_CONFIG[lt];
                    const Icon = cfg.icon;
                    const isActive = activeLayers.has(lt);
                    const count = mapElements.filter(el => visibleTerminalIds.includes(el.terminalId) && el.layerType === lt).length;
                    return (
                      <button
                        key={lt}
                        onClick={() => toggleLayer(lt)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                          isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                          isActive ? 'border-primary bg-primary' : 'border-muted-foreground/30 bg-background'
                        }`}>
                          {isActive && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                        </div>
                        <Icon size={13} style={{ color: cfg.color }} />
                        <span className="flex-1 text-left font-medium">{cfg.label}</span>
                        <span className="text-[10px] font-mono bg-background px-1.5 py-0.5 rounded-full">{count}</span>
                      </button>
                    );
                  })}

                  {/* Heatmap toggle */}
                  <div className="border-t border-border mt-2 pt-2">
                    <button
                      onClick={() => setShowHeatmap(!showHeatmap)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        showHeatmap ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                        showHeatmap ? 'border-primary bg-primary' : 'border-muted-foreground/30 bg-background'
                      }`}>
                        {showHeatmap && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                      </div>
                      <Thermometer size={13} className="text-primary" />
                      <span className="flex-1 text-left font-medium">Mapa de Calor</span>
                      <span className="text-[10px] font-mono bg-background px-1.5 py-0.5 rounded-full">
                        {risks.filter(r => visibleTerminalIds.includes(r.terminalId)).length}
                      </span>
                    </button>
                    {showHeatmap && (
                      <div className="mt-1.5 px-2.5 flex items-center gap-2 text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} /> Baixo</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#eab308' }} /> Médio</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} /> Alto</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-80 shrink-0">
          {selectedElement ? (() => {
            const cfg = LAYER_CONFIG[selectedElement.layerType];
            const Icon = cfg.icon;
            const terminal = terminals.find(t => t.id === selectedElement.terminalId);
            const canDelete = user.role === 'admin' || (user.role === 'terminal' && user.linkId === selectedElement.terminalId);
            return (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border" style={{ borderTopWidth: 4, borderTopColor: cfg.color, borderTopStyle: 'solid' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={16} style={{ color: cfg.color }} />
                      <h3 className="font-bold text-foreground text-sm">{selectedElement.name}</h3>
                    </div>
                    <button onClick={() => setSelectedElement(null)} className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"><X size={16} /></button>
                  </div>
                  <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div>
                    <p className="text-muted-foreground text-[10px] font-bold uppercase mb-1">Descrição</p>
                    <p className="text-foreground">{selectedElement.description}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terminal</span>
                    <span className="font-medium text-foreground">{terminal?.name || selectedElement.terminalId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coordenadas</span>
                    <span className="font-mono text-foreground text-[10px]">{selectedElement.lat.toFixed(4)}, {selectedElement.lng.toFixed(4)}</span>
                  </div>
                </div>
                {canDelete && (
                  <div className="p-4 border-t border-border">
                    <button onClick={() => setDeleteTarget(selectedElement)} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer">
                      <Trash2 size={13} /> Remover elemento
                    </button>
                  </div>
                )}
              </div>
            );
          })() : selected ? (() => {
            const stats = getTerminalStats(selected.id);
            const color = getMarkerColor(selected.id);
            const statusLabel = stats.openOcc.length > 0 ? 'Ocorrência Ativa' : stats.highRisks > 0 ? 'Risco Alto' : 'Normal';
            const terminalElements = mapElements.filter(el => el.terminalId === selected.id);
            return (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border" style={{ borderTopWidth: 4, borderTopColor: color, borderTopStyle: 'solid' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{selected.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{selected.location}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"><X size={16} /></button>
                  </div>
                  <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: `${color}15`, color }}>{statusLabel}</span>
                </div>

                <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                  <div className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <AlertTriangle size={12} className="text-warning" />
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Riscos</p>
                    </div>
                    <p className="text-2xl font-mono-data font-bold text-foreground">{stats.totalRisks.toString().padStart(2, '0')}</p>
                    {stats.highRisks > 0 && <p className="text-[10px] text-primary font-bold">{stats.highRisks} crítico(s)</p>}
                  </div>
                  <div className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Siren size={12} className="text-primary" />
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Abertas</p>
                    </div>
                    <p className="text-2xl font-mono-data font-bold text-foreground">{stats.openOcc.length.toString().padStart(2, '0')}</p>
                  </div>
                </div>

                {stats.lastOcc && (
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-1 mb-2">
                      <Clock size={12} className="text-muted-foreground" />
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Última Ocorrência</p>
                    </div>
                    <p className="text-sm font-medium text-foreground">{stats.lastOcc.type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stats.lastOcc.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono-data">{formatDate(stats.lastOcc.dateTime)}</p>
                  </div>
                )}

                <div className="p-4 space-y-2 text-xs border-b border-border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Responsável</span>
                    <span className="font-medium text-foreground">{selected.responsible}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contato</span>
                    <span className="font-mono-data text-foreground">{selected.contact}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selected.status === 'Ativo' ? 'bg-success/10 text-success' : selected.status === 'Revisão' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                    }`}>{selected.status}</span>
                  </div>
                </div>

                {/* Terminal elements summary */}
                {terminalElements.length > 0 && (
                  <div className="p-4 border-b border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Elementos no Mapa</p>
                    <div className="space-y-1">
                      {ALL_LAYER_TYPES.map(lt => {
                        const count = terminalElements.filter(el => el.layerType === lt).length;
                        if (count === 0) return null;
                        const cfg = LAYER_CONFIG[lt];
                        const Icon = cfg.icon;
                        return (
                          <div key={lt} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <Icon size={11} style={{ color: cfg.color }} />
                              <span className="text-muted-foreground">{cfg.label}</span>
                            </div>
                            <span className="font-mono text-foreground font-bold">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stats.openOcc.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ocorrências Ativas</p>
                    <div className="divide-y divide-border">
                      {stats.openOcc.map(o => (
                        <div key={o.id} className="px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-foreground">{o.type}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(o.dateTime)}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            o.status === 'aberto' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                          }`}>{o.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 300 }}>
              <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mb-3">
                <Ship size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Selecione um terminal</p>
              <p className="text-xs text-muted-foreground">Clique em um marcador no mapa para ver os detalhes do terminal.</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmação de remoção (AlertDialog — substitui a remoção direta) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="p-1.5 bg-primary/10 rounded-lg"><Trash2 size={16} className="text-primary" /></span>
              Remover elemento do mapa?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O elemento <strong className="text-foreground font-semibold">{deleteTarget?.name}</strong>
              {deleteTarget && <> ({LAYER_CONFIG[deleteTarget.layerType].label})</>} será removido do mapa de emergência.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
