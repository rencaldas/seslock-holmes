import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, toneForEventType } from "@/lib/formatters/email";
import { summarizeEvent } from "@/lib/formatters/event";
import type { EmailEvent } from "@/lib/supabase/types";

function dotColor(eventType: EmailEvent["eventType"]) {
  switch (eventType) {
    case "delivered":
      return "bg-emerald-500";
    case "sent":
      return "bg-slate-500";
    case "bounced":
      return "bg-rose-600";
    case "complained":
      return "bg-amber-500";
    case "rejected":
    case "rendering_failure":
      return "bg-rose-800";
    case "delayed":
      return "bg-yellow-500";
    default:
      return "bg-slate-500";
  }
}

export function MessageTraceTimeline({ events }: { events: EmailEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rastreamento da mensagem</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((event, index) => (
          <div key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`h-3 w-3 rounded-full ${dotColor(event.eventType)}`} />
              {index < events.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200" /> : null}
            </div>
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={toneForEventType(event.eventType)}>{formatEventType(event.eventType)}</Badge>
                <span className="text-sm text-slate-500">{formatDateTime(event.occurredAt)}</span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{summarizeEvent(event)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
