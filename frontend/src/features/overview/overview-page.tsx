import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { OverviewSkeleton } from "@/components/states/overview-skeleton";
import { SetupState } from "@/components/states/setup-state";
import { DomainHealthHero } from "@/features/overview/domain-health-hero";
import { TopMetrics } from "@/features/overview/top-metrics";
import { OverviewAnalyticsPanel } from "@/features/overview/overview-analytics-panel";
import { OverviewFilters } from "@/features/overview/overview-filters";
import { RecentActivityList } from "@/features/overview/recent-activity-list";
import { normalizeEmail } from "@/lib/formatters/email";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { fetchOverview } from "@/lib/supabase/queries/overview";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { buildEventTimeSeries } from "@/lib/overview/timeseries";
import { parseTimeFilterState } from "@/lib/time-filters";
import type { RecentActivitySort } from "@/lib/supabase/types";
import { DEFAULT_ROW_LIMIT, parseRowLimit } from "@/lib/row-limits";

const RECENT_ACTIVITY_PAGE_SIZE = 50;
const DEFAULT_OVERVIEW_FILTERS = {
  timeMode: "window" as const,
  windowDays: 1,
  startAt: "",
  endAt: "",
  recentActivitySort: "time-desc" as const,
  status: "all" as const,
  origin: "",
  subject: "",
  provider: "",
  rowLimit: DEFAULT_ROW_LIMIT,
};

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseRecentActivitySort(value: string | null): RecentActivitySort {
  return value === "time-asc" || value === "recipient-asc" || value === "recipient-desc" ? value : "time-desc";
}

function parseOverviewFilters(searchParams: URLSearchParams) {
  return {
    ...DEFAULT_OVERVIEW_FILTERS,
    ...parseTimeFilterState(searchParams),
    recentActivitySort: parseRecentActivitySort(searchParams.get("recentActivitySort")),
    status: (searchParams.get("status") ?? "all") as
      | "all"
      | "sent"
      | "delivered"
      | "bounced"
      | "complained"
      | "delayed"
      | "rejected"
      | "rendering_failure",
    origin: searchParams.get("origin") ?? "",
    subject: searchParams.get("subject") ?? "",
    provider: searchParams.get("provider") ?? "",
    rowLimit: parseRowLimit(searchParams.get("rows")),
  };
}

function buildSearchParams(current: URLSearchParams, next: Record<string, string | null | undefined>, resetPage = false) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  if (resetPage) {
    params.set("page", "1");
  }
  return params;
}

export function OverviewPage() {
  const t = useI18n();
  const language = useAppLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const supabase = useSupabase();
  const [recipientEmail, setRecipientEmail] = useState(searchParams.get("recipient") ?? "");
  const page = parsePage(searchParams.get("page"));
  const appliedFilters = parseOverviewFilters(searchParams);
  const [filters, setFilters] = useState(() => appliedFilters);
  const { isOpen: filtersOpen, toggle: toggleFilters } = useDisclosure(false);

  useEffect(() => {
    setRecipientEmail(searchParams.get("recipient") ?? "");
  }, [searchParams]);

  useEffect(() => {
    setFilters(parseOverviewFilters(searchParams));
  }, [searchParams]);

  const overviewQuery = useQuery({
    queryKey: [
      "overview",
      language,
      page,
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
        pageSize: RECENT_ACTIVITY_PAGE_SIZE,
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
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t.overview.kicker}</p>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{t.overview.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">{t.overview.description}</p>
      </section>

      <div className="sticky top-16 z-20 -mx-4 bg-paper/85 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="overflow-hidden rounded-panel border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
            <Input
              value={recipientEmail}
              placeholder={t.overview.searchPlaceholder}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => {
                  const normalized = normalizeEmail(recipientEmail);
                  if (!normalized) {
                    return;
                  }
                  const nextParams = buildSearchParams(
                    searchParams,
                    {
                      recipient: normalized,
                      query: normalized,
                      mode: "recipient",
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
                    },
                    true,
                  );
                  setSearchParams(nextParams);
                  navigate(`/investigate?${nextParams.toString()}`);
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                {t.overview.investigateRecipient}
              </Button>
              <Button type="button" variant="secondary" onClick={toggleFilters}>
                {filtersOpen ? t.overview.hideFilters : t.overview.showFilters}
              </Button>
            </div>
          </div>

          <div
            className={`overflow-hidden transition-all duration-200 ease-out ${filtersOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <OverviewFilters
              value={filters}
              onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
              onClear={() => {
                setFilters({ ...DEFAULT_OVERVIEW_FILTERS });
                setSearchParams(
                  buildSearchParams(
                    searchParams,
                    {
                      timeMode: null,
                      windowDays: null,
                      startAt: null,
                      endAt: null,
                      recentActivitySort: null,
                      status: null,
                      origin: null,
                      subject: null,
                      provider: null,
                      rows: null,
                    },
                    true,
                  ),
                );
              }}
              onApply={() => {
                setSearchParams(
                  buildSearchParams(
                    searchParams,
                    {
                      timeMode: filters.timeMode,
                      windowDays: String(filters.windowDays),
                      startAt: filters.timeMode === "custom" ? filters.startAt : "",
                      endAt: filters.timeMode === "custom" ? filters.endAt : "",
                      recentActivitySort: filters.recentActivitySort,
                      status: filters.status,
                      origin: filters.origin,
                      subject: filters.subject ?? "",
                      provider: filters.provider ?? "",
                      rows: String(filters.rowLimit),
                    },
                    true,
                  ),
                );
              }}
              showProviderFilter
              className="border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40"
              inputClassName="border-slate-200 bg-white text-ink placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-slate-700 dark:bg-slate-900"
              selectClassName="border-slate-200 bg-white text-ink focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-slate-700 dark:bg-slate-900"
              labelClassName="text-ink-muted"
            />
          </div>
        </div>
      </div>

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
        <div className="space-y-8">
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
              hasPreviousPage={overviewQuery.data.hasPreviousPage}
              hasNextPage={overviewQuery.data.hasNextPage}
              onPreviousPage={() =>
                setSearchParams(
                  buildSearchParams(searchParams, {
                    page: String(Math.max(1, overviewQuery.data.page - 1)),
                    recentActivitySort: appliedFilters.recentActivitySort,
                  }),
                )
              }
              onNextPage={() =>
                setSearchParams(
                  buildSearchParams(searchParams, {
                    page: String(overviewQuery.data.page + 1),
                    recentActivitySort: appliedFilters.recentActivitySort,
                  }),
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
