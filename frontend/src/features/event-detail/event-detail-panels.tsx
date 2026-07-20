import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, toneForEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
import { useI18n } from "@/lib/i18n/use-i18n";
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

export function EventDetailPanels({ event }: { event: EmailEvent }) {
  const t = useI18n();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t.eventDetail.generalInfo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={toneForEventType(event.eventType)}>
              {formatEventType(event.eventType)}
            </Badge>
            <span className="text-sm text-slate-500">{formatDateTime(event.occurredAt)}</span>
          </div>
          <DetailField label={t.eventDetail.subject} value={event.subject || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.eventId} value={event.id} />
          <DetailField label={t.eventDetail.messageId} value={event.messageId} />
          <DetailField label={t.eventDetail.snsMessageId} value={event.snsMessageId || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.deliveryStatus} value={event.deliveryStatus} />
          <DetailField
            label={t.eventDetail.processingTime}
            value={
              event.deliveryProcessingTimeMillis !== null
                ? `${event.deliveryProcessingTimeMillis} ms`
                : t.eventDetail.notAvailable
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.eventDetail.originInfo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailField label={t.eventDetail.appOrigin} value={event.originApp || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.smtpIdentity} value={event.smtpIdentity || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.fromAddress} value={event.fromAddress || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.senderEmail} value={event.senderEmail || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.sourceIp} value={event.sourceIp || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.callerIdentity} value={event.callerIdentity || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.configurationSet} value={event.configurationSet || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.projectTag} value={event.projectTag || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.originTrace} value={getOriginLabel(event)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.eventDetail.destination}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailField label={t.eventDetail.primaryRecipient} value={event.recipientEmail} />
          <DetailField label={t.eventDetail.recipients} value={event.recipientEmail || t.eventDetail.notAvailable} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.eventDetail.routing}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {event.bounceDiagnosis ? (
            <>
              <DetailField label={t.investigation.diagnosisCause} value={event.bounceDiagnosis.cause} />
              <DetailField label={t.investigation.diagnosisRecommendation} value={event.bounceDiagnosis.recommendation} />
              <DetailField label={t.investigation.diagnosisSeverity} value={event.bounceDiagnosis.severity} />
            </>
          ) : null}
          <DetailField label={t.eventDetail.failureReason} value={event.failureReason || t.eventDetail.notAvailable} />
          <DetailField label={t.eventDetail.bounceType} value={String(event.bounceDetails.bounceType ?? t.eventDetail.notAvailable)} />
          <DetailField label={t.eventDetail.bounceSubtype} value={String(event.bounceDetails.bounceSubType ?? t.eventDetail.notAvailable)} />
          <DetailField label={t.eventDetail.diagnosticCode} value={String(event.bounceDetails.diagnosticCode ?? t.eventDetail.notAvailable)} />
          <DetailField label={t.eventDetail.smtpResponse} value={String(event.deliveryDetails.smtpResponse ?? t.eventDetail.notAvailable)} />
          <DetailField label={t.eventDetail.remoteMtaIp} value={String(event.deliveryDetails.remoteMtaIp ?? t.eventDetail.notAvailable)} />
          <DetailField label={t.eventDetail.reportingMta} value={String(event.deliveryDetails.reportingMta ?? t.eventDetail.notAvailable)} />
          <DetailField label={t.eventDetail.complaintFeedback} value={String(event.complaintDetails.complaintFeedbackType ?? t.eventDetail.notAvailable)} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2" id="raw-payload">
        <CardHeader>
          <CardTitle>{t.eventDetail.rawPayload}</CardTitle>
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
