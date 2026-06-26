import type { SupabaseClient } from "@supabase/supabase-js";

export const EVENTS_TABLE_STORAGE_KEY = "ses-investigation.eventsTable";

export const EVENT_TABLE_CANDIDATES = [
  "aws_sns",
  "ses_email_events",
  "email_events",
  "ses_events",
  "events",
  "event_logs",
  "email_event_logs",
  "message_events",
  "mail_events",
  "ses_message_events",
  "ses_email_logs",
  "ses_logs",
  "ses_deliveries",
  "notifications",
  "notification_events",
  "delivery_events",
  "delivery_logs",
  "email_delivery_events",
  "email_deliveries",
  "ses_notifications",
  "ses_delivery_events",
  "ses_delivery_logs",
  "mail_notifications",
  "mailer_events",
  "outbox_events",
  "inbound_messages",
  "email_logs",
  "messages",
  "message_logs",
  "event_history",
  "activity_log",
  "events_log",
  "ses_activity",
] as const;

export function loadEventsTableOverride() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(EVENTS_TABLE_STORAGE_KEY)?.trim();
  return value ? value : null;
}

export function saveEventsTableOverride(tableName: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EVENTS_TABLE_STORAGE_KEY, tableName.trim());
}

function isMissingRelationError(message: string) {
  return message.includes("relation") && message.includes("does not exist");
}

export async function probeEventsTable(client: SupabaseClient, tableName: string) {
  const { error } = await client.from(tableName).select("*").limit(1);
  if (!error) {
    return { ok: true as const };
  }

  if (isMissingRelationError(error.message)) {
    return { ok: false as const, missing: true as const, message: error.message };
  }

  return { ok: false as const, missing: false as const, message: error.message };
}

export async function resolveEventsTable(client: SupabaseClient, preferred?: string | null) {
  const attempts = Array.from(
    new Set([
      preferred?.trim(),
      loadEventsTableOverride(),
      ...EVENT_TABLE_CANDIDATES,
    ].filter(Boolean)),
  ) as string[];

  const tried: string[] = [];

  for (const tableName of attempts) {
    tried.push(tableName);
    const result = await probeEventsTable(client, tableName);
    if (result.ok) {
      return { tableName, tried };
    }

    if (!result.missing) {
      return { tableName: null, tried, error: result.message };
    }
  }

  return { tableName: null, tried };
}
