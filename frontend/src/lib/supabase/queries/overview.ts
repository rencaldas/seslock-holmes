import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOverviewAnalytics } from "@/lib/overview/analytics";
import { getEventTable } from "@/lib/supabase/schema";
import { getSupabaseLanguage } from "@/lib/supabase/settings";
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
  const analytics = buildOverviewAnalytics(events, getSupabaseLanguage());
  const uniqueMessagesCount = new Set(events.map((event) => event.messageId)).size;
  const deliveredCount = analytics.deliveredCount;
  const bouncedCount = analytics.bouncedCount;
  const complaintCount = analytics.complaintCount;
  const problemEventsCount = events.filter((event) => PROBLEM_EVENT_TYPES.includes(event.eventType)).length;
  const bounceRate = analytics.reputation.bounceRate;
  const topOrigins = analytics.originApplications
    .map((origin) => ({ name: origin.name, count: origin.count }))
    .slice(0, 5);

  const totalCount = events.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));

  return {
    recentEvents,
    recentEventsCount: totalCount,
    uniqueMessagesCount,
    uniqueRecipientsCount: analytics.uniqueRecipientsCount,
    deliveredCount,
    bouncedCount,
    complaintCount,
    problemEventsCount,
    bounceRate,
    topOrigins,
    analytics,
    windowDays: input.windowDays,
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
    hasPreviousPage: input.page > 1,
    hasNextPage: input.page < totalPages,
  };
}
