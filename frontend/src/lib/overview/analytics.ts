import type { AppLanguage } from "@/lib/i18n/types";
import type { EmailEvent, EmailEventType } from "@/lib/supabase/types";

export type OverviewReputationStatus = "healthy" | "attention" | "critical";

export interface OverviewTopProvider {
  domain: string;
  totalCount: number;
  deliveredCount: number;
  bouncedCount: number;
  bounceRate: number;
}

export interface OverviewBounceReason {
  label: string;
  count: number;
  percentage: number;
}

export interface OverviewEventDistribution {
  type: EmailEventType | "open" | "click";
  label: string;
  count: number;
}

export interface OverviewOriginApplication {
  name: string;
  count: number;
}

export interface OverviewReputationSummary {
  bounceRate: number;
  complaintRate: number;
  status: OverviewReputationStatus;
  reason: string;
}

export interface OverviewAnalytics {
  deliveredCount: number;
  bouncedCount: number;
  complaintCount: number;
  rejectedCount: number;
  delayedCount: number;
  renderingFailureCount: number;
  sentCount: number;
  uniqueRecipientsCount: number;
  lastEventAt: string | null;
  averageDeliveryTimeMs: number | null;
  deliveryRate: number | null;
  reputation: OverviewReputationSummary;
  topProviders: OverviewTopProvider[];
  topBounceReasons: OverviewBounceReason[];
  eventDistribution: OverviewEventDistribution[];
  originApplications: OverviewOriginApplication[];
}

