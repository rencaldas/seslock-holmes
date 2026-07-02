import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, toneForEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { EmailEvent } from "@/lib/supabase/types";

async function copyToClipboard(value: string) {
  if (!value) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

export function RecentActivityList({
  events,
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
}: {
  events: EmailEvent[];
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{t.overview.recentActivityTitle}</CardTitle>
          <p className="text-sm text-slate-500">
            {t.overview.pageLabel} {page} de {totalPages}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={!hasPreviousPage} onClick={onPreviousPage}>
            {t.overview.previous}
          </Button>
          <Button type="button" variant="secondary" disabled={!hasNextPage} onClick={onNextPage}>
            {t.overview.next}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.overview.tableHour}</TableHead>
                <TableHead>{t.overview.tableResult}</TableHead>
                <TableHead>{t.overview.tableSubject}</TableHead>
                <TableHead>{t.overview.tableRecipient}</TableHead>
                <TableHead>{t.overview.tableOrigin}</TableHead>
                <TableHead>{t.overview.tableActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(event.occurredAt)}</TableCell>
                  <TableCell>
                    <Badge tone={toneForEventType(event.eventType)}>
                      {formatEventType(event.eventType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="max-w-[20rem] truncate font-medium text-slate-950" title={event.subject || t.common.noAvailableData}>
                        {event.subject || t.common.noAvailableData}
                      </p>
                      <p className="max-w-[20rem] truncate text-sm text-slate-500" title={event.recipientEmail}>
                        {event.recipientEmail}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{getOriginLabel(event)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        className="text-sm font-medium text-slate-950 underline"
                        target="_blank"
                        rel="noreferrer noopener"
                        to={`/events/${event.id}`}
                      >
                        {t.overview.details}
                      </Link>
                      <button
                        className="text-sm font-medium text-slate-950 underline"
                        type="button"
                        onClick={() => copyToClipboard(event.messageId)}
                      >
                        {t.overview.copyId}
                      </button>
                      <button
                        className="text-sm font-medium text-slate-950 underline"
                        type="button"
                        onClick={() => copyToClipboard(event.recipientEmail)}
                      >
                        {t.overview.copyRecipient}
                      </button>
                      <Link
                        className="text-sm font-medium text-slate-950 underline"
                        target="_blank"
                        rel="noreferrer noopener"
                        to={`/events/${event.id}#raw-payload`}
                      >
                        {t.overview.rawPayload}
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
