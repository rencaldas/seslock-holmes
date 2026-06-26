import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
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
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Atividade recente</CardTitle>
          <p className="text-sm text-slate-500">
            Página {page} de {totalPages}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={!hasPreviousPage} onClick={onPreviousPage}>
            Anterior
          </Button>
          <Button type="button" variant="secondary" disabled={!hasNextPage} onClick={onNextPage}>
            Próxima
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(event.occurredAt)}</TableCell>
                  <TableCell>
                    <Badge tone={event.eventType === "delivered" ? "success" : "muted"}>
                      {formatEventType(event.eventType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-slate-950">{event.recipientEmail}</TableCell>
                  <TableCell>{getOriginLabel(event)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Link className="text-sm font-medium text-slate-950 underline" to={`/events/${event.id}`}>
                        Detalhes
                      </Link>
                      <button
                        className="text-sm font-medium text-slate-950 underline"
                        type="button"
                        onClick={() => copyToClipboard(event.messageId)}
                      >
                        Copiar ID
                      </button>
                      <button
                        className="text-sm font-medium text-slate-950 underline"
                        type="button"
                        onClick={() => copyToClipboard(event.recipientEmail)}
                      >
                        Copiar destinatário
                      </button>
                      <Link
                        className="text-sm font-medium text-slate-950 underline"
                        to={`/events/${event.id}#raw-payload`}
                      >
                        Payload bruto
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
