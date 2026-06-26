import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventTable } from "@/lib/supabase/schema";
import type { EmailEventRow, MessageTraceQueryInput, MessageTraceResult } from "@/lib/supabase/types";
import { getAwsSnsOccurredAt, rowToEmailEvent } from "@/lib/supabase/aws-sns";
import { fetchEventRowsWithTimeFallback } from "@/lib/supabase/queries/fetch-event-rows";

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
  const traceCutoff = new Date(0).toISOString();
  const allRows = await fetchEventRowsWithTimeFallback(client, eventTable, traceCutoff);
  const traceEvents = allRows
    .filter((row) => {
      const messageId = row.messageId?.trim() ?? "";
      const snsMessageId = row.snsMessageId?.trim() ?? "";
      return messageId === traceKey || snsMessageId === traceKey || row.id === traceKey;
    })
    .sort((a, b) => getAwsSnsOccurredAt(a).localeCompare(getAwsSnsOccurredAt(b)))
    .map((row) => rowToEmailEvent(row));

  return {
    selectedEvent,
    traceEvents: traceEvents.length ? traceEvents : [selectedEvent],
  };
}
