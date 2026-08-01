import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import overviewLogo from "@/assets/overview-logo.png";
import overviewLogoBlack from "@/assets/overview-logo-black.png";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { OverviewSkeleton } from "@/components/states/overview-skeleton";
import { SetupState } from "@/components/states/setup-state";
import { DomainHealthHero } from "@/features/overview/domain-health-hero";
import { TopMetrics } from "@/features/overview/top-metrics";
import { OverviewAnalyticsPanel } from "@/features/overview/overview-analytics-panel";
import { RecentActivityList } from "@/features/overview/recent-activity-list";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import { useFilters } from "@/lib/filters/filters-context";
import { useSupabase } from "@/lib/supabase/context";
import { rowToEmailEvent } from "@/lib/supabase/aws-sns";
import {
  fetchOverviewAggregate,
  fetchOverviewEventsPage,
} from "@/lib/supabase/queries/overview-aggregate";
import {
  EMAIL_EVENT_LIST_COLUMNS,
  fetchEventRowsWithTimeFallback,
} from "@/lib/supabase/queries/fetch-event-rows";
import { resolveTimeRange } from "@/lib/time-filters";
import { buildSearchParams } from "@/lib/overview/overview-search-params";
import { parsePageSize } from "@/lib/page-size";

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function OverviewPage() {
  const t = useI18n();
  const language = useAppLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const supabase = useSupabase();
  const { filters: appliedFilters } = useFilters();
  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("pageSize"));

  const overviewQuery = useQuery({
    queryKey: [
      "overview",
      language,
      page,
      pageSize,
      appliedFilters.timeMode,
      appliedFilters.windowDays,
      appliedFilters.startAt,
      appliedFilters.endAt,
      appliedFilters.recentActivitySort,
      appliedFilters.status,
      appliedFilters.bounceSubType,
      appliedFilters.origin,
      appliedFilters.subject,
      appliedFilters.provider,
      appliedFilters.rowLimit,
      supabase.eventsTable,
    ],
    enabled: Boolean(supabase.client && supabase.eventsTable),
    // As duas chamadas são independentes e vão juntas: o agregado varre o
    // período inteiro, a página só traz as 50 linhas visíveis. Em paralelo, o
    // tempo de tela é o da mais lenta, não a soma.
    queryFn: async () => {
      const queryInput = {
        page,
        pageSize,
        timeMode: appliedFilters.timeMode,
        windowDays: appliedFilters.windowDays,
        startAt: appliedFilters.startAt,
        endAt: appliedFilters.endAt,
        recentActivitySort: appliedFilters.recentActivitySort,
        status: appliedFilters.status,
        bounceSubType: appliedFilters.bounceSubType,
        origin: appliedFilters.origin,
        subject: appliedFilters.subject,
        provider: appliedFilters.provider,
        rowLimit: appliedFilters.rowLimit,
      };

      const [aggregate, eventsPage] = await Promise.all([
        fetchOverviewAggregate(supabase.client!, queryInput, language),
        fetchOverviewEventsPage(supabase.client!, queryInput),
      ]);

      const totalPages = Math.max(1, Math.ceil(eventsPage.totalCount / pageSize));

      return {
        analytics: aggregate.analytics,
        timeSeries: aggregate.timeSeries,
        recentEvents: eventsPage.items.map((row) => rowToEmailEvent(row)),
        recentEventsCount: eventsPage.totalCount,
        uniqueMessagesCount: aggregate.uniqueMessagesCount,
        page,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      };
    },
    placeholderData: keepPreviousData,
  });

  const timeSeries = overviewQuery.data?.timeSeries ?? { points: [], granularity: "hour" as const };

  // O relatório é o único consumidor que ainda precisa de todas as linhas da
  // consulta. Buscá-las só no clique evita pagar por elas em todo
  // carregamento da página — que era exatamente o que tornava a tela lenta.
  const loadReportEvents = useCallback(async () => {
    const { rows } = await fetchEventRowsWithTimeFallback(
      supabase.client!,
      supabase.eventsTable!,
      resolveTimeRange(appliedFilters).startIso,
      {
        endIso: resolveTimeRange(appliedFilters).endIso || undefined,
        maxRows: appliedFilters.rowLimit === "all" ? undefined : appliedFilters.rowLimit,
        columns: EMAIL_EVENT_LIST_COLUMNS,
      },
    );
    return rows.map((row) => rowToEmailEvent(row));
  }, [supabase.client, supabase.eventsTable, appliedFilters]);

  if (!supabase.ready) {
    return <OverviewSkeleton />;
  }

  if (!supabase.eventsTable) {
    return (
      <SetupState
        description={
          supabase.error ??
          t.common.setupDescription
        }
        triedTables={supabase.triedTables}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <img src={overviewLogoBlack} alt={t.app.subtitle} className="h-36 w-36 object-contain dark:hidden" />
          <img src={overviewLogo} alt={t.app.subtitle} className="hidden h-36 w-36 object-contain dark:block" />
          <span className="whitespace-nowrap text-xl font-bold text-ink">{t.app.subtitle}</span>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t.overview.kicker}</p>
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{t.overview.title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">{t.overview.description}</p>
        </div>
      </section>

      {overviewQuery.isLoading ? <OverviewSkeleton /> : null}
      {overviewQuery.isError ? (
        <ErrorState
          description={
            overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : t.common.noAvailableData
          }
          onRetry={() => overviewQuery.refetch()}
        />
      ) : null}

      {overviewQuery.data ? (
        <div
          className={`space-y-8 transition-opacity duration-150 ${
            overviewQuery.isFetching && !overviewQuery.isLoading ? "opacity-60" : "opacity-100"
          }`}
        >
          <DomainHealthHero analytics={overviewQuery.data.analytics} />
          <TopMetrics analytics={overviewQuery.data.analytics} timeSeries={timeSeries.points} />
          <OverviewAnalyticsPanel
            analytics={overviewQuery.data.analytics}
            uniqueMessagesCount={overviewQuery.data.uniqueMessagesCount}
            timeSeries={timeSeries}
          />
          {overviewQuery.data.recentEvents.length ? (
            <RecentActivityList
              events={overviewQuery.data.recentEvents}
              loadReportEvents={loadReportEvents}
              reportQuery={{
                timeMode: appliedFilters.timeMode,
                windowDays: String(appliedFilters.windowDays),
                startAt: appliedFilters.timeMode === "custom" ? appliedFilters.startAt : "",
                endAt: appliedFilters.timeMode === "custom" ? appliedFilters.endAt : "",
                recentActivitySort: appliedFilters.recentActivitySort,
                status: appliedFilters.status,
                bounceSubType: appliedFilters.bounceSubType,
                origin: appliedFilters.origin,
                subject: appliedFilters.subject,
                provider: appliedFilters.provider,
                rows: String(appliedFilters.rowLimit),
              }}
              page={overviewQuery.data.page}
              totalPages={overviewQuery.data.totalPages}
              pageSize={pageSize}
              hasPreviousPage={overviewQuery.data.hasPreviousPage}
              hasNextPage={overviewQuery.data.hasNextPage}
              onPreviousPage={() =>
                setSearchParams(
                  buildSearchParams(searchParams, {
                    page: String(Math.max(1, overviewQuery.data.page - 1)),
                  }),
                )
              }
              onNextPage={() =>
                setSearchParams(
                  buildSearchParams(searchParams, {
                    page: String(overviewQuery.data.page + 1),
                  }),
                )
              }
              onPageSizeChange={(nextPageSize) =>
                setSearchParams(
                  buildSearchParams(
                    searchParams,
                    {
                      pageSize: String(nextPageSize),
                    },
                    true,
                  ),
                )
              }
            />
          ) : (
            <EmptyState
              title={t.overview.noActivityTitle}
              description={t.overview.noActivityDescription}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
