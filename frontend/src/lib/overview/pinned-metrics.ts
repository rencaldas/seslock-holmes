export type MetricCardId =
  | "total-events"
  | "unique-messages"
  | "unique-recipients"
  | "delivered"
  | "delivery-rate"
  | "bounced"
  | "complaint"
  | "rejected"
  | "delayed"
  | "rendering-failure"
  | "sent";

const STORAGE_KEY = "seslock-holmes.pinned-metrics";

function readPinnedMetrics(): MetricCardId[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as MetricCardId[];
    return Array.isArray(parsed) ? parsed.filter((value): value is MetricCardId => Boolean(value)) : [];
  } catch {
    return [];
  }
}

export function loadPinnedMetrics(): MetricCardId[] {
  return readPinnedMetrics();
}

export function savePinnedMetrics(ids: MetricCardId[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function togglePinnedMetric(currentIds: MetricCardId[], id: MetricCardId) {
  return currentIds.includes(id) ? currentIds.filter((metricId) => metricId !== id) : [...currentIds, id];
}

export function reorderPinnedMetrics(currentIds: MetricCardId[], id: MetricCardId, anchorId: MetricCardId) {
  const nextIds = [...currentIds];
  const fromIndex = nextIds.indexOf(id);
  const toIndex = nextIds.indexOf(anchorId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return nextIds;
  }

  const [removed] = nextIds.splice(fromIndex, 1);
  if (!removed) {
    return nextIds;
  }

  nextIds.splice(toIndex, 0, removed);
  return nextIds;
}
