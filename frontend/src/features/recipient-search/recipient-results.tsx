import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, isProblemEventType, toneForEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { RecipientInvestigationResult } from "@/lib/supabase/types";

export function RecipientResults({
  data,
}: {
  data: RecipientInvestigationResult;
}) {
  const t = useI18n();

  if (!data.events.length) {
    return (
      <EmptyState
        title={t.investigation.noResultsTitle}
        description={t.investigation.noResultsDescription}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={data.hasProblemActivity ? "destructive" : "success"}>
              {data.totalCount} {t.investigation.resultCount}
            </Badge>
            <span className="text-sm text-slate-500">
              {t.investigation.latestActivity}: {formatDateTime(data.latestEventAt)}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.investigation.tableHour}</TableHead>
                <TableHead>{t.investigation.tableResult}</TableHead>
                <TableHead>{t.investigation.tableOrigin}</TableHead>
                <TableHead>{t.investigation.tableMessage}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(event.occurredAt)}</TableCell>
                  <TableCell>
                    <Badge tone={toneForEventType(event.eventType)}>{formatEventType(event.eventType)}</Badge>
                    {isProblemEventType(event.eventType) && event.failureReason ? (
                      <p className="mt-2 max-w-md text-xs text-slate-500">{event.failureReason}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-950">{getOriginLabel(event)}</p>
                      <p className="text-xs text-slate-500">{event.smtpIdentity}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700">
                        {event.senderEmail} -&gt; {event.recipientEmail}
                      </p>
                      <Link
                        className="text-sm font-medium text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-950"
                        to={`/events/${event.id}`}
                      >
                        {t.investigation.inspectEvent}
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
