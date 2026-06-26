import type { EmailEvent } from "@/lib/supabase/types";
import { formatEventType, isProblemEventType } from "@/lib/formatters/email";

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
