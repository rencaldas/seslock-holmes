import type { OverviewAnalytics } from "@/lib/overview/analytics";
import type { BounceDiagnosis } from "@/lib/supabase/bounce-diagnostics";

export type EmailEventType =
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "delayed"
  | "rejected"
  | "rendering_failure";

export interface EmailEventRow {
  id: string;
  created_at: string | null;
  timestamp: string | null;
  messageId: string | null;
  snsMessageId?: string | null;
  eventType: string | null;
  notificationType: string | null;
  subject: string | null;
  source: string | null;
  fromAddress?: string | null;
  sourceIp?: string | null;
  callerIdentity?: string | null;
  configurationSet?: string | null;
  projectTag?: string | null;
  sourceArn: string | null;
  snsTopicArn: string | null;
  sesTags: Record<string, unknown> | null;
  destination: unknown;
  destinations?: unknown;
  bounceType: string | null;
  bounceSubType: string | null;
  bouncedRecipients: unknown;
  diagnosticCode: string | null;
  remoteMtaIp: string | null;
  reportingMta: string | null;
  smtpResponse: string | null;
  deliveryProcessingTimeMillis?: number | string | null;
  complaintFeedbackType: string | null;
  complainedRecipients: unknown;
  userAgent: string | null;
  raw_payload?: unknown;
  rawPayload?: unknown;
}

export interface EmailEvent {
  id: string;
  messageId: string;
  snsMessageId: string;
  recipientEmail: string;
  eventType: EmailEventType;
  occurredAt: string;
  subject: string;
  originApp: string;
  smtpIdentity: string;
  senderEmail: string;
  fromAddress: string;
  sourceIp: string;
  callerIdentity: string;
  configurationSet: string;
  projectTag: string;
  deliveryStatus: string;
  deliveryProcessingTimeMillis: number | null;
  failureReason: string;
  bounceDiagnosis: BounceDiagnosis | null;
  recipientInfo: Record<string, unknown>;
  bounceDetails: Record<string, unknown>;
  complaintDetails: Record<string, unknown>;
  deliveryDetails: Record<string, unknown>;
  delayDetails: Record<string, unknown>;
  rejectionDetails: Record<string, unknown>;
  renderingFailureDetails: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface RecipientInvestigationResult {
  recipientEmail: string;
  searchText: string;
  searchMode: RecipientSearchMode;
  totalCount: number;
  latestEventAt: string | null;
  hasProblemActivity: boolean;
  hasMore: boolean;
  page: number;
  pageSize: number;
  events: EmailEvent[];
  relatedEmails: Array<{
    email: string;
    count: number;
  }>;
}

export interface OverviewResult {
  recentEvents: EmailEvent[];
  recentEventsCount: number;
  uniqueMessagesCount: number;
  uniqueRecipientsCount: number;
  deliveredCount: number;
  bouncedCount: number;
  complaintCount: number;
  problemEventsCount: number;
  bounceRate: number;
  topOrigins: Array<{ name: string; count: number }>;
  analytics: OverviewAnalytics;
  windowDays: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface MessageTraceResult {
  selectedEvent: EmailEvent | null;
  traceEvents: EmailEvent[];
}

export interface OverviewQueryInput {
  timeMode: TimeFilterMode;
  windowDays: number;
  startAt: string;
  endAt: string;
  recentActivitySort: RecentActivitySort;
  status: "all" | EmailEventType;
  origin: string;
  provider: string;
  page: number;
  pageSize: number;
}

export interface RecipientInvestigationQueryInput {
  searchText: string;
  searchMode: RecipientSearchMode;
  timeMode: TimeFilterMode;
  windowDays: number;
  startAt: string;
  endAt: string;
  status: "all" | EmailEventType;
  origin: string;
  page: number;
  pageSize: number;
}

export type RecipientSearchMode = "recipient" | "sender" | "origin" | "diagnostic";
export type TimeFilterMode = "window" | "custom";
export type RecentActivitySort = "time-desc" | "time-asc" | "recipient-asc" | "recipient-desc";

export interface MessageTraceQueryInput {
  eventId: string;
}

export const PROBLEM_EVENT_TYPES: EmailEventType[] = [
  "bounced",
  "complained",
  "delayed",
  "rejected",
  "rendering_failure",
];
