import type { EmailEvent } from "@/lib/supabase/types";
import { formatEventType, isProblemEventType } from "@/lib/formatters/email";
import type { TranslationBundle } from "@/lib/i18n/types";

export function summarizeEvent(event: EmailEvent) {
  const label = formatEventType(event.eventType);
  if (!isProblemEventType(event.eventType)) {
    return label;
  }

  return `${label}${event.failureReason ? `: ${event.failureReason}` : ""}`;
}

export function getOriginLabel(event: EmailEvent) {
  return event.originApp || event.smtpIdentity || "Origem desconhecida";
}

export interface TraceEventDetail {
  label: string;
  value: string;
  mono?: boolean;
}

export function getTraceEventDetails(event: EmailEvent, t: TranslationBundle): TraceEventDetail[] {
  const rows: TraceEventDetail[] = [];

  const push = (label: string, value: unknown, mono = false) => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (text) {
      rows.push({ label, value: text, mono });
    }
  };

  switch (event.eventType) {
    case "sent":
      push(t.eventDetail.appOrigin, event.originApp);
      push(t.eventDetail.sourceIp, event.sourceIp, true);
      push(t.eventDetail.configurationSet, event.configurationSet);
      push(t.eventDetail.callerIdentity, event.callerIdentity);
      break;
    case "delivered":
      push(
        t.eventDetail.processingTime,
        event.deliveryProcessingTimeMillis !== null ? `${event.deliveryProcessingTimeMillis} ms` : "",
      );
      push(t.eventDetail.smtpResponse, event.deliveryDetails.smtpResponse, true);
      push(t.eventDetail.remoteMtaIp, event.deliveryDetails.remoteMtaIp, true);
      push(t.eventDetail.reportingMta, event.deliveryDetails.reportingMta);
      break;
    case "bounced":
      push(t.eventDetail.bounceType, event.bounceDetails.bounceType);
      push(t.eventDetail.bounceSubtype, event.bounceDetails.bounceSubType);
      push(t.eventDetail.diagnosticCode, event.bounceDetails.diagnosticCode, true);
      push(t.eventDetail.smtpResponse, event.bounceDetails.smtpResponse, true);
      push(t.eventDetail.reportingMta, event.bounceDetails.reportingMta);
      break;
    case "complained":
      push(t.eventDetail.complaintFeedback, event.complaintDetails.complaintFeedbackType);
      break;
    case "delayed":
    case "rejected":
    case "rendering_failure":
      push(t.eventDetail.failureReason, event.failureReason);
      break;
  }

  return rows;
}