const EVENT_LABELS: Record<OverviewEventDistribution["type"], Record<AppLanguage, string>> = {
  sent: {
    "pt-BR": "Enviado",
    "en-US": "Sent",
  },
  delivered: {
    "pt-BR": "Delivery",
    "en-US": "Delivery",
  },
  bounced: {
    "pt-BR": "Bounce",
    "en-US": "Bounce",
  },
  complained: {
    "pt-BR": "Complaint",
    "en-US": "Complaint",
  },
  rejected: {
    "pt-BR": "Rejeitado",
    "en-US": "Reject",
  },
  delayed: {
    "pt-BR": "Atrasado",
    "en-US": "Delayed",
  },
  rendering_failure: {
    "pt-BR": "Falha de renderização",
    "en-US": "Rendering failure",
  },
  open: {
    "pt-BR": "Open",
    "en-US": "Open",
  },
  click: {
    "pt-BR": "Click",
    "en-US": "Click",
  },
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getFirstValue(values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

function getDomain(value: string) {
  const email = normalizeText(value);
  const domain = email.split("@")[1];
  return domain || "N/A";
}

function getRecipientDomain(event: EmailEvent) {
  return getDomain(getFirstValue([event.recipientEmail]));
}

function getOriginApplicationLabel(event: EmailEvent) {
  return getFirstValue([
    event.originApp,
    event.configurationSet,
    event.projectTag,
    event.smtpIdentity,
    event.senderEmail,
    event.fromAddress,
  ]);
}

function getBounceReason(event: EmailEvent) {
  return getFirstValue([
    event.rejectionDetails?.reason as string | undefined,
    event.bounceDetails?.bounceSubType as string | undefined,
    event.bounceDetails?.bounceType as string | undefined,
    event.bounceDetails?.diagnosticCode as string | undefined,
    event.failureReason,
  ]);
}

function countBy<T>(items: T[], keySelector: (item: T) => string) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keySelector(item);
    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function formatReputationReason(language: AppLanguage, bounceRate: number, complaintRate: number) {
  const isEnglish = language === "en-US";

  if (bounceRate > 5) {
    return isEnglish ? "Bounce rate is above the recommended threshold" : "Bounce acima do recomendado";
  }

  if (complaintRate > 0.3) {
    return isEnglish ? "Complaint rate is above the limit" : "Reclamações acima do limite";
  }

  if (bounceRate >= 2) {
    return isEnglish ? "Bounce rate is in the attention zone" : "Bounce em zona de atenção";
  }

  if (complaintRate > 0.1) {
    return isEnglish ? "Complaint rate is above expectations" : "Reclamações acima do esperado";
  }

  return isEnglish ? "Within the recommended thresholds" : "Dentro dos parâmetros recomendados";
}

function getReputationStatus(bounceRate: number, complaintRate: number): OverviewReputationStatus {
  if (bounceRate > 5 || complaintRate > 0.3) {
    return "critical";
  }

  if (bounceRate >= 2 || complaintRate > 0.1) {
    return "attention";
  }

  return "healthy";
}

function computeAverageDeliveryTimeMs(events: EmailEvent[]) {
  const traces = new Map<string, { sentAt: number | null; deliveredAt: number | null }>();

  for (const event of events) {
    const key = event.messageId || event.snsMessageId || event.id;
    if (!key) {
      continue;
    }

    const existing = traces.get(key) ?? { sentAt: null, deliveredAt: null };
    const time = new Date(event.occurredAt).getTime();
    if (Number.isNaN(time)) {
      traces.set(key, existing);
      continue;
    }

    if (event.eventType === "sent" && (existing.sentAt === null || time < existing.sentAt)) {
      existing.sentAt = time;
    }

    if (event.eventType === "delivered" && (existing.deliveredAt === null || time < existing.deliveredAt)) {
      existing.deliveredAt = time;
    }

    traces.set(key, existing);
  }

  const durations = Array.from(traces.values())
    .filter((trace) => trace.sentAt !== null && trace.deliveredAt !== null && trace.deliveredAt >= trace.sentAt)
    .map((trace) => (trace.deliveredAt ?? 0) - (trace.sentAt ?? 0));

  if (!durations.length) {
    return null;
  }

  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

export function buildOverviewAnalytics(events: EmailEvent[], language: AppLanguage): OverviewAnalytics {
  const deliveredCount = events.filter((event) => event.eventType === "delivered").length;
  const bouncedCount = events.filter((event) => event.eventType === "bounced").length;
  const complaintCount = events.filter((event) => event.eventType === "complained").length;
  const rejectedCount = events.filter((event) => event.eventType === "rejected").length;
  const delayedCount = events.filter((event) => event.eventType === "delayed").length;
  const renderingFailureCount = events.filter((event) => event.eventType === "rendering_failure").length;
  const sentCount = events.filter((event) => event.eventType === "sent").length;
  const totalCount = events.length;
  const uniqueRecipientsCount = new Set(
    events
      .map((event) => normalizeText(event.recipientEmail))
      .filter((value) => value.includes("@")),
  ).size;
  const lastEventAt = events[0]?.occurredAt ?? null;
  const averageDeliveryTimeMs = computeAverageDeliveryTimeMs(events);
  const deliveryRate =
    sentCount > 0 ? (deliveredCount / sentCount) * 100 : totalCount > 0 ? (deliveredCount / totalCount) * 100 : null;
  const bounceRate = totalCount > 0 ? (bouncedCount / totalCount) * 100 : 0;
  const complaintRate = totalCount > 0 ? (complaintCount / totalCount) * 100 : 0;
  const reputationStatus = getReputationStatus(bounceRate, complaintRate);

  const topProvidersMap = new Map<string, { totalCount: number; deliveredCount: number; bouncedCount: number }>();
  for (const event of events) {
    const domain = getRecipientDomain(event);
    const current = topProvidersMap.get(domain) ?? { totalCount: 0, deliveredCount: 0, bouncedCount: 0 };
    current.totalCount += 1;
    if (event.eventType === "delivered") {
      current.deliveredCount += 1;
    }
    if (event.eventType === "bounced") {
      current.bouncedCount += 1;
    }
    topProvidersMap.set(domain, current);
  }

  const topProviders = Array.from(topProvidersMap.entries())
    .map(([domain, totals]) => ({
      domain,
      ...totals,
      bounceRate: totals.totalCount > 0 ? (totals.bouncedCount / totals.totalCount) * 100 : 0,
    }))
    .sort((left, right) => right.totalCount - left.totalCount || left.domain.localeCompare(right.domain))
    .slice(0, 8);

  const bounceReasonCounts = countBy(
    events.filter((event) => event.eventType === "bounced"),
    (event) => getBounceReason(event) || "N/A",
  );
  const bouncedTotal = bouncedCount || 1;
  const topBounceReasons = Array.from(bounceReasonCounts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: (count / bouncedTotal) * 100,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 8);

  const eventTypeOrder: Array<OverviewEventDistribution["type"]> = [
    "sent",
    "delivered",
    "bounced",
    "complained",
    "rejected",
    "delayed",
    "rendering_failure",
    "open",
    "click",
  ];

  const eventDistribution = eventTypeOrder.map((type) => ({
    type,
    label: EVENT_LABELS[type][language],
    count: type === "open" || type === "click" ? 0 : events.filter((event) => event.eventType === type).length,
  }));

  const originApplicationsMap = countBy(events, (event) => getOriginApplicationLabel(event) || "N/A");
  const originApplications = Array.from(originApplicationsMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 8);

  return {
    deliveredCount,
    bouncedCount,
    complaintCount,
    rejectedCount,
    delayedCount,
    renderingFailureCount,
    sentCount,
    uniqueRecipientsCount,
    lastEventAt,
    averageDeliveryTimeMs,
    deliveryRate,
    reputation: {
      bounceRate,
      complaintRate,
      status: reputationStatus,
      reason: formatReputationReason(language, bounceRate, complaintRate),
    },
    topProviders,
    topBounceReasons,
    eventDistribution,
    originApplications,
  };
}

export function formatRelativeTime(value: string | null | undefined, language: AppLanguage) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });

  if (abs < 60) {
    return rtf.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffSeconds / 3600);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffSeconds / 86400);
  return rtf.format(diffDays, "day");
}
