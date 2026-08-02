// Busca os dados de um link de dashboard compartilhado (/share/:token).
//
// Diferente do resto do app, este caminho não usa o client do
// SupabaseProvider: quem abre um link compartilhado não tem sessão nem
// Configurações salvas, então a URL do projeto e a anon key vêm embutidas no
// próprio link (ver buildShareUrl em dashboard-shares/link.ts). Isso é seguro
// porque anon key nunca foi segredo neste app — já vai no bundle público do
// projeto padrão hoje; aqui só está explícita para funcionar também com um
// projeto próprio, sem exigir que o visitante tenha configurado nada.
//
// A única credencial que importa é o token da URL, validado no banco por
// get_shared_dashboard (SECURITY DEFINER, ver a migration 20260802120000).

import { createClient } from "@supabase/supabase-js";
import type { AppLanguage } from "@/lib/i18n/types";
import { buildOverviewAnalyticsFromAggregate, type OverviewAnalytics } from "@/lib/overview/analytics";
import type { EventTimeSeriesPoint, TimeSeriesGranularity } from "@/lib/overview/timeseries";
import { fillTimeSeriesGaps, type OverviewAggregateResponse } from "@/lib/supabase/queries/overview-aggregate";
import { rowToEmailEvent } from "@/lib/supabase/aws-sns";
import type { EmailEvent, EmailEventRow } from "@/lib/supabase/types";
import type { DashboardShareFilters } from "@/lib/dashboard-shares/types";

export type SharedDashboardErrorReason = "not_found" | "revoked" | "expired";

export class SharedDashboardError extends Error {
  reason: SharedDashboardErrorReason;

  constructor(reason: SharedDashboardErrorReason) {
    super(`shared dashboard: ${reason}`);
    this.reason = reason;
  }
}

interface GetSharedDashboardResponse {
  error?: SharedDashboardErrorReason;
  label: string | null;
  filters: DashboardShareFilters;
  includeRecentActivity: boolean;
  analytics: OverviewAggregateResponse;
  events: { items: EmailEventRow[]; totalCount: number } | null;
}

export interface SharedDashboardResult {
  label: string | null;
  filters: DashboardShareFilters;
  analytics: OverviewAnalytics;
  uniqueMessagesCount: number;
  timeSeries: { points: EventTimeSeriesPoint[]; granularity: TimeSeriesGranularity };
  recentEvents: EmailEvent[] | null;
}

export async function fetchSharedDashboard(
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string,
  language: AppLanguage,
): Promise<SharedDashboardResult> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await client.rpc("get_shared_dashboard", { p_token: token });

  if (error) {
    throw error;
  }

  const response = data as GetSharedDashboardResponse;

  if (response.error) {
    throw new SharedDashboardError(response.error);
  }

  const aggregate = response.analytics;

  return {
    label: response.label,
    filters: response.filters,
    analytics: buildOverviewAnalyticsFromAggregate(aggregate, language),
    uniqueMessagesCount: aggregate.uniqueMessagesCount,
    timeSeries: {
      points: fillTimeSeriesGaps(aggregate.timeSeries ?? [], aggregate.timeSeriesGranularity ?? "hour", language),
      granularity: aggregate.timeSeriesGranularity ?? "hour",
    },
    recentEvents: response.events ? response.events.items.map((row) => rowToEmailEvent(row)) : null,
  };
}
