import { describe, expect, it } from "vitest";
import type { EmailEventRow } from "@/lib/supabase/types";
import { rowMatchesRecipientDomain } from "./aws-sns";

function makeRow(destination: unknown): EmailEventRow {
  return {
    id: "1",
    created_at: "2026-07-01T00:00:00.000Z",
    timestamp: "2026-07-01T00:00:00.000Z",
    messageId: "message-1",
    snsMessageId: null,
    eventType: "delivered",
    notificationType: "Delivery",
    subject: null,
    source: null,
    fromAddress: null,
    sourceIp: null,
    callerIdentity: null,
    configurationSet: null,
    projectTag: null,
    sourceArn: null,
    snsTopicArn: null,
    sesTags: null,
    destination,
    destinations: null,
    bounceType: null,
    bounceSubType: null,
    bouncedRecipients: null,
    diagnosticCode: null,
    remoteMtaIp: null,
    reportingMta: null,
    smtpResponse: null,
    deliveryProcessingTimeMillis: null,
    complaintFeedbackType: null,
    complainedRecipients: null,
    userAgent: null,
  };
}

describe("rowMatchesRecipientDomain", () => {
  it("matches a provider domain with or without the leading at sign", () => {
    const row = makeRow(["guest@ramada.com.br"]);

    expect(rowMatchesRecipientDomain(row, "@ramada.com.br")).toBe(true);
    expect(rowMatchesRecipientDomain(row, "ramada.com.br")).toBe(true);
  });

  it("does not match other domains", () => {
    const row = makeRow(["guest@ramada.com.br"]);

    expect(rowMatchesRecipientDomain(row, "@other.com.br")).toBe(false);
  });
});
