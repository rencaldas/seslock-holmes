import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { SetupState } from "@/components/states/setup-state";
import { OverviewFilters } from "@/features/overview/overview-filters";
import { OverviewSummary } from "@/features/overview/overview-summary";
import { RecentActivityList } from "@/features/overview/recent-activity-list";
import { normalizeEmail } from "@/lib/formatters/email";
import { parsePositiveNumber } from "@/lib/utils";
import { useSupabase } from "@/lib/supabase/context";
import { fetchOverview } from "@/lib/supabase/queries/overview";
import { useDisclosure } from "@/lib/hooks/use-disclosure";

const RECENT_ACTIVITY_PAGE_SIZE = 50;

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildSearchParams(current: URLSearchParams, next: Record<string, string>, resetPage = false) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(next)) {
    params.set(key, value);
  }
  if (resetPage) {
    params.set("page", "1");
  }
  return params;
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const supabase = useSupabase();
  const [recipientEmail, setRecipientEmail] = useState(searchParams.get("recipient") ?? "");
  const page = parsePage(searchParams.get("page"));
  const [filters, setFilters] = useState({
    windowDays: parsePositiveNumber(searchParams.get("windowDays")),
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
  const { isOpen: filtersOpen, toggle: toggleFilters } = useDisclosure(false);

  useEffect(() => {
    setRecipientEmail(searchParams.get("recipient") ?? "");
  }, [searchParams]);

  useEffect(() => {
    setFilters({
      windowDays: parsePositiveNumber(searchParams.get("windowDays")),
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

  const overviewQuery = useQuery({
    queryKey: ["overview", page, filters.windowDays, filters.status, filters.origin, supabase.eventsTable],
    enabled: Boolean(supabase.client && supabase.eventsTable),
    queryFn: () =>
      fetchOverview(supabase.client!, supabase.eventsTable!, {
        page,
        pageSize: RECENT_ACTIVITY_PAGE_SIZE,
        windowDays: filters.windowDays,
        status: filters.status,
        origin: filters.origin,
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

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/75 p-6 shadow-soft backdrop-blur-sm lg:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <svg
            className="absolute -right-12 top-2 h-[460px] w-[460px] text-slate-900 opacity-[0.09]"
            viewBox="0 0 460 460"
            fill="none"
          >
            <g transform="translate(40 28)">
              <path
                d="M108 92c0-24 19-43 43-43s43 19 43 43c0 22-16 40-37 43l23 28h-58l23-28c-21-3-37-21-37-43Z"
                fill="currentColor"
              />
              <path
                d="M61 296c9-44 43-78 88-78h32c45 0 79 34 88 78l7 36H54l7-36Z"
                fill="currentColor"
              />
              <path
                d="M98 64c18-20 41-30 66-30 24 0 46 10 65 30l11 12-25 8c-15-13-31-19-51-19-19 0-36 6-51 19l-25-8 10-12Z"
                fill="currentColor"
              />
              <path
                d="M248 236c0-34 28-62 62-62s62 28 62 62-28 62-62 62-62-28-62-62Zm24 0c0 21 17 38 38 38s38-17 38-38-17-38-38-38-38 17-38 38Z"
                fill="currentColor"
              />
              <path d="M301 288 347 334" stroke="currentColor" strokeWidth="28" strokeLinecap="round" />
            </g>
          </svg>
          <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute right-12 top-6 h-72 w-72 rounded-full bg-slate-200/30 blur-3xl" />
        </div>

        <div className="relative grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Visão operacional</p>
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
              Comece pela atividade recente de email e vá direto à investigação por destinatário.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Este painel é somente leitura e ajuda times de suporte a diagnosticar problemas de
              entrega do SES rapidamente, sem precisar de acesso direto à AWS.
            </p>

          </div>

          <Card className="relative border-slate-200/80 bg-white/75 backdrop-blur">
            <CardHeader>
              <CardTitle>O que este painel responde?</CardTitle>
              <CardDescription>Triagem rápida para times de suporte e operações.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>• A mensagem foi entregue?</p>
              <p>• Se não, por que falhou?</p>
              <p>• Qual origem, remetente ou identidade a produziu?</p>
              <p>• Quais eventos relacionados pertencem ao mesmo rastreamento da mensagem?</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="sticky top-[7rem] z-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-800/80 bg-slate-950/95 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.85)] backdrop-blur transition-all duration-200">
            <div className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
              <Input
                value={recipientEmail}
                placeholder="Busque um endereço de email do destinatário"
                onChange={(event) => setRecipientEmail(event.target.value)}
                className="bg-slate-950 text-slate-100 border-slate-700 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="border border-slate-500/60 bg-slate-950 text-white hover:bg-slate-900"
                  onClick={() => {
                    const normalized = normalizeEmail(recipientEmail);
                    if (!normalized) {
                      return;
                    }
                    setSearchParams(
                      buildSearchParams(searchParams, {
                        recipient: normalized,
                        windowDays: String(filters.windowDays),
                        status: filters.status,
                        origin: filters.origin,
                      }),
                    );
                    navigate(
                      `/investigate?query=${encodeURIComponent(normalized)}&mode=recipient&windowDays=${filters.windowDays}&status=${filters.status}&origin=${encodeURIComponent(filters.origin)}`,
                    );
                  }}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Investigar destinatário
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={toggleFilters}
                >
                  {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                </Button>
              </div>
            </div>

            <div
              className={`overflow-hidden transition-all duration-200 ease-out ${filtersOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}
            >
              <OverviewFilters
                value={filters}
                onChange={setFilters}
                onApply={() => {
                  setSearchParams(
                    buildSearchParams(
                      searchParams,
                      {
                        windowDays: String(filters.windowDays),
                        status: filters.status,
                        origin: filters.origin,
                      },
                      true,
                    ),
                  );
                }}
                className="bg-slate-950/95 border-slate-700"
                inputClassName="bg-slate-950 text-slate-100 border-slate-700 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20"
                selectClassName="bg-slate-950 text-slate-100 border-slate-700 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20"
                labelClassName="text-slate-300"
              />
            </div>
          </div>
        </div>
      </div>

      {overviewQuery.isLoading ? <LoadingState title="Carregando visão geral" /> : null}
      {overviewQuery.isError ? (
        <ErrorState
          description={
            overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Não foi possível carregar a atividade recente."
          }
          onRetry={() => overviewQuery.refetch()}
        />
      ) : null}

      {overviewQuery.data ? (
        <div className="space-y-5">
          <OverviewSummary data={overviewQuery.data} />
          {overviewQuery.data.recentEvents.length ? (
            <RecentActivityList
              events={overviewQuery.data.recentEvents}
              page={overviewQuery.data.page}
              totalPages={overviewQuery.data.totalPages}
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
            />
          ) : (
            <EmptyState
              title="Nenhuma atividade nesta janela"
              description="Tente ampliar a janela de tempo ou ajustar os filtros para exibir eventos recentes do SES."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
