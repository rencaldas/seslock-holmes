import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, toneForEventType } from "@/lib/formatters/email";
import { getTraceEventDetails, summarizeEvent } from "@/lib/formatters/event";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import type { EmailEvent } from "@/lib/supabase/types";

function dotColor(eventType: EmailEvent["eventType"]) {
  switch (eventType) {
    case "delivered":
      return "bg-success";
    case "sent":
      return "bg-slate-400";
    case "bounced":
    case "rejected":
    case "rendering_failure":
      return "bg-danger";
    case "complained":
    case "delayed":
      return "bg-warning";
    default:
      return "bg-slate-400";
  }
}

export function MessageTraceTimeline({
  events,
  selectedEventId,
}: {
  events: EmailEvent[];
  selectedEventId?: string;
}) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.eventDetail.trace}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((event, index) => {
          const isSelected = event.id === selectedEventId;
          const details = getTraceEventDetails(event, t);

          return (
            <div key={event.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className={cn("h-3 w-3 shrink-0 rounded-full", dotColor(event.eventType))} />
                {index < events.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200 dark:bg-slate-700" /> : null}
              </div>
              <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={toneForEventType(event.eventType)}>{formatEventType(event.eventType)}</Badge>
                  <span className="text-sm text-ink-muted">{formatDateTime(event.occurredAt)}</span>
                  {isSelected ? <Badge tone="default">{t.eventDetail.currentEvent}</Badge> : null}
                </div>
                <p className="mt-3 text-sm text-ink-muted">{summarizeEvent(event)}</p>
                {details.length ? (
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-slate-200 pt-3 text-xs leading-5 dark:border-slate-700 sm:grid-cols-2">
                    {details.map((item) => (
                      <div key={item.label} className="flex min-w-0 items-baseline gap-1.5">
                        <dt className="shrink-0 font-semibold uppercase tracking-[0.06em] text-ink-muted">{item.label}:</dt>
                        <dd
                          className={cn("min-w-0 truncate text-ink", item.mono && "font-mono")}
                          title={item.value}
                        >
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {!isSelected ? (
                  <Link
                    to={`/events/${event.id}`}
                    className="mt-3 inline-flex items-center text-xs font-semibold text-brand hover:text-brand-hover"
                  >
                    {t.overview.details}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
