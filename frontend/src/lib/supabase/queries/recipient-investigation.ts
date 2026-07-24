import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventTable } from "@/lib/supabase/schema";
import {
  PROBLEM_EVENT_TYPES,
  type EmailEvent,
  type RecipientInvestigationQueryInput,
  type RecipientInvestigationResult,
} from "@/lib/supabase/types";
import { normalizeEmail } from "@/lib/formatters/email";
import {
  getAwsSnsOccurredAt,
  getAwsSnsEventTypeFilterValues,
  rowMatchesOrigin,
  rowMatchesBounceDiagnostic,
  rowMatchesRecipientDomain,
  rowMatchesRecipient,
  rowMatchesSender,
  rowMatchesStatus,
  rowMatchesSubject,
  rowToEmailEvent,
} from "@/lib/supabase/aws-sns";
import {
  EMAIL_EVENT_LIST_COLUMNS,
  fetchEventRowsWithTimeFallback,
} from "@/lib/supabase/queries/fetch-event-rows";
import { resolveTimeRange } from "@/lib/time-filters";

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function getSearchValue(event: EmailEvent, mode: RecipientInvestigationQueryInput["searchMode"]) {
  switch (mode) {
    case "sender":
      return event.senderEmail || event.fromAddress || event.callerIdentity;
    case "origin":
      return `${event.originApp} ${event.smtpIdentity} ${event.senderEmail} ${event.configurationSet} ${event.projectTag}`;
    case "diagnostic":
      return `${event.failureReason} ${event.bounceDiagnosis?.cause ?? ""} ${event.bounceDiagnosis?.recommendation ?? ""}`;
    case "recipient":
    default:
      return event.recipientEmail;
  }
}

function longestCommonPrefixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function similarityScore(query: string, candidate: string) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedCandidate = normalizeSearchText(candidate);
  if (!normalizedQuery || !normalizedCandidate || normalizedQuery === normalizedCandidate) {
    return 0;
  }

  const [queryLocal = "", queryDomain = ""] = normalizedQuery.split("@");
  const [candidateLocal = "", candidateDomain = ""] = normalizedCandidate.split("@");
  let score = 0;

  if (queryDomain && candidateDomain && queryDomain === candidateDomain) {
    score += 30;
  }

  const prefix = longestCommonPrefixLength(queryLocal, candidateLocal);
  score += prefix * 6;

  if (candidateLocal.startsWith(queryLocal) || queryLocal.startsWith(candidateLocal)) {
    score += 20;
  }

  if (candidateLocal.includes(queryLocal) || queryLocal.includes(candidateLocal)) {
    score += 12;
  }

  const fullPrefix = longestCommonPrefixLength(normalizedQuery, normalizedCandidate);
  score += fullPrefix * 2;
  score -= Math.abs(normalizedQuery.length - normalizedCandidate.length);

  return score;
}

function buildRelatedEmails(events: EmailEvent[], searchText: string, mode: RecipientInvestigationQueryInput["searchMode"]) {
  if (mode === "origin" || mode === "diagnostic") {
    return [];
  }

  const counts = new Map<string, number>();
  for (const event of events) {
    const candidate = normalizeSearchText(getSearchValue(event, mode));
    if (!candidate || candidate === normalizeSearchText(searchText)) {
      continue;
    }

    counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([email, count]) => ({
      email,
      count,
      score: similarityScore(searchText, email) + count * 2,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.count - left.count || left.email.localeCompare(right.email))
    .slice(0, 5)
    .map(({ email, count }) => ({ email, count }));
}

export async function fetchRecipientInvestigation(
  client: SupabaseClient,
  tableName: string,
  input: RecipientInvestigationQueryInput,
): Promise<RecipientInvestigationResult> {
  const searchText = input.searchText.trim();
  const normalizedSearchText = normalizeEmail(searchText);
  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;
  const { startIso, endIso } = resolveTimeRange(input);
  const eventTable = tableName || getEventTable();
  const eventTypeFilterValues = getAwsSnsEventTypeFilterValues(input.status);

  const rows = await fetchEventRowsWithTimeFallback(client, eventTable, startIso, {
    endIso,
    maxRows: input.rowLimit,
    columns: EMAIL_EVENT_LIST_COLUMNS,
    equals:
      input.searchMode === "recipient" && normalizedSearchText
        ? [{ column: "destination", value: normalizedSearchText }]
        : undefined,
    inValues: eventTypeFilterValues.length
      ? [{ column: "eventType", values: eventTypeFilterValues }]
      : undefined,
  });
  const scopedRows = rows
    .filter((row) => getAwsSnsOccurredAt(row) >= startIso)
    .filter((row) => (endIso ? getAwsSnsOccurredAt(row) <= endIso : true))
    .filter((row) => rowMatchesStatus(row, input.status))
    .filter((row) => rowMatchesOrigin(row, input.origin))
    .filter((row) => rowMatchesSubject(row, input.subject))
    .filter((row) => rowMatchesRecipientDomain(row, input.provider));

  const matchingRows = scopedRows.filter((row) => {
    switch (input.searchMode) {
      case "sender":
        return rowMatchesSender(row, searchText);
      case "origin":
        return rowMatchesOrigin(row, searchText);
      case "diagnostic":
        return rowMatchesBounceDiagnostic(row, searchText);
      case "recipient":
      default:
        return rowMatchesRecipient(row, searchText);
    }
  });

  const matchingEvents = matchingRows
    .sort((a, b) => getAwsSnsOccurredAt(b).localeCompare(getAwsSnsOccurredAt(a)))
    .map((row) => rowToEmailEvent(row));

  const pageEvents = matchingEvents.slice(from, to + 1);
  const relatedEmails = matchingEvents.length ? [] : buildRelatedEmails(scopedRows.map((row) => rowToEmailEvent(row)), searchText, input.searchMode);

  return {
    recipientEmail: normalizedSearchText,
    searchText,
    searchMode: input.searchMode,
    totalCount: matchingEvents.length,
    latestEventAt: matchingEvents[0]?.occurredAt ?? null,
    hasProblemActivity: matchingEvents.some((event) => PROBLEM_EVENT_TYPES.includes(event.eventType)),
    hasMore: matchingEvents.length > to + 1,
    page: input.page,
    pageSize: input.pageSize,
    events: pageEvents,
    relatedEmails,
  };
}
