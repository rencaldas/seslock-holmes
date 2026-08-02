import type { BounceSubType, EmailEventType } from "@/lib/supabase/types";

export const DASHBOARD_SHARES_TABLE = "dashboard_shares";

// Subconjunto de OverviewSearchFilters, mesmo espírito de ScheduleFilters em
// scheduled-reports: windowDays é uma janela viva ("últimos N dias"),
// recalculada a cada acesso ao link — não um recorte de datas absolutas.
// timeMode "custom" não é suportado aqui pelo mesmo motivo que não é em
// agendamentos: um instantâneo travado no tempo perde o sentido de "link
// compartilhável" poucos dias depois de criado.
export interface DashboardShareFilters {
  windowDays: number;
  status: "all" | EmailEventType;
  bounceSubType: "all" | BounceSubType;
  origin: string;
  subject: string;
  provider: string;
}

export type DashboardShareExpiryOption = "7d" | "30d" | "90d" | "never";

export interface DashboardShare {
  id: string;
  label: string | null;
  eventsTable: string;
  filters: DashboardShareFilters;
  includeRecentActivity: boolean;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
}

export interface CreateDashboardShareInput {
  token: string;
  label: string;
  eventsTable: string;
  filters: DashboardShareFilters;
  includeRecentActivity: boolean;
  expiresAt: string | null;
}
