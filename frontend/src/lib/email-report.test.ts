import { describe, expect, it } from "vitest";
import {
  buildEmailReport,
  emailReportToCsv,
  emailReportToJson,
  emailReportToPdf,
} from "@/lib/email-report";
import type { EmailEvent } from "@/lib/supabase/types";

function createEvent(overrides: Partial<EmailEvent>): EmailEvent {
  return {
    id: "event-1",
    messageId: "message-1",
    snsMessageId: "",
    recipientEmail: "ana@example.com",
    eventType: "sent",
    occurredAt: "2026-07-20T10:00:00.000Z",
    subject: "Assunto",
    originApp: "",
    smtpIdentity: "",
    senderEmail: "",
    fromAddress: "",
    sourceIp: "",
    callerIdentity: "",
    configurationSet: "",
    projectTag: "",
    deliveryStatus: "",
    deliveryProcessingTimeMillis: null,
    failureReason: "",
    bounceDiagnosis: null,
    recipientInfo: {},
    bounceDetails: {},
    complaintDetails: {},
    deliveryDetails: {},
    delayDetails: {},
    rejectionDetails: {},
    renderingFailureDetails: {},
    rawPayload: {},
    metadata: {},
    ...overrides,
  };
}

describe("email report", () => {
  const events = [
    createEvent({
      id: "event-1",
      recipientEmail: "ANA@example.com",
      originApp: "billing",
      senderEmail: "finance@example.org",
    }),
    createEvent({
      id: "event-2",
      messageId: "message-2",
      recipientEmail: "ana@example.com",
      eventType: "bounced",
      occurredAt: "2026-07-20T10:05:00.000Z",
      bounceDiagnosis: {
        cause: "Caixa postal cheia",
        recommendation: "Tentar novamente depois.",
        severity: "medium",
        category: "Caixa cheia",
      },
    }),
    createEvent({
      id: "event-3",
      messageId: "message-3",
      recipientEmail: "bruno@example.net",
      eventType: "delayed",
      occurredAt: "2026-07-20T11:00:00.000Z",
      smtpIdentity: "mailer",
      subject: 'Cotação "especial"',
    }),
  ];

  it("groups every query event by normalized recipient and keeps diagnosis and origin details", () => {
    const report = buildEmailReport(events, {
      language: "pt-BR",
      generatedAt: "2026-07-27T12:00:00.000Z",
      query: { status: "all", page: "" },
    });

    expect(report.summary).toEqual({
      totalEvents: 3,
      uniqueMessages: 3,
      uniqueRecipients: 2,
    });
    expect(report.query).toEqual({ status: "all" });
    expect(report.recipients[0]).toMatchObject({
      email: "ana@example.com",
      domain: "example.com",
      totalEvents: 2,
      uniqueMessages: 2,
      possibleReasons: ["Caixa postal cheia"],
      recommendations: ["Tentar novamente depois."],
    });
    expect(report.recipients[0]?.origins).toContain("Aplicação: billing");
    expect(report.recipients[0]?.eventCounts).toMatchObject({ sent: 1, bounced: 1 });
    expect(report.recipients[1]?.possibleReasons).toEqual(["A entrega sofreu um atraso temporário."]);
  });

  it("sorts recipients by criticality, total events, recent activity, complaints, domain and problem rate", () => {
    const sortEvents = [
      createEvent({ id: "e1", recipientEmail: "ana@example.com", eventType: "sent", occurredAt: "2026-07-20T10:00:00.000Z" }),
      createEvent({ id: "e2", recipientEmail: "ana@example.com", eventType: "bounced", occurredAt: "2026-07-20T10:05:00.000Z" }),
      createEvent({ id: "e3", recipientEmail: "bruno@example.net", eventType: "bounced", occurredAt: "2026-07-20T09:00:00.000Z" }),
      createEvent({ id: "e4", recipientEmail: "bruno@example.net", eventType: "bounced", occurredAt: "2026-07-20T09:05:00.000Z" }),
      createEvent({ id: "e5", recipientEmail: "bruno@example.net", eventType: "complained", occurredAt: "2026-07-20T09:10:00.000Z" }),
      createEvent({ id: "e6", recipientEmail: "carla@zzz.example", eventType: "sent", occurredAt: "2026-07-20T12:00:00.000Z" }),
    ];

    const build = (sortBy: Parameters<typeof buildEmailReport>[1]["sortBy"]) =>
      buildEmailReport(sortEvents, { language: "pt-BR", generatedAt: "2026-07-27T12:00:00.000Z", sortBy }).recipients.map(
        (recipient) => recipient.email,
      );

    expect(build("criticality")).toEqual(["bruno@example.net", "ana@example.com", "carla@zzz.example"]);
    expect(build("totalEvents")).toEqual(["bruno@example.net", "ana@example.com", "carla@zzz.example"]);
    expect(build("recentActivity")).toEqual(["carla@zzz.example", "ana@example.com", "bruno@example.net"]);
    expect(build("complaints")).toEqual(["bruno@example.net", "ana@example.com", "carla@zzz.example"]);
    expect(build("domain")).toEqual(["ana@example.com", "bruno@example.net", "carla@zzz.example"]);
    expect(build("problemRate")).toEqual(["bruno@example.net", "ana@example.com", "carla@zzz.example"]);
  });

  it("exports CSV and JSON with the grouped recipients", () => {
    const report = buildEmailReport(events, {
      language: "pt-BR",
      generatedAt: "2026-07-27T12:00:00.000Z",
    });
    const csv = emailReportToCsv(report);
    const json = JSON.parse(emailReportToJson(report)) as typeof report;

    expect(csv).toContain('"Email";"Domínio";"Total de eventos"');
    expect(csv).toContain('"Cotação ""especial"""');
    expect(json.recipients).toHaveLength(2);
  });

  it("creates a directly downloadable PDF document", async () => {
    const report = buildEmailReport(events, {
      language: "pt-BR",
      generatedAt: "2026-07-27T12:00:00.000Z",
    });
    const pdf = emailReportToPdf(report);
    const header = new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 8));

    expect(pdf.type).toBe("application/pdf");
    expect(header).toBe("%PDF-1.4");
  });
});
