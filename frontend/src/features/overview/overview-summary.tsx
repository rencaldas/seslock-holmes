import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/use-i18n";
import { getSupabaseLanguage } from "@/lib/supabase/settings";
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
  const t = useI18n();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title={t.overview.summary.totalEvents} description={t.overview.summary.totalEventsDescription} value={data.recentEventsCount} />
        <SummaryCard title={t.overview.summary.uniqueMessages} description={t.overview.summary.uniqueMessagesDescription} value={data.uniqueMessagesCount} />
        <SummaryCard title={t.overview.summary.delivered} description={t.overview.summary.deliveredDescription} value={data.deliveredCount} tone="success" />
        <SummaryCard title={t.overview.summary.bounced} description={t.overview.summary.bouncedDescription} value={data.bouncedCount} tone="destructive" />
        <SummaryCard title={t.overview.summary.complaints} description={t.overview.summary.complaintsDescription} value={data.complaintCount} tone="warning" />
        <SummaryCard title={t.overview.summary.problemEvents} description={t.overview.summary.problemEventsDescription} value={data.problemEventsCount} tone="warning" />
        <SummaryCard title={t.overview.summary.bounceRate} description={t.overview.summary.bounceRateDescription} value={`${new Intl.NumberFormat(getSupabaseLanguage(), { maximumFractionDigits: 1 }).format(data.bounceRate)}%`} tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.overview.summary.topOrigins}</CardTitle>
          <CardDescription>{t.overview.summary.topOriginsDescription}</CardDescription>
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
            <p className="text-sm text-slate-500">{t.overview.summary.noOrigins}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
