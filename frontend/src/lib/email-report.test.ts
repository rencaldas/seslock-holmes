import { describe, expect, it } from "vitest";
import {
  buildEmailReport,
  createEmailReportFilename,
  emailReportToCsv,
  emailReportToJson,
  emailReportToPdf,
  getRecipientSituation,
  recipientSituationLabel,
  summarizeEmailReportRates,
  type EmailReportRecipient,
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

  it("classifies subjects into business categories with subject and unique-recipient counts", () => {
    const categoryEvents = [
      createEvent({ id: "c1", recipientEmail: "a@example.com", subject: "Promoção especial de fim de ano" }),
      createEvent({ id: "c2", recipientEmail: "b@example.com", subject: "Promoção especial de fim de ano" }),
      createEvent({ id: "c3", recipientEmail: "a@example.com", subject: "NF-e referente ao pedido 4521" }),
      createEvent({ id: "c4", recipientEmail: "a@example.com", subject: "Pedido via site www.ramada.com.br" }),
      createEvent({ id: "c5", recipientEmail: "b@example.com", subject: "Boleto referente ao pedido 991" }),
      createEvent({ id: "c6", recipientEmail: "c@example.com", subject: "Assunto sem categoria conhecida" }),
    ];

    const report = buildEmailReport(categoryEvents, {
      language: "pt-BR",
      generatedAt: "2026-07-27T12:00:00.000Z",
    });

    expect(report.categories).toEqual([
      { category: "Marketing / oportunidades de compra", subjectCount: 2, uniqueRecipients: 2 },
      { category: "Emissão de NF-e", subjectCount: 1, uniqueRecipients: 1 },
      { category: "Outros", subjectCount: 1, uniqueRecipients: 1 },
      { category: "Pedido de venda (inclui boleto+pedido)", subjectCount: 1, uniqueRecipients: 1 },
      { category: "Pedido via site (www.ramada.com.br)", subjectCount: 1, uniqueRecipients: 1 },
    ]);
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
    const bytes = await pdf.arrayBuffer();
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    const body = new TextDecoder("latin1").decode(bytes);

    expect(pdf.type).toBe("application/pdf");
    expect(header).toBe("%PDF-1.4");
    expect(body).toContain("Seslock Holmes");
    expect(body).toContain("Categoria");
    expect(body).toContain("Cotação");
  });

  it("names the exported file using Brasília date and time, regardless of the input's timezone", () => {
    expect(createEmailReportFilename("pdf", "2026-07-27T12:00:00.000Z")).toBe(
      "relatorio-emails-27-07-2026_09-00-00.pdf",
    );
    expect(createEmailReportFilename("csv", "2026-01-01T02:00:00.000Z")).toBe(
      "relatorio-emails-31-12-2025_23-00-00.csv",
    );
  });

  it("adds a 'simplificado' infix to the filename in simplified mode, without disturbing the full-mode name", () => {
    expect(createEmailReportFilename("csv", "2026-07-27T12:00:00.000Z", "simplified")).toBe(
      "relatorio-emails-simplificado-27-07-2026_09-00-00.csv",
    );
    expect(createEmailReportFilename("pdf", "2026-07-27T12:00:00.000Z", "full")).toBe(
      "relatorio-emails-27-07-2026_09-00-00.pdf",
    );
  });

  it("exports a simplified CSV with only the columns relevant for validation", () => {
    const report = buildEmailReport(events, {
      language: "pt-BR",
      generatedAt: "2026-07-27T12:00:00.000Z",
    });
    const csv = emailReportToCsv(report, "simplified");

    expect(csv).toContain(
      '"Email";"Assuntos";"Quantidade de eventos";"Primeiro envio";"Último envio";"Situação"',
    );
    expect(csv).not.toContain("Domínio");
    expect(csv).not.toContain("Configuration set");
    expect(csv).not.toContain("Possíveis motivos");
    expect(csv).not.toContain("Recomendações");
    // 2026-07-20T10:00:00.000Z é 07:00 em America/Sao_Paulo, ainda dia 20.
    expect(csv).toContain("20/07/26");
  });

  it("repeats the simplified table header when recipients overflow onto a new PDF page", async () => {
    const manyEvents: EmailEvent[] = Array.from({ length: 60 }, (_, index) =>
      createEvent({
        id: `bulk-${index}`,
        messageId: `bulk-message-${index}`,
        recipientEmail: `cliente${index}@example.com`,
        subject: `Assunto de teste número ${index}`,
      }),
    );
    const report = buildEmailReport(manyEvents, { language: "pt-BR", generatedAt: "2026-07-27T12:00:00.000Z" });
    const pdf = emailReportToPdf(report, "simplified");
    const bytes = await pdf.arrayBuffer();
    const body = new TextDecoder("latin1").decode(bytes);

    // /Count N no objeto /Pages diz quantas páginas o PDF tem — mais de uma
    // confirma que a quebra de página aconteceu de fato com 60 destinatários.
    const pageCount = Number(body.match(/\/Count (\d+)/)?.[1]);
    expect(pageCount).toBeGreaterThan(1);
    // O cabeçalho da tabela precisa se repetir em toda página nova, não só na
    // primeira — senão a partir da segunda página ninguém sabe o que cada
    // coluna significa.
    const emailHeaderOccurrences = body.split("(Email)").length - 1;
    expect(emailHeaderOccurrences).toBe(pageCount);
  });

  it("creates a simplified PDF as a compact table, without the full mode's technical fields", async () => {
    const report = buildEmailReport(events, {
      language: "pt-BR",
      generatedAt: "2026-07-27T12:00:00.000Z",
    });
    const pdf = emailReportToPdf(report, "simplified");
    const bytes = await pdf.arrayBuffer();
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    const body = new TextDecoder("latin1").decode(bytes);

    expect(pdf.type).toBe("application/pdf");
    expect(header).toBe("%PDF-1.4");
    expect(body).toContain("Situação");
    expect(body).not.toContain("Possíveis motivos");
    expect(body).not.toContain("Recomendações");
    expect(body).not.toContain("Origem");
  });

  it("summarizes rates without NaN when the report has no events", () => {
    const report = buildEmailReport([], { language: "pt-BR", generatedAt: "2026-07-27T12:00:00.000Z" });
    expect(summarizeEmailReportRates(report)).toEqual({
      sentCount: 0,
      deliveredCount: 0,
      bouncedCount: 0,
      complaintCount: 0,
      totalCount: 0,
      deliveryRate: null,
      bounceRate: 0,
      complaintRate: 0,
    });
  });

  it("computes rates using the same formulas as the overview dashboard", () => {
    const rateEvents = [
      createEvent({ id: "r1", eventType: "sent", recipientEmail: "a@example.com" }),
      createEvent({ id: "r2", eventType: "delivered", recipientEmail: "a@example.com" }),
      createEvent({ id: "r3", eventType: "bounced", recipientEmail: "b@example.com" }),
      createEvent({ id: "r4", eventType: "complained", recipientEmail: "c@example.com" }),
    ];
    const report = buildEmailReport(rateEvents, { language: "pt-BR", generatedAt: "2026-07-27T12:00:00.000Z" });
    const rates = summarizeEmailReportRates(report);

    expect(rates.totalCount).toBe(4);
    expect(rates.deliveryRate).toBe(100);
    expect(rates.bounceRate).toBe(25);
    expect(rates.complaintRate).toBe(25);
  });
});

