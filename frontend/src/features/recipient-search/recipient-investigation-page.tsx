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
import { useSupabase } from "@/lib/supabase/context";
import { fetchRecipientInvestigation } from "@/lib/supabase/queries/recipient-investigation";
import type { RecipientSearchMode } from "@/lib/supabase/types";

function parseWindowDays(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseSearchMode(value: string | null): RecipientSearchMode {
  return value === "sender" || value === "origin" ? value : "recipient";
}

export function RecipientInvestigationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const supabase = useSupabase();
  const [form, setForm] = useState({
    searchText: searchParams.get("query") ?? searchParams.get("recipient") ?? "",
    searchMode: parseSearchMode(searchParams.get("mode")),
    windowDays: parseWindowDays(searchParams.get("windowDays")),
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
  });

  useEffect(() => {
    setForm({
      searchText: searchParams.get("query") ?? searchParams.get("recipient") ?? "",
      searchMode: parseSearchMode(searchParams.get("mode")),
      windowDays: parseWindowDays(searchParams.get("windowDays")),
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
    });
  }, [searchParams]);

  const searchText = normalizeEmail(searchParams.get("query") ?? searchParams.get("recipient") ?? "");
  const searchMode = parseSearchMode(searchParams.get("mode"));
  const page = parsePage(searchParams.get("page"));

  const investigationQuery = useQuery({
    queryKey: ["recipient-investigation", searchText, searchMode, form.windowDays, form.status, form.origin, page, supabase.eventsTable],
    enabled: Boolean(supabase.client && searchText && supabase.eventsTable),
    queryFn: () =>
      fetchRecipientInvestigation(supabase.client!, supabase.eventsTable!, {
        searchText,
        searchMode,
        windowDays: form.windowDays,
        status: form.status,
        origin: form.origin,
        page,
        pageSize: 25,
      }),
  });

  if (!supabase.ready) {
    return <LoadingState title="Conectando ao Supabase" description="Resolvendo a origem dos dados." />;
  }

  if (!supabase.eventsTable) {
    return (
      <SetupState
        description={
          supabase.error ??
          "O painel não conseguiu descobrir automaticamente a tabela ou view de eventos do SES. Informe o nome da relação para continuar."
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
      windowDays: String(form.windowDays),
      status: form.status,
      origin: form.origin,
      page: "1",
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Investigação</p>
          <h2 className="text-3xl font-semibold text-slate-950">
            Diagnostique um endereço desde o primeiro envio até o resultado final.
          </h2>
        </div>
        <Button variant="secondary" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para a visão geral
        </Button>
      </div>

      <div className="sticky top-[7rem] z-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <RecipientSearchForm value={form} onChange={setForm} onSubmit={submitSearch} />
        </div>
      </div>

      {!searchText ? (
        <EmptyState
          title="Busque um endereço"
          description="Escolha se deseja procurar um destinatário, um remetente ou uma origem e informe o valor desejado."
        />
      ) : null}

      {investigationQuery.isLoading ? <LoadingState title="Carregando atividade" /> : null}
      {investigationQuery.isError ? (
        <ErrorState
          description={
            investigationQuery.error instanceof Error
              ? investigationQuery.error.message
              : "Não foi possível carregar os eventos."
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
                  Página {investigationQuery.data.page} de{" "}
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
                        windowDays: String(form.windowDays),
                        status: form.status,
                        origin: form.origin,
                        page: String(Math.max(1, page - 1)),
                      })
                    }
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!investigationQuery.data.hasMore}
                    onClick={() =>
                      setSearchParams({
                        query: searchText,
                        mode: searchMode,
                        windowDays: String(form.windowDays),
                        status: form.status,
                        origin: form.origin,
                        page: String(page + 1),
                      })
                    }
                  >
                    Próxima
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
                  windowDays: String(form.windowDays),
                  status: form.status,
                  origin: form.origin,
                  page: "1",
                })
              }
            />
          ) : (
            <EmptyState
              title="Nenhum resultado encontrado"
              description="Não encontramos correspondência exata para a busca atual."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
