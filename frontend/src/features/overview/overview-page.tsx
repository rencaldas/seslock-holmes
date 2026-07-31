import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import overviewLogo from "@/assets/overview-logo.png";
import overviewLogoBlack from "@/assets/overview-logo-black.png";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { OverviewSkeleton } from "@/components/states/overview-skeleton";
import { SetupState } from "@/components/states/setup-state";
import { TruncationNotice } from "@/components/states/truncation-notice";
import { DomainHealthHero } from "@/features/overview/domain-health-hero";
import { TopMetrics } from "@/features/overview/top-metrics";
import { OverviewAnalyticsPanel } from "@/features/overview/overview-analytics-panel";
import { RecentActivityList } from "@/features/overview/recent-activity-list";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import { useFilters } from "@/lib/filters/filters-context";
import { useSupabase } from "@/lib/supabase/context";
import { fetchOverview } from "@/lib/supabase/queries/overview";
import { buildEventTimeSeries } from "@/lib/overview/timeseries";
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
      appliedFilters.origin,
      appliedFilters.subject,
      appliedFilters.provider,
      appliedFilters.rowLimit,
      supabase.eventsTable,
    ],
    enabled: Boolean(supabase.client && supabase.eventsTable),
    queryFn: () =>
      fetchOverview(supabase.client!, supabase.eventsTable!, {
        page,
        pageSize,
        timeMode: appliedFilters.timeMode,
        windowDays: appliedFilters.windowDays,
        startAt: appliedFilters.startAt,
        endAt: appliedFilters.endAt,
        recentActivitySort: appliedFilters.recentActivitySort,
        status: appliedFilters.status,
        origin: appliedFilters.origin,
        subject: appliedFilters.subject,
        provider: appliedFilters.provider,
        rowLimit: appliedFilters.rowLimit,
      }),
    placeholderData: keepPreviousData,
  });

  const timeSeries = useMemo(() => {
    if (!overviewQuery.data) {
      return { points: [], granularity: "hour" as const };
    }
    return buildEventTimeSeries(overviewQuery.data.reportEvents, language);
  }, [overviewQuery.data, language]);

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
          {overviewQuery.data.truncated ? <TruncationNotice /> : null}
          <DomainHealthHero analytics={overviewQuery.data.analytics} />
          <TopMetrics analytics={overviewQuery.data.analytics} timeSeries={timeSeries.points} />
          <OverviewAnalyticsPanel data={overviewQuery.data} timeSeries={timeSeries} />
          {overviewQuery.data.recentEvents.length ? (
            <RecentActivityList
              events={overviewQuery.data.recentEvents}
              reportEvents={overviewQuery.data.reportEvents}
              reportQuery={{
                timeMode: appliedFilters.timeMode,
                windowDays: String(appliedFilters.windowDays),
                startAt: appliedFilters.timeMode === "custom" ? appliedFilters.startAt : "",
                endAt: appliedFilters.timeMode === "custom" ? appliedFilters.endAt : "",
                recentActivitySort: appliedFilters.recentActivitySort,
                status: appliedFilters.status,
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
