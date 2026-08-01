// Chama a função overview_analytics do Postgres, que agrega os eventos no
// banco em vez de mandar linha bruta para o navegador.
//
// O caminho antigo (fetch-event-rows) buscava até 20.000 linhas em lotes de
// 1000 — 20 idas e voltas sequenciais — e calculava tudo em JS. Além de lento,
// entregava número errado: com 99 mil eventos em 30 dias, o teto cobria só os
// 8 dias mais recentes, então a taxa de bounce exibida (2,53%) não era a do
// período (3,01%). O rótulo dizia 30 dias, o dado era de 8.
//
// Aqui volta ~50 linhas agregadas, exatas sobre 100% da janela.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLanguage } from "@/lib/i18n/types";
import type { OverviewAggregate } from "@/lib/overview/analytics";
import { buildOverviewAnalyticsFromAggregate } from "@/lib/overview/analytics";
import type { EventTimeSeriesPoint, TimeSeriesGranularity } from "@/lib/overview/timeseries";
import type { OverviewAnalytics } from "@/lib/overview/analytics";
import { resolveTimeRange } from "@/lib/time-filters";
import type { EmailEventRow, OverviewQueryInput } from "@/lib/supabase/types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface TimeSeriesBucketRow {
  timestamp: number;
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
}

interface OverviewAggregateResponse extends OverviewAggregate {
  timeSeriesGranularity: TimeSeriesGranularity;
  timeSeries: TimeSeriesBucketRow[];
}

