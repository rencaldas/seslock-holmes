import { describe, expect, it } from "vitest";
import { buildOverviewAnalytics } from "./analytics";
import type { EmailEvent } from "@/lib/supabase/types";

function makeEvent(partial: Partial<EmailEvent> & Pick<EmailEvent, "id" | "eventType" | "occurredAt" | "messageId" | "recipientEmail">): EmailEvent {
  return {
    id: partial.id,
    messageId: partial.messageId,
    snsMessageId: partial.snsMessageId ?? partial.messageId,
    recipientEmail: partial.recipientEmail,
    eventType: partial.eventType,
    occurredAt: partial.occurredAt,
    subject: partial.subject ?? "",
    originApp: partial.originApp ?? "",
    smtpIdentity: partial.smtpIdentity ?? "",
    senderEmail: partial.senderEmail ?? "",
    fromAddress: partial.fromAddress ?? "",
    sourceIp: partial.sourceIp ?? "",
    callerIdentity: partial.callerIdentity ?? "",
    configurationSet: partial.configurationSet ?? "",
    projectTag: partial.projectTag ?? "",
    deliveryStatus: partial.deliveryStatus ?? partial.eventType,
    deliveryProcessingTimeMillis: partial.deliveryProcessingTimeMillis ?? null,
    failureReason: partial.failureReason ?? "",
    bounceDiagnosis: partial.bounceDiagnosis ?? null,
    recipientInfo: partial.recipientInfo ?? {},
    bounceDetails: partial.bounceDetails ?? {},
    complaintDetails: partial.complaintDetails ?? {},
    deliveryDetails: partial.deliveryDetails ?? {},
    delayDetails: partial.delayDetails ?? {},
    rejectionDetails: partial.rejectionDetails ?? {},
    renderingFailureDetails: partial.renderingFailureDetails ?? {},
    rawPayload: partial.rawPayload ?? {},
    metadata: partial.metadata ?? {},
  };
}

describe("buildOverviewAnalytics", () => {
  it("aggregates delivery, bounce and origin metrics", () => {
    const events = [
      makeEvent({
        id: "1",
        messageId: "message-1",
        recipientEmail: "a@example.com",
        eventType: "sent",
        occurredAt: "2026-07-01T10:00:00.000Z",
        originApp: "app-a",
      }),
      makeEvent({
        id: "2",
        messageId: "message-1",
        recipientEmail: "a@example.com",
        eventType: "delivered",
        occurredAt: "2026-07-01T10:01:00.000Z",
        originApp: "app-a",
      }),
      makeEvent({
        id: "3",
        messageId: "message-2",
        recipientEmail: "b@other.com",
        eventType: "bounced",
        occurredAt: "2026-07-01T11:00:00.000Z",
        originApp: "app-b",
        bounceDetails: { bounceType: "Permanent" },
        failureReason: "Mailbox full",
      }),
    ];

    const analytics = buildOverviewAnalytics(events, "en-US");

    expect(analytics.sentCount).toBe(1);
    expect(analytics.deliveredCount).toBe(1);
    expect(analytics.bouncedCount).toBe(1);
    expect(analytics.uniqueRecipientsCount).toBe(2);
    expect(analytics.topProviders).toHaveLength(2);
    expect(analytics.eventDistribution.find((item) => item.type === "sent")?.count).toBe(1);
    expect(analytics.eventDistribution.find((item) => item.type === "delivered")?.count).toBe(1);
    expect(analytics.eventDistribution.find((item) => item.type === "bounced")?.count).toBe(1);
    expect(analytics.reputation.status).toBe("critical");
  });
});
