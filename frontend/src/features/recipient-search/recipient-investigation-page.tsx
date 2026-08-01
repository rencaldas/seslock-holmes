import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { SetupState } from "@/components/states/setup-state";
import { TruncationNotice } from "@/components/states/truncation-notice";
import { RecipientResults } from "@/features/recipient-search/recipient-results";
import { RelatedEmailSuggestions } from "@/features/recipient-search/related-email-suggestions";
import { useFilters } from "@/lib/filters/filters-context";
import { normalizeEmail } from "@/lib/formatters/email";
import { useI18n } from "@/lib/i18n/use-i18n";
import { parseSearchMode } from "@/lib/recipient-search/search-mode";
import { useSupabase } from "@/lib/supabase/context";
import { fetchRecipientInvestigation } from "@/lib/supabase/queries/recipient-investigation";

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function RecipientInvestigationPage() {
  const t = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const supabase = useSupabase();
  const { filters: appliedFilters } = useFilters();

  const rawSearchText = searchParams.get("query") ?? searchParams.get("recipient") ?? "";
  const searchMode = parseSearchMode(searchParams.get("mode"));
  const searchText = searchMode === "provider" ? rawSearchText.trim() : normalizeEmail(rawSearchText);
  const page = parsePage(searchParams.get("page"));

  const investigationQuery = useQuery({
      queryKey: [
        "recipient-investigation",
        searchText,
        searchMode,
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
        page,
      supabase.eventsTable,
    ],
    enabled: Boolean(supabase.client && searchText && supabase.eventsTable),
    queryFn: () =>
      fetchRecipientInvestigation(supabase.client!, supabase.eventsTable!, {
        searchText,
        searchMode,
        timeMode: appliedFilters.timeMode,
        windowDays: appliedFilters.windowDays,
        startAt: appliedFilters.startAt,
        endAt: appliedFilters.endAt,
        status: appliedFilters.status,
        origin: appliedFilters.origin,
        subject: appliedFilters.subject,
        provider: appliedFilters.provider,
        rowLimit: appliedFilters.rowLimit,
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t.investigation.kicker}</p>
          <h2 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">
            {t.investigation.title}
          </h2>
        </div>
        <Button variant="secondary" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.investigation.backToOverview}
        </Button>
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
          {investigationQuery.data.truncated ? <TruncationNotice /> : null}
          {investigationQuery.data.events.length ? (
            <>
              <RecipientResults data={investigationQuery.data} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
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
                        query: rawSearchText,
                        mode: searchMode,
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
                        query: rawSearchText,
                        mode: searchMode,
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
                  mode: searchMode,
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
