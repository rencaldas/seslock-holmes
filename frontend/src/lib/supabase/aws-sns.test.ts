import { describe, expect, it } from "vitest";
import type { EmailEventRow } from "@/lib/supabase/types";
import { rowMatchesBounceDiagnostic, rowMatchesRecipientDomain, rowToEmailEvent } from "./aws-sns";

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
    const row = makeRow(["guest@example.com"]);

    expect(rowMatchesRecipientDomain(row, "@example.com")).toBe(true);
    expect(rowMatchesRecipientDomain(row, "example.com")).toBe(true);
  });

  it("does not match other domains", () => {
    const row = makeRow(["guest@example.com"]);

    expect(rowMatchesRecipientDomain(row, "@other.com")).toBe(false);
  });
});

describe("bounce diagnostics mapping", () => {
  it("does not classify a normal delivery smtp response as a bounce diagnosis", () => {
    const row = makeRow(["guest@example.com"]);
    row.smtpResponse = "250 2.0.0 OK";

    expect(rowToEmailEvent(row).bounceDiagnosis).toBeNull();
  });

  it("matches diagnostic searches against technical and human-readable bounce text", () => {
    const row = makeRow(["guest@example.com"]);
    row.eventType = "Bounce";
    row.notificationType = "Bounce";
    row.bounceType = "Permanent";
    row.diagnosticCode = "smtp; 550 Invalid recipient: <guest@example.com>";

    expect(rowMatchesBounceDiagnostic(row, "invalid recipient")).toBe(true);
    expect(rowMatchesBounceDiagnostic(row, "endereco inexistente")).toBe(true);
  });
});
