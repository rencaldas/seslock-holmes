import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { SetupState } from "@/components/states/setup-state";
import { RecipientSearchForm } from "@/features/recipient-search/recipient-search-form";
import { RecipientResults } from "@/features/recipient-search/recipient-results";
import { RelatedEmailSuggestions } from "@/features/recipient-search/related-email-suggestions";
import { normalizeEmail } from "@/lib/formatters/email";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { fetchRecipientInvestigation } from "@/lib/supabase/queries/recipient-investigation";
import type { RecentActivitySort, RecipientSearchMode } from "@/lib/supabase/types";
import { parseTimeFilterState } from "@/lib/time-filters";

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseSearchMode(value: string | null): RecipientSearchMode {
  return value === "sender" || value === "origin" || value === "diagnostic" ? value : "recipient";
}

function parseRecentActivitySort(value: string | null): RecentActivitySort {
  return value === "time-asc" || value === "recipient-asc" || value === "recipient-desc" ? value : "time-desc";
}

export function RecipientInvestigationPage() {
  const t = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const supabase = useSupabase();
  const [form, setForm] = useState({
    searchText: searchParams.get("query") ?? searchParams.get("recipient") ?? "",
    searchMode: parseSearchMode(searchParams.get("mode")),
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
    provider: searchParams.get("provider") ?? "",
  });

  useEffect(() => {
    setForm({
      searchText: searchParams.get("query") ?? searchParams.get("recipient") ?? "",
      searchMode: parseSearchMode(searchParams.get("mode")),
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
      provider: searchParams.get("provider") ?? "",
    });
  }, [searchParams]);

  const searchText = normalizeEmail(searchParams.get("query") ?? searchParams.get("recipient") ?? "");
  const searchMode = parseSearchMode(searchParams.get("mode"));
  const page = parsePage(searchParams.get("page"));

  const investigationQuery = useQuery({
      queryKey: [
        "recipient-investigation",
        searchText,
        searchMode,
        form.timeMode,
        form.windowDays,
        form.startAt,
        form.endAt,
        form.recentActivitySort,
        form.status,
        form.origin,
        form.provider,
        page,
      supabase.eventsTable,
    ],
    enabled: Boolean(supabase.client && searchText && supabase.eventsTable),
    queryFn: () =>
      fetchRecipientInvestigation(supabase.client!, supabase.eventsTable!, {
        searchText,
        searchMode,
        timeMode: form.timeMode,
        windowDays: form.windowDays,
        startAt: form.startAt,
        endAt: form.endAt,
        status: form.status,
        origin: form.origin,
        provider: form.provider,
        page,
        pageSize: 25,
      }),
  });

  if (!supabase.ready) {
    return <LoadingState title={t.common.loadingSupabase} description={t.common.loadingDescription} />;
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

  const submitSearch = () => {
    const normalized = form.searchMode === "origin" ? form.searchText.trim() : normalizeEmail(form.searchText);
    if (!normalized) {
      return;
    }

    setSearchParams({
      query: normalized,
      mode: form.searchMode,
      timeMode: form.timeMode,
      windowDays: String(form.windowDays),
      startAt: form.timeMode === "custom" ? form.startAt : "",
      endAt: form.timeMode === "custom" ? form.endAt : "",
      recentActivitySort: form.recentActivitySort,
      status: form.status,
      origin: form.origin,
      provider: form.provider,
      page: "1",
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t.investigation.kicker}</p>
          <h2 className="text-3xl font-semibold text-slate-950">
            {t.investigation.title}
          </h2>
        </div>
        <Button variant="secondary" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.investigation.backToOverview}
        </Button>
      </div>

      <div className="sticky top-[7rem] z-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <RecipientSearchForm value={form} onChange={setForm} onSubmit={submitSearch} />
        </div>
      </div>

      {!searchText ? (
        <EmptyState
          title={t.investigation.noSearchTitle}
          description={t.investigation.noSearchDescription}
        />
      ) : null}

      {investigationQuery.isLoading ? <LoadingState title={t.investigation.loadingTitle} /> : null}
      {investigationQuery.isError ? (
        <ErrorState
          description={
            investigationQuery.error instanceof Error
              ? investigationQuery.error.message
              : t.common.noAvailableData
          }
          onRetry={() => investigationQuery.refetch()}
        />
      ) : null}

      {investigationQuery.data ? (
        <div className="space-y-4">
          {investigationQuery.data.events.length ? (
            <>
              <RecipientResults data={investigationQuery.data} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {t.investigation.pageLabel} {investigationQuery.data.page} de{" "}
                  {Math.max(1, Math.ceil(investigationQuery.data.totalCount / investigationQuery.data.pageSize))}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={investigationQuery.data.page <= 1}
                    onClick={() =>
                      setSearchParams({
                        query: searchText,
                        mode: searchMode,
                        timeMode: form.timeMode,
                        windowDays: String(form.windowDays),
                        startAt: form.timeMode === "custom" ? form.startAt : "",
                        endAt: form.timeMode === "custom" ? form.endAt : "",
                        recentActivitySort: form.recentActivitySort,
                        status: form.status,
                        origin: form.origin,
                        provider: form.provider,
                        page: String(Math.max(1, page - 1)),
                      })
                    }
                  >
                    {t.investigation.previous}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!investigationQuery.data.hasMore}
                    onClick={() =>
                      setSearchParams({
                        query: searchText,
                        mode: searchMode,
                        timeMode: form.timeMode,
                        windowDays: String(form.windowDays),
                        startAt: form.timeMode === "custom" ? form.startAt : "",
                        endAt: form.timeMode === "custom" ? form.endAt : "",
                        recentActivitySort: form.recentActivitySort,
                        status: form.status,
                        origin: form.origin,
                        provider: form.provider,
                        page: String(page + 1),
                      })
                    }
                  >
                    {t.investigation.next}
                  </Button>
                </div>
              </div>
            </>
          ) : investigationQuery.data.relatedEmails.length ? (
            <RelatedEmailSuggestions
              items={investigationQuery.data.relatedEmails}
              onSelect={(email) =>
                setSearchParams({
                  query: email,
                  mode: searchMode === "origin" ? "recipient" : searchMode,
                  timeMode: form.timeMode,
                  windowDays: String(form.windowDays),
                  startAt: form.timeMode === "custom" ? form.startAt : "",
                  endAt: form.timeMode === "custom" ? form.endAt : "",
                  recentActivitySort: form.recentActivitySort,
                  status: form.status,
                  origin: form.origin,
                  provider: form.provider,
                  page: "1",
                })
              }
            />
          ) : (
            <EmptyState
              title={t.investigation.noResultsTitle}
              description={t.investigation.noResultsWithSuggestionsDescription}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
