// Central de Auditoria (itens 1 + 2): sessões de acesso e trilha de atividade.
// Endpoints admin (exceto logView, que qualquer autenticado chama ao abrir uma
// tela-chave como a Sala de Situação).
import { http } from './client';

export interface AccessSessionRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  terminalId: string | null;
  loginAt: string;
  logoutAt: string | null;
  status: 'ativa' | 'encerrada' | 'expirada';
  durationMs: number;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AccessStats {
  totalAccess: number;
  activeNow: number;
  avgDurationMs: number;
  distinctUsers: number;
  series: { date: string; count: number }[];
}

export interface ActivityRow {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  resource: string;
  resourceId: string | null;
  terminalId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface ActivityStats {
  total: number;
  distinctUsers: number;
  byAction: { action: string; count: number }[];
  series: { date: string; count: number }[];
}

export interface AccessFilters {
  userId?: string;
  terminalId?: string;
  from?: string;
  to?: string;
  status?: 'ativa' | 'encerrada' | 'expirada' | '';
  limit?: number;
}

export interface ActivityFilters {
  userId?: string;
  terminalId?: string;
  resource?: string;
  action?: string;
  resourceId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

// `object` aceita as interfaces de filtro (que não têm index signature) e os
// literais inline; o cast interno mantém a iteração type-safe.
function qs(params: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const auditApi = {
  accessList: (f: AccessFilters = {}): Promise<AccessSessionRow[]> =>
    http.get<AccessSessionRow[]>(`/audit/access${qs(f)}`),
  accessStats: (r: { from?: string; to?: string; terminalId?: string } = {}): Promise<AccessStats> =>
    http.get<AccessStats>(`/audit/access/stats${qs(r)}`),
  activityList: (f: ActivityFilters = {}): Promise<ActivityRow[]> =>
    http.get<ActivityRow[]>(`/audit/activity${qs(f)}`),
  activityStats: (r: { from?: string; to?: string; terminalId?: string } = {}): Promise<ActivityStats> =>
    http.get<ActivityStats>(`/audit/activity/stats${qs(r)}`),
  /** Registra uma abertura-chave (ex.: Sala de Situação) na trilha de atividade. */
  logView: (input: { action: 'open_situation_room'; resource: 'occurrence'; resourceId: string }): Promise<{ ok: boolean }> =>
    http.post<{ ok: boolean }>('/audit/view', input),
};
