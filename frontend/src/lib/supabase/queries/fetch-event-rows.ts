import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailEventRow } from "@/lib/supabase/types";

const FETCH_BATCH_SIZE = 1000;

export const EMAIL_EVENT_LIST_COLUMNS = [
  "id",
  "created_at",
  "timestamp",
  "messageId",
  "snsMessageId",
  "eventType",
  "notificationType",
  "subject",
  "source",
  "fromAddress",
  "sourceIp",
  "callerIdentity",
  "configurationSet",
  "projectTag",
  "sourceArn",
  "snsTopicArn",
  "sesTags",
  "destination",
  "destinations",
  "bounceType",
  "bounceSubType",
  "bouncedRecipients",
  "diagnosticCode",
  "remoteMtaIp",
  "reportingMta",
  "smtpResponse",
  "deliveryProcessingTimeMillis",
  "complaintFeedbackType",
  "complainedRecipients",
  "userAgent",
].join(",");

interface FetchEventRowsOptions {
  endIso?: string;
  maxRows?: number;
  columns?: string;
  equals?: Array<{
    column: string;
    value: string;
  }>;
  inValues?: Array<{
    column: string;
    values: string[];
  }>;
}

async function fetchRowsByTimeColumn(
  client: SupabaseClient,
  eventTable: string,
  startIso: string,
  timeColumn: "timestamp" | "created_at",
  options: FetchEventRowsOptions,
) {
  const rows: EmailEventRow[] = [];
  const maxRows =
    options.maxRows === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.floor(options.maxRows));
  let offset = 0;

  while (rows.length < maxRows) {
    const batchSize = Math.min(FETCH_BATCH_SIZE, maxRows - rows.length);
    let query = client.from(eventTable).select(options.columns ?? "*").gte(timeColumn, startIso);
    if (options.endIso) {
      query = query.lte(timeColumn, options.endIso);
    }
    for (const filter of options.equals ?? []) {
      query = query.eq(filter.column, filter.value);
    }
    for (const filter of options.inValues ?? []) {
      query = query.in(filter.column, filter.values);
    }

    const { data, error } = await query.order(timeColumn, { ascending: false }).range(offset, offset + batchSize - 1);

    if (error) {
      if (error.message.includes("column") && error.message.includes("does not exist")) {
        throw error;
      }

      throw error;
    }

    const batch = (data ?? []) as unknown as EmailEventRow[];
    rows.push(...batch.slice(0, maxRows - rows.length));

    if (batch.length < batchSize || rows.length >= maxRows) {
      break;
    }

    offset += batchSize;
  }

  return rows;
}

export async function fetchEventRowsWithTimeFallback(
  client: SupabaseClient,
  eventTable: string,
  startIso: string,
  options: FetchEventRowsOptions = {},
) {
  try {
    return await fetchRowsByTimeColumn(client, eventTable, startIso, "timestamp", options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("column") && message.includes("timestamp") && message.includes("does not exist")) {
      return fetchRowsByTimeColumn(client, eventTable, startIso, "created_at", options);
    }

    throw error;
  }
}
