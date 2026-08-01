import { Clock, MessageSquare, Radio, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatCount, formatDuration } from "@/lib/formatters/numbers";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import { formatRelativeTime, type OverviewAnalytics } from "@/lib/overview/analytics";

function StatRow({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink-muted dark:bg-slate-800">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-ink-muted">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tabular-nums text-ink">{value}</p>
        {meta ? <p className="text-xs text-ink-muted">{meta}</p> : null}
      </div>
    </div>
  );
}

export function SecondaryMetrics({
  analytics,
  uniqueMessagesCount,
}: {
  analytics: OverviewAnalytics;
  // Único número que não vive no analytics; os outros dois vinham do
  // OverviewResult duplicando o que o analytics já trazia.
  uniqueMessagesCount: number;
}) {
  const t = useI18n();
  const language = useAppLanguage();
  const lastEventRelative = formatRelativeTime(analytics.lastEventAt, language);

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      <StatRow icon={Zap} label={t.overview.analytics.totalEvents} value={formatCount(analytics.totalEventCount)} />
      <StatRow icon={MessageSquare} label={t.overview.analytics.uniqueMessages} value={formatCount(uniqueMessagesCount)} />
      <StatRow icon={Users} label={t.overview.analytics.uniqueRecipients} value={formatCount(analytics.uniqueRecipientsCount)} />
      <StatRow
        icon={Clock}
        label={t.overview.analytics.averageDeliveryTime}
        value={formatDuration(analytics.averageDeliveryTimeMs)}
      />
      <StatRow
        icon={Radio}
        label={t.overview.analytics.lastEventReceived}
        value={analytics.lastEventAt ? formatDateTime(analytics.lastEventAt) : t.overview.analytics.notAvailable}
        meta={lastEventRelative ?? undefined}
      />
    </div>
  );
}
