import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { SetupState } from "@/components/states/setup-state";
import { EventDetailPanels } from "@/features/event-detail/event-detail-panels";
import { MessageTraceTimeline } from "@/features/message-trace/message-trace-timeline";
import { useSupabase } from "@/lib/supabase/context";
import { fetchMessageTrace } from "@/lib/supabase/queries/message-trace";

export function EventDetailPage() {
  const { eventId } = useParams();
  const supabase = useSupabase();

  const detailQuery = useQuery({
    queryKey: ["message-trace", eventId, supabase.eventsTable],
    enabled: Boolean(supabase.client && eventId && supabase.eventsTable),
    queryFn: () => fetchMessageTrace(supabase.client!, supabase.eventsTable!, { eventId: eventId ?? "" }),
  });

  const selectedEvent = detailQuery.data?.selectedEvent ?? null;
  const backLink = useMemo(() => {
    if (!selectedEvent?.recipientEmail) {
      return "/investigate";
    }

    return `/investigate?query=${encodeURIComponent(selectedEvent.recipientEmail)}&mode=recipient`;
  }, [selectedEvent?.recipientEmail]);

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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Detalhes do evento</p>
          <h2 className="text-3xl font-semibold text-slate-950">Inspecione o ciclo completo da mensagem.</h2>
        </div>
        <Link
          to={backLink}
          className="inline-flex items-center rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para a investigação
        </Link>
      </div>

      {detailQuery.isLoading ? <LoadingState title="Carregando detalhes do evento" /> : null}
      {detailQuery.isError ? (
        <ErrorState
          description={
            detailQuery.error instanceof Error
              ? detailQuery.error.message
              : "Não foi possível carregar os detalhes do evento."
          }
          onRetry={() => detailQuery.refetch()}
        />
      ) : null}

      {detailQuery.data ? (
        selectedEvent ? (
          <div className="space-y-6">
            <EventDetailPanels event={selectedEvent} />
            <MessageTraceTimeline events={detailQuery.data.traceEvents} />
          </div>
        ) : (
          <EmptyState
            title="Evento não encontrado"
            description="O evento do SES selecionado não foi localizado no conjunto de dados atual."
            actionLabel="Voltar para a investigação"
            onAction={() => window.location.assign("/investigate")}
          />
        )
      ) : null}
    </div>
  );
}
