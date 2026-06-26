import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventTable } from "@/lib/supabase/schema";
import { PROBLEM_EVENT_TYPES, type OverviewQueryInput, type OverviewResult } from "@/lib/supabase/types";
import { getAwsSnsOccurredAt, rowMatchesOrigin, rowMatchesStatus, rowToEmailEvent } from "@/lib/supabase/aws-sns";
import { fetchEventRowsWithTimeFallback } from "@/lib/supabase/queries/fetch-event-rows";

export async function fetchOverview(
  client: SupabaseClient,
  tableName: string,
  input: OverviewQueryInput,
): Promise<OverviewResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - input.windowDays);
  const eventTable = tableName || getEventTable();
  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;
  const origin = input.origin.trim();

  const rows = await fetchEventRowsWithTimeFallback(client, eventTable, cutoff.toISOString());
  const events = rows
    .filter((row) => getAwsSnsOccurredAt(row) >= cutoff.toISOString())
    .filter((row) => rowMatchesStatus(row, input.status))
    .filter((row) => rowMatchesOrigin(row, origin))
    .sort((a, b) => getAwsSnsOccurredAt(b).localeCompare(getAwsSnsOccurredAt(a)))
    .map((row) => rowToEmailEvent(row));
  const recentEvents = events.slice(from, to + 1);
  const uniqueMessagesCount = new Set(events.map((event) => event.messageId)).size;
  const deliveredCount = events.filter((event) => event.eventType === "delivered").length;
  const bouncedCount = events.filter((event) => event.eventType === "bounced").length;
  const complaintCount = events.filter((event) => event.eventType === "complained").length;
  const problemEventsCount = events.filter((event) => PROBLEM_EVENT_TYPES.includes(event.eventType)).length;
  const bounceRate = events.length ? (bouncedCount / events.length) * 100 : 0;

  const topOriginsMap = new Map<string, number>();
  for (const event of events) {
    const key = event.originApp || "Origem desconhecida";
    topOriginsMap.set(key, (topOriginsMap.get(key) ?? 0) + 1);
  }

  const totalCount = events.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));

  return {
    recentEvents,
    recentEventsCount: totalCount,
    uniqueMessagesCount,
    deliveredCount,
    bouncedCount,
    complaintCount,
    problemEventsCount,
    bounceRate,
    topOrigins: Array.from(topOriginsMap.entries())
      .map(([name, total]) => ({ name, count: total }))
      .slice(0, 5),
    windowDays: input.windowDays,
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
    hasPreviousPage: input.page > 1,
    hasNextPage: input.page < totalPages,
  };
}
