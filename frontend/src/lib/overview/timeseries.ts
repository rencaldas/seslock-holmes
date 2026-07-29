import type { AppLanguage } from "@/lib/i18n/types";
import type { EmailEvent } from "@/lib/supabase/types";

export interface EventTimeSeriesPoint {
  timestamp: number;
  label: string;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  total: number;
}

export type TimeSeriesGranularity = "hour" | "day";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function formatBucketLabel(timestamp: number, granularity: TimeSeriesGranularity, language: AppLanguage) {
  const date = new Date(timestamp);
  if (granularity === "hour") {
    return new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(language, { day: "2-digit", month: "2-digit" }).format(date);
}

export function buildEventTimeSeries(
  events: EmailEvent[],
  language: AppLanguage,
): { points: EventTimeSeriesPoint[]; granularity: TimeSeriesGranularity } {
  const timestamps = events
    .map((event) => new Date(event.occurredAt).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return { points: [], granularity: "hour" };
  }

  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const span = Math.max(maxTs - minTs, HOUR_MS);
  const granularity: TimeSeriesGranularity = span <= 3 * DAY_MS ? "hour" : "day";
  const bucketMs = granularity === "hour" ? HOUR_MS : DAY_MS;
  const bucketStart = (value: number) => Math.floor(value / bucketMs) * bucketMs;
  const firstBucket = bucketStart(minTs);
  const lastBucket = bucketStart(maxTs);

  const buckets = new Map<number, EventTimeSeriesPoint>();
  for (let cursor = firstBucket; cursor <= lastBucket; cursor += bucketMs) {
    buckets.set(cursor, {
      timestamp: cursor,
      label: formatBucketLabel(cursor, granularity, language),
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      total: 0,
    });
  }

  for (const event of events) {
    const ts = new Date(event.occurredAt).getTime();
    if (!Number.isFinite(ts)) {
      continue;
    }
    const point = buckets.get(bucketStart(ts));
    if (!point) {
      continue;
    }
    point.total += 1;
    if (event.eventType === "sent") point.sent += 1;
    if (event.eventType === "delivered") point.delivered += 1;
    if (event.eventType === "bounced") point.bounced += 1;
    if (event.eventType === "complained") point.complained += 1;
  }

  return { points: Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp), granularity };
}

export function pickTrendDirection(
  points: EventTimeSeriesPoint[],
  pickValue: (point: EventTimeSeriesPoint) => number,
): "up" | "down" | "flat" {
  if (points.length < 2) {
    return "flat";
  }

  const mid = Math.max(1, Math.floor(points.length / 2));
  const firstHalfSum = points.slice(0, mid).reduce((sum, point) => sum + pickValue(point), 0);
  const secondHalfSum = points.slice(mid).reduce((sum, point) => sum + pickValue(point), 0);

  if (secondHalfSum === firstHalfSum) {
    return "flat";
  }

  return secondHalfSum > firstHalfSum ? "up" : "down";
}

export function extractSeries(
  points: EventTimeSeriesPoint[],
  pickValue: (point: EventTimeSeriesPoint) => number,
): number[] {
  return points.map(pickValue);
}