function formatBucketLabel(timestamp: number, granularity: TimeSeriesGranularity, language: AppLanguage) {
  const date = new Date(timestamp);
  if (granularity === "hour") {
    return new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(language, { day: "2-digit", month: "2-digit" }).format(date);
}

// O SQL agrupa só os baldes que têm eventos. Quem preenche os intervalos
// vazios é o JS, igual ao buildEventTimeSeries original — sem isso o gráfico
// desenharia uma linha contínua entre dois dias distantes, escondendo que não
// houve envio nenhum no meio.
function fillTimeSeriesGaps(
  buckets: TimeSeriesBucketRow[],
  granularity: TimeSeriesGranularity,
  language: AppLanguage,
): EventTimeSeriesPoint[] {
  if (!buckets.length) {
    return [];
  }

  const bucketMs = granularity === "hour" ? HOUR_MS : DAY_MS;
  const byTimestamp = new Map(buckets.map((bucket) => [bucket.timestamp, bucket]));
  const first = buckets[0]!.timestamp;
  const last = buckets[buckets.length - 1]!.timestamp;
  const points: EventTimeSeriesPoint[] = [];

  for (let cursor = first; cursor <= last; cursor += bucketMs) {
    const bucket = byTimestamp.get(cursor);
    points.push({
      timestamp: cursor,
      label: formatBucketLabel(cursor, granularity, language),
      sent: bucket?.sent ?? 0,
      delivered: bucket?.delivered ?? 0,
      bounced: bucket?.bounced ?? 0,
      complained: bucket?.complained ?? 0,
      total: bucket?.total ?? 0,
    });
  }

  return points;
}

export interface OverviewAggregateResult {
  analytics: OverviewAnalytics;
  timeSeries: { points: EventTimeSeriesPoint[]; granularity: TimeSeriesGranularity };
  uniqueMessagesCount: number;
  totalEventCount: number;
}

export interface OverviewEventsPage {
  items: EmailEventRow[];
  totalCount: number;
}

// Uma página da lista "Atividade recente", com filtro, ordenação e contagem
// feitos no banco. Antes, exibir 50 linhas custava baixar até 20.000, porque
// os filtros de origem/assunto/provedor eram aplicados em JS e o navegador
// precisava de todas as candidatas para depois fatiar.
export async function fetchOverviewEventsPage(
  client: SupabaseClient,
  input: OverviewQueryInput,
): Promise<OverviewEventsPage> {
  const { startIso, endIso } = resolveTimeRange(input);

  const { data, error } = await client.rpc("overview_events", {
    p_start: startIso,
    p_end: endIso || null,
    p_status: input.status,
    // p_bounce_subtype fica de fora até a migration
    // 20260801190000_overview_bounce_subtype_filter.sql ser aplicada no
    // banco em uso — mandar esse parâmetro antes disso faz o PostgREST
    // recusar a chamada inteira (função com essa assinatura não existe no
    // schema cache), quebrando o Overview inteiro, não só quem filtra por
    // bounce. Reative com `p_bounce_subtype: input.bounceSubType,` assim que
    // a migration estiver aplicada.
    p_origin: input.origin.trim(),
    p_subject: input.subject.trim(),
    p_provider: input.provider.trim(),
    // rowLimit é deliberadamente NÃO repassado (a função aceita p_row_limit,
    // mas o padrão null significa "sem teto"). O painel sempre reflete a
    // janela inteira que o usuário escolheu.
    //
    // Aquele seletor existia como válvula de performance: era o que impedia o
    // navegador de baixar a tabela toda. Esse motivo acabou — a agregação
    // acontece no banco e "sem limite" custa ~3,5 KB a mais de tráfego que
    // "100 linhas". O que sobrava dele era uma armadilha: com 100 linhas os
    // cards mostravam bounce 0% quando o real do período era 3%, porque a
    // amostra cobria só os últimos minutos. Um filtro de período que devolve
    // a taxa de outro período é pior que filtro nenhum.
    //
    // O seletor continua valendo para o relatório CSV/PDF (ver
    // loadReportEvents em overview-page.tsx), onde limitar o tamanho do
    // arquivo gerado é uma função real.
    p_sort: input.recentActivitySort,
    p_limit: input.pageSize,
    p_offset: (input.page - 1) * input.pageSize,
  });

  if (error) {
    throw error;
  }

  const page = data as { items: EmailEventRow[]; totalCount: number };
  return { items: page.items ?? [], totalCount: page.totalCount ?? 0 };
}

export async function fetchOverviewAggregate(
  client: SupabaseClient,
  input: OverviewQueryInput,
  language: AppLanguage,
): Promise<OverviewAggregateResult> {
  const { startIso, endIso } = resolveTimeRange(input);

  const { data, error } = await client.rpc("overview_analytics", {
    p_start: startIso,
    // A função trata null como "sem limite superior"; o intervalo padrão só
    // tem início.
    p_end: endIso || null,
    p_status: input.status,
    // Ver o mesmo comentário em fetchOverviewEventsPage: p_bounce_subtype só
    // volta depois que 20260801190000_overview_bounce_subtype_filter.sql
    // for aplicada no banco.
    p_origin: input.origin.trim(),
    p_subject: input.subject.trim(),
    p_provider: input.provider.trim(),
    // rowLimit é deliberadamente NÃO repassado (a função aceita p_row_limit,
    // mas o padrão null significa "sem teto"). O painel sempre reflete a
    // janela inteira que o usuário escolheu.
    //
    // Aquele seletor existia como válvula de performance: era o que impedia o
    // navegador de baixar a tabela toda. Esse motivo acabou — a agregação
    // acontece no banco e "sem limite" custa ~3,5 KB a mais de tráfego que
    // "100 linhas". O que sobrava dele era uma armadilha: com 100 linhas os
    // cards mostravam bounce 0% quando o real do período era 3%, porque a
    // amostra cobria só os últimos minutos. Um filtro de período que devolve
    // a taxa de outro período é pior que filtro nenhum.
    //
    // O seletor continua valendo para o relatório CSV/PDF (ver
    // loadReportEvents em overview-page.tsx), onde limitar o tamanho do
    // arquivo gerado é uma função real.
  });

  if (error) {
    throw error;
  }

  const aggregate = data as OverviewAggregateResponse;

  return {
    analytics: buildOverviewAnalyticsFromAggregate(aggregate, language),
    timeSeries: {
      points: fillTimeSeriesGaps(
        aggregate.timeSeries ?? [],
        aggregate.timeSeriesGranularity ?? "hour",
        language,
      ),
      granularity: aggregate.timeSeriesGranularity ?? "hour",
    },
    uniqueMessagesCount: aggregate.uniqueMessagesCount,
    totalEventCount: aggregate.totalEventCount,
  };
}
