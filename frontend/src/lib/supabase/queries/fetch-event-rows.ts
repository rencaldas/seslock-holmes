import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailEventRow } from "@/lib/supabase/types";
// Import relativo com extensão .js (e não pelo alias @/) porque este módulo é
// alcançado pelo report-runner nas funções da Vercel, onde o loader ESM do
// Node resolve os caminhos em runtime e exige a extensão explícita. O import
// de EmailEventRow acima pode usar @/ por ser `import type`, apagado na
// compilação e nunca resolvido pelo Node.
import { UNLIMITED_ROW_LIMIT_CAP } from "../../row-limits.js";

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

export interface FetchEventRowsResult {
  rows: EmailEventRow[];
  // Só é true quando a busca parou no teto de segurança que NÓS impomos
  // (UNLIMITED_ROW_LIMIT_CAP, usado quando maxRows vem indefinido por causa da
  // opção "sem limite"). Um recorte pedido pelo próprio usuário via rowLimit
  // não conta: ele já escolheu aquele número e o vê no seletor de filtros.
  truncated: boolean;
}

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
  const cappedByDefault = options.maxRows === undefined;
  const maxRows = cappedByDefault
    ? UNLIMITED_ROW_LIMIT_CAP
    : Math.max(1, Math.floor(options.maxRows as number));
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

  return { rows, truncated: cappedByDefault && rows.length >= maxRows };
}

export async function fetchEventRowsWithTimeFallback(
  client: SupabaseClient,
  eventTable: string,
  startIso: string,
  options: FetchEventRowsOptions = {},
): Promise<FetchEventRowsResult> {
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
