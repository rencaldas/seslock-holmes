import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, isProblemEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
import type { EmailEvent } from "@/lib/supabase/types";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function formatJson(value: unknown) {
  if (!value || (typeof value === "object" && value !== null && Object.keys(value as Record<string, unknown>).length === 0)) {
    return "Não disponível";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Não disponível";
  }
}

export function EventDetailPanels({ event }: { event: EmailEvent }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Informações gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={isProblemEventType(event.eventType) ? "warning" : "success"}>
              {formatEventType(event.eventType)}
            </Badge>
            <span className="text-sm text-slate-500">{formatDateTime(event.occurredAt)}</span>
          </div>
          <DetailField label="Assunto" value={event.subject || "Não disponível"} />
          <DetailField label="ID do evento" value={event.id} />
          <DetailField label="Message ID" value={event.messageId} />
          <DetailField label="SNS Message ID" value={event.snsMessageId || "Não disponível"} />
          <DetailField label="Status de entrega" value={event.deliveryStatus} />
          <DetailField
            label="Tempo de processamento da entrega"
            value={
              event.deliveryProcessingTimeMillis !== null
                ? `${event.deliveryProcessingTimeMillis} ms`
                : "Não disponível"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Origem e atribuição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailField label="Aplicação de origem" value={event.originApp || "Não disponível"} />
          <DetailField label="Identidade SMTP" value={event.smtpIdentity || "Não disponível"} />
          <DetailField label="From address" value={event.fromAddress || "Não disponível"} />
          <DetailField label="Email do remetente" value={event.senderEmail || "Não disponível"} />
          <DetailField label="Source IP" value={event.sourceIp || "Não disponível"} />
          <DetailField label="Caller identity" value={event.callerIdentity || "Não disponível"} />
          <DetailField label="Configuration set" value={event.configurationSet || "Não disponível"} />
          <DetailField label="Project tag" value={event.projectTag || "Não disponível"} />
          <DetailField label="Origem do rastreamento" value={getOriginLabel(event)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailField label="Destinatário principal" value={event.recipientEmail} />
          <DetailField label="Destinatários" value={formatJson(event.recipientInfo.destination ?? event.recipientInfo.destinations)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bounce, complaint e entrega</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <DetailField label="Motivo da falha" value={event.failureReason || "Não disponível"} />
          <DetailField label="Bounce type" value={String(event.bounceDetails.bounceType ?? "Não disponível")} />
          <DetailField label="Bounce subtype" value={String(event.bounceDetails.bounceSubType ?? "Não disponível")} />
          <DetailField label="Diagnostic code" value={String(event.bounceDetails.diagnosticCode ?? "Não disponível")} />
          <DetailField label="SMTP response" value={String(event.deliveryDetails.smtpResponse ?? "Não disponível")} />
          <DetailField label="Remote MTA IP" value={String(event.deliveryDetails.remoteMtaIp ?? "Não disponível")} />
          <DetailField label="Reporting MTA" value={String(event.deliveryDetails.reportingMta ?? "Não disponível")} />
          <DetailField
            label="Complaint feedback"
            value={String(event.complaintDetails.complaintFeedbackType ?? "Não disponível")}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2" id="raw-payload">
        <CardHeader>
          <CardTitle>Payload bruto</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {JSON.stringify(event.rawPayload, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
