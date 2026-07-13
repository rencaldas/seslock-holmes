import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOverviewAnalytics } from "@/lib/overview/analytics";
import { getEventTable } from "@/lib/supabase/schema";
import { getSupabaseLanguage } from "@/lib/supabase/settings";
import { PROBLEM_EVENT_TYPES, type OverviewQueryInput, type OverviewResult } from "@/lib/supabase/types";
import {
  getAwsSnsOccurredAt,
  rowMatchesOrigin,
  rowMatchesRecipientDomain,
  rowMatchesStatus,
  rowMatchesSubject,
  rowToEmailEvent,
} from "@/lib/supabase/aws-sns";
import { fetchEventRowsWithTimeFallback } from "@/lib/supabase/queries/fetch-event-rows";
import { resolveTimeRange } from "@/lib/time-filters";

function compareRecipientEmails(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function sortRecentEvents<T extends { occurredAt: string; recipientEmail: string }>(
  events: T[],
  recentActivitySort: OverviewQueryInput["recentActivitySort"],
) {
  return [...events].sort((left, right) => {
    const leftTime = new Date(left.occurredAt).getTime();
    const rightTime = new Date(right.occurredAt).getTime();
    const timeComparison = rightTime - leftTime;

    switch (recentActivitySort) {
      case "time-asc":
        return leftTime - rightTime || compareRecipientEmails(left.recipientEmail, right.recipientEmail);
      case "recipient-asc":
        return compareRecipientEmails(left.recipientEmail, right.recipientEmail) || timeComparison;
      case "recipient-desc":
        return compareRecipientEmails(right.recipientEmail, left.recipientEmail) || timeComparison;
      case "time-desc":
      default:
        return timeComparison || compareRecipientEmails(left.recipientEmail, right.recipientEmail);
    }
  });
}

export async function fetchOverview(
  client: SupabaseClient,
  tableName: string,
  input: OverviewQueryInput,
): Promise<OverviewResult> {
  const { startIso, endIso } = resolveTimeRange(input);
  const eventTable = tableName || getEventTable();
  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;
  const origin = input.origin.trim();
  const subject = input.subject.trim();
  const provider = input.provider.trim();

  const rows = await fetchEventRowsWithTimeFallback(client, eventTable, startIso, endIso);
  const events = sortRecentEvents(
    rows
    .filter((row) => getAwsSnsOccurredAt(row) >= startIso)
    .filter((row) => (endIso ? getAwsSnsOccurredAt(row) <= endIso : true))
    .filter((row) => rowMatchesStatus(row, input.status))
    .filter((row) => rowMatchesOrigin(row, origin))
    .filter((row) => rowMatchesSubject(row, subject))
    .filter((row) => rowMatchesRecipientDomain(row, provider))
    .map((row) => rowToEmailEvent(row)),
    input.recentActivitySort,
  );
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