function createRecipient(counts: Partial<EmailReportRecipient["eventCounts"]>): EmailReportRecipient {
  return {
    email: "cliente@example.com",
    domain: "example.com",
    totalEvents: 0,
    uniqueMessages: 0,
    firstEventAt: "2026-08-01T00:00:00.000Z",
    lastEventAt: "2026-08-01T00:00:00.000Z",
    eventCounts: {
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      delayed: 0,
      rejected: 0,
      rendering_failure: 0,
      ...counts,
    },
    origins: [],
    possibleReasons: [],
    recommendations: [],
    subjects: [],
  };
}

describe("getRecipientSituation", () => {
  it("prioritizes a complaint over any other signal", () => {
    expect(getRecipientSituation(createRecipient({ complained: 1, bounced: 3, delivered: 2 }))).toBe("complained");
  });

  it("reports a full failure as not received when nothing was delivered", () => {
    expect(getRecipientSituation(createRecipient({ bounced: 2 }))).toBe("notReceived");
  });

  it("reports a mix of failure and delivery as partially received", () => {
    expect(getRecipientSituation(createRecipient({ bounced: 1, delivered: 1 }))).toBe("partiallyReceived");
  });

  it("treats a delay as resolved once the message was actually delivered", () => {
    expect(getRecipientSituation(createRecipient({ delayed: 1, delivered: 1 }))).toBe("received");
  });

  it("keeps a pure delay as delayed when nothing was delivered", () => {
    expect(getRecipientSituation(createRecipient({ delayed: 1 }))).toBe("delayed");
  });

  it("falls back to sent-only and unknown when there is nothing else to go on", () => {
    expect(getRecipientSituation(createRecipient({ sent: 1 }))).toBe("sentOnly");
    expect(getRecipientSituation(createRecipient({}))).toBe("unknown");
  });

  it("labels situations in plain language, in both supported languages", () => {
    const recipient = createRecipient({ delivered: 1 });
    expect(recipientSituationLabel(recipient, "pt-BR")).toBe("Recebeu normalmente");
    expect(recipientSituationLabel(recipient, "en-US")).toBe("Received normally");
  });
});
