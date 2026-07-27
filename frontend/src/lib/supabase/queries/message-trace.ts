import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventTable } from "@/lib/supabase/schema";
import type { EmailEventRow, MessageTraceQueryInput, MessageTraceResult } from "@/lib/supabase/types";
import { getAwsSnsOccurredAt, rowToEmailEvent } from "@/lib/supabase/aws-sns";

const TRACE_KEY_COLUMNS = ["id", "messageId", "snsMessageId"] as const;

function quoteFilterValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function fetchOneByColumn(client: SupabaseClient, eventTable: string, column: "id" | "messageId" | "snsMessageId", value: string) {
  const { data, error } = await client.from(eventTable).select("*").eq(column, value).maybeSingle();
  if (error) {
    if (error.message.includes("relation") && error.message.includes("does not exist")) {
      throw new Error(`A tabela ou view de eventos configurada "${eventTable}" não foi encontrada no Supabase. Defina VITE_SUPABASE_EVENTS_TABLE com o nome correto da relação.`);
    }

    throw new Error(error.message);
  }

  return data as EmailEventRow | null;
}

async function fetchTraceRows(client: SupabaseClient, eventTable: string, traceKey: string) {
  const orFilter = TRACE_KEY_COLUMNS.map((column) => `${column}.eq.${quoteFilterValue(traceKey)}`).join(",");
  const { data, error } = await client.from(eventTable).select("*").or(orFilter);
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmailEventRow[];
}

export async function fetchMessageTrace(
  client: SupabaseClient,
  tableName: string,
  input: MessageTraceQueryInput,
): Promise<MessageTraceResult> {
  const eventTable = tableName || getEventTable();

  const selectedRow =
    (await fetchOneByColumn(client, eventTable, "id", input.eventId)) ??
    (await fetchOneByColumn(client, eventTable, "messageId", input.eventId)) ??
    (await fetchOneByColumn(client, eventTable, "snsMessageId", input.eventId));

  if (!selectedRow) {
    return { selectedEvent: null, traceEvents: [] };
  }

  const selectedEvent = rowToEmailEvent(selectedRow);
  const traceKey = selectedEvent.snsMessageId || selectedEvent.messageId || selectedEvent.id;
  const traceRows = await fetchTraceRows(client, eventTable, traceKey);
  const traceEvents = traceRows
    .sort((a, b) => getAwsSnsOccurredAt(a).localeCompare(getAwsSnsOccurredAt(b)))
    .map((row) => rowToEmailEvent(row));

  return {
    selectedEvent,
    traceEvents: traceEvents.length ? traceEvents : [selectedEvent],
  };
}
