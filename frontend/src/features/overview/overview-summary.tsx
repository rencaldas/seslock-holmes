import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OverviewResult } from "@/lib/supabase/types";

function SummaryCard({
  title,
  description,
  value,
  tone = "default",
}: {
  title: string;
  description: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "destructive" | "muted";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4">
        <p className="text-3xl font-semibold text-slate-950">{value}</p>
        <Badge tone={tone}>Resumo</Badge>
      </CardContent>
    </Card>
  );
}

export function OverviewSummary({ data }: { data: OverviewResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total de eventos"
          description="Eventos na janela filtrada."
          value={data.recentEventsCount}
        />
        <SummaryCard
          title="Mensagens únicas"
          description="Total de messageId distintos."
          value={data.uniqueMessagesCount}
        />
        <SummaryCard
          title="Entregues"
          description="Eventos marcados como delivered."
          value={data.deliveredCount}
          tone="success"
        />
        <SummaryCard
          title="Bounces"
          description="Eventos marcados como bounced."
          value={data.bouncedCount}
          tone="destructive"
        />
        <SummaryCard
          title="Complaints"
          description="Eventos marcados como complained."
          value={data.complaintCount}
          tone="warning"
        />
        <SummaryCard
          title="Eventos problemáticos"
          description="delayed, rejected e rendering_failure."
          value={data.problemEventsCount}
          tone="warning"
        />
        <SummaryCard
          title="Taxa de bounce"
          description="Percentual de bounces no período."
          value={`${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(data.bounceRate)}%`}
          tone="warning"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Principais origens</CardTitle>
          <CardDescription>As origens de envio mais ativas na visualização atual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.topOrigins.length ? (
            data.topOrigins.map((origin) => (
              <div key={origin.name} className="flex items-center justify-between gap-4">
                <span className="truncate text-sm text-slate-700">{origin.name}</span>
                <Badge tone="muted">{origin.count}</Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Ainda não há dados de origem disponíveis.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
