import type { useI18n } from "@/lib/i18n/use-i18n";
import type { OverviewReputationStatus } from "@/lib/overview/analytics";

export function reputationTone(status: OverviewReputationStatus): "success" | "warning" | "destructive" {
  if (status === "healthy") {
    return "success";
  }
  if (status === "attention") {
    return "warning";
  }
  return "destructive";
}

export function reputationLabel(t: ReturnType<typeof useI18n>, status: OverviewReputationStatus) {
  switch (status) {
    case "healthy":
      return t.overview.analytics.reputationHealthy;
    case "attention":
      return t.overview.analytics.reputationAttention;
    case "critical":
      return t.overview.analytics.reputationCritical;
    default:
      return t.overview.analytics.reputationHealthy;
  }
}

export function reputationDescription(t: ReturnType<typeof useI18n>, status: OverviewReputationStatus) {
  switch (status) {
    case "healthy":
      return t.overview.analytics.reputationHealthyDescription;
    case "attention":
      return t.overview.analytics.reputationAttentionDescription;
    case "critical":
      return t.overview.analytics.reputationCriticalDescription;
    default:
      return t.overview.analytics.reputationHealthyDescription;
  }
}
