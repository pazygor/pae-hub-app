// Endpoints de Dashboard/COP (/dashboard) — Fase 2.
import { http } from './client';

export interface DashboardKpis {
  summary: {
    totalOccurrences: number;
    openOccurrences: number;
    activeEmergencies: number;
    criticalOccurrences: number;
    resolvedLast24h: number;
    newLast24h: number;
    activeAlerts: number;
    overdueItems: number;
    avgResolutionHours: number;
  };
  charts: {
    occurrencesByStatus: { status: string; count: number }[];
    occurrencesByCriticality: { criticality: string; count: number }[];
  };
  recentOccurrences: {
    id: string;
    incNumber: string;
    type: string;
    criticality: string;
    status: string;
    createdAt: string;
    terminalName?: string;
  }[];
}

export interface CopIndicators {
  openOccurrences: number;
  inProgressOccurrences: number;
  activeEmergencies: number;
  criticalOccurrences: number;
  resolvedOccurrences: number;
  totalOccurrences: number;
}

export const dashboardApi = {
  kpis: (terminalId?: string): Promise<DashboardKpis> =>
    http.get<DashboardKpis>(`/dashboard/kpis${terminalId ? `?terminalId=${terminalId}` : ''}`),
  copIndicators: (terminalId?: string): Promise<CopIndicators> =>
    http.get<CopIndicators>(`/dashboard/cop-indicators${terminalId ? `?terminalId=${terminalId}` : ''}`),
};
