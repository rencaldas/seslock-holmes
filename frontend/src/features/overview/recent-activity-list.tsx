import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Copy, Eye, MoreHorizontal, Send, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, toneForEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { EmailEvent } from "@/lib/supabase/types";
import { EmailReportExport } from "@/features/overview/email-report-export";

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

function EventActionsMenu({ event }: { event: EmailEvent }) {
  const t = useI18n();
  const menuRef = useRef<HTMLDetailsElement>(null);

  function runAndClose(action: () => void) {
    action();
    menuRef.current?.removeAttribute("open");
  }

  useEffect(() => {
    const details = menuRef.current;
    if (!details) {
      return;
    }

    function handleClickOutside(clickEvent: MouseEvent) {
      if (details && !details.contains(clickEvent.target as Node)) {
        details.removeAttribute("open");
      }
    }

    function handleToggle() {
      if (details?.open) {
        document.addEventListener("mousedown", handleClickOutside);
      } else {
        document.removeEventListener("mousedown", handleClickOutside);
      }
    }

    details.addEventListener("toggle", handleToggle);
    return () => {
      details.removeEventListener("toggle", handleToggle);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <details ref={menuRef} className="relative">
      <summary
        aria-label={t.overview.tableActions}
        className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-card border border-slate-200 bg-white p-1.5 shadow-hover dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          className="flex w-full items-center rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => runAndClose(() => copyToClipboard(event.messageId))}
        >
          <Copy className="mr-2 h-4 w-4 text-ink-muted" />
          {t.overview.copyId}
        </button>
        <button
          type="button"
          className="flex w-full items-center rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => runAndClose(() => copyToClipboard(event.recipientEmail))}
        >
          <UserRound className="mr-2 h-4 w-4 text-ink-muted" />
          {t.overview.copyRecipient}
        </button>
        <button
          type="button"
          className="flex w-full items-center rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() =>
            runAndClose(() => copyToClipboard(event.senderEmail || event.fromAddress || ""))
          }
        >
          <Send className="mr-2 h-4 w-4 text-ink-muted" />
          {t.overview.copySender}
        </button>
      </div>
    </details>
  );
}

export function RecentActivityList({
  events,
  reportEvents,
  reportQuery,
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
}: {
  events: EmailEvent[];
  reportEvents: EmailEvent[];
  reportQuery: Record<string, string>;
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
          <p className="text-sm text-ink-muted">
            {t.overview.pageLabel} {page} de {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EmailReportExport events={reportEvents} query={reportQuery} />
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
                    <div className="max-w-md space-y-1.5">
                      <p className="font-semibold text-ink">
                        {event.subject || t.common.noAvailableData}
                      </p>
                      <p className="break-all text-sm text-ink-muted">
                        <span className="font-medium text-ink-muted/80">{t.overview.tableFromLabel}:</span>{" "}
                        {event.senderEmail || event.fromAddress || t.common.noAvailableData}
                      </p>
                      <p className="break-all text-sm text-ink-muted">
                        <span className="font-medium text-ink-muted/80">{t.overview.tableToLabel}:</span>{" "}
                        {event.recipientEmail || t.common.noAvailableData}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{getOriginLabel(event)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Link to={`/events/${event.id}`} target="_blank" rel="noreferrer noopener">
                        <Button type="button" variant="secondary" className="h-8 px-3 text-xs">
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          {t.overview.details}
                        </Button>
                      </Link>
                      <EventActionsMenu event={event} />
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
