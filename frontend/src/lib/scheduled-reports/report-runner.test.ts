import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailReport, EmailReportRecipient } from "@/lib/email-report";
import type { EmailEventType } from "@/lib/supabase/types";

// nodemailer é mockado ANTES do import de report-runner.ts (via vi.hoisted),
// porque sendReportEmail chama nodemailer.createTransport(...).sendMail(...)
// de verdade — sem isso, os testes de anexo tentariam autenticar num Gmail
// real.
const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue(undefined);
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

const { fetchEventRowsWithTimeFallback } = vi.hoisted(() => ({ fetchEventRowsWithTimeFallback: vi.fn() }));

vi.mock("../supabase/queries/fetch-event-rows.js", () => ({
  EMAIL_EVENT_LIST_COLUMNS: "*",
  fetchEventRowsWithTimeFallback,
}));

import {
  buildEmailHtml,
  buildEmailText,
  buildReportForSchedule,
  sendReportEmail,
  type ReportScheduleRow,
} from "@/lib/scheduled-reports/report-runner";

function createRecipient(
  email: string,
  counts: Partial<Record<EmailEventType, number>>,
  overrides: Partial<EmailReportRecipient> = {},
): EmailReportRecipient {
  const eventCounts: Record<EmailEventType, number> = {
    sent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    delayed: 0,
    rejected: 0,
    rendering_failure: 0,
    ...counts,
  };
  const totalEvents = Object.values(eventCounts).reduce((sum, count) => sum + count, 0);

  return {
    email,
    domain: email.split("@")[1] ?? "",
    totalEvents,
    uniqueMessages: totalEvents,
    firstEventAt: "2026-08-01T12:00:00.000Z",
    lastEventAt: "2026-08-05T12:00:00.000Z",
    eventCounts,
    origins: [],
    possibleReasons: [],
    recommendations: [],
    subjects: ["Assunto de teste"],
    ...overrides,
  };
}

function createReport(recipients: EmailReportRecipient[]): EmailReport {
  const totalEvents = recipients.reduce((sum, recipient) => sum + recipient.totalEvents, 0);
  return {
    generatedAt: "2026-08-06T12:00:00.000Z",
    language: "pt-BR",
    query: {},
    summary: { totalEvents, uniqueMessages: totalEvents, uniqueRecipients: recipients.length },
    categories: [],
    recipients,
  };
}

function createSchedule(overrides: Partial<ReportScheduleRow> = {}): ReportScheduleRow {
  return {
    id: "schedule-1",
    name: "Clientes - validação",
    is_active: true,
    events_table: "email_events",
    filters: { windowDays: 7, status: "all", rowLimit: "all" },
    recipients: ["admin@example.com"],
    frequency: { type: "daily", time: "08:00" },
    timezone: "America/Sao_Paulo",
    next_run_at: "2026-08-06T11:00:00.000Z",
    ...overrides,
  };
}

describe("buildEmailHtml — saúde do envio", () => {
  it("marks the badge as Crítico when the bounce rate is above 5%", () => {
    const report = createReport([
      createRecipient("ok@example.com", { sent: 100 }),
      createRecipient("bad@example.com", { bounced: 10 }),
    ]);
    const html = buildEmailHtml(createSchedule(), report, false);
    expect(html).toContain("Crítico");
  });

  it("marks the badge as Atenção when the bounce rate is in the 2-5% zone", () => {
    const report = createReport([
      createRecipient("ok@example.com", { sent: 100 }),
      createRecipient("bad@example.com", { bounced: 3 }),
    ]);
    const html = buildEmailHtml(createSchedule(), report, false);
    expect(html).toContain("Atenção");
  });

  it("marks the badge as Saudável when both rates are within the healthy thresholds", () => {
    const report = createReport([createRecipient("ok@example.com", { sent: 1000, delivered: 1000 })]);
    const html = buildEmailHtml(createSchedule(), report, false);
    expect(html).toContain("Saudável");
  });

  it("flags Crítico from an isolated complaint rate above 0.3%, even with zero bounces", () => {
    const report = createReport([
      createRecipient("ok@example.com", { sent: 996 }),
      createRecipient("angry@example.com", { complained: 4 }),
    ]);
    const html = buildEmailHtml(createSchedule(), report, false);
    expect(html).toContain("Crítico");
  });
});

describe("buildEmailHtml/buildEmailText — destinatários que precisam de atenção", () => {
  it("lists problem recipients with their last event in dd/mm/aa", () => {
    const report = createReport([
      createRecipient("ok@example.com", { sent: 5, delivered: 5 }),
      createRecipient(
        "bad@example.com",
        { bounced: 2 },
        { lastEventAt: "2026-08-05T12:00:00.000Z" },
      ),
    ]);
    const schedule = createSchedule({ timezone: "America/Sao_Paulo" });

    const html = buildEmailHtml(schedule, report, false);
    const text = buildEmailText(schedule, report, false);

    expect(html).toContain("bad@example.com");
    expect(html).toContain("05/08/26");
    expect(text).toContain("bad@example.com");
    expect(text).toContain("05/08/26");
  });

  it("shows a positive note instead of an empty table when nobody has a problem", () => {
    const report = createReport([createRecipient("ok@example.com", { sent: 5, delivered: 5 })]);
    const schedule = createSchedule();

    const html = buildEmailHtml(schedule, report, false);
    const text = buildEmailText(schedule, report, false);

    expect(html).toContain("Nenhum destinatário com problema no período");
    expect(text).toContain("Nenhum destinatário com problema no período");
  });
});

describe("buildEmailText — nota de anexos por modo", () => {
  it("describes the attachments as completos by default", () => {
    const report = createReport([createRecipient("ok@example.com", { sent: 1, delivered: 1 })]);
    const text = buildEmailText(createSchedule(), report, false);
    expect(text).toContain("versão completa");
  });

  it("describes the attachments as simplificados when the mode is simplified", () => {
    const report = createReport([createRecipient("ok@example.com", { sent: 1, delivered: 1 })]);
    const text = buildEmailText(createSchedule(), report, false, "simplified");
    expect(text).toContain("versão simplificada");
  });
});

describe("sendReportEmail — anexos seguem o modo do agendamento", () => {
  it("attaches full-mode files when the schedule has no reportMode set", async () => {
    sendMail.mockClear();
    const report = createReport([createRecipient("ok@example.com", { sent: 1, delivered: 1 })]);
    const schedule = createSchedule({ filters: { windowDays: 7, status: "all", rowLimit: "all" } });

    await sendReportEmail(schedule, report, { gmailUser: "reports@example.com", gmailAppPassword: "app-password" });

    const call = sendMail.mock.calls[0]![0];
    expect(call.attachments[0].filename).not.toContain("simplificado");
    expect(call.attachments[1].filename).not.toContain("simplificado");
  });

  it("attaches simplified files when the schedule's reportMode is simplified", async () => {
    sendMail.mockClear();
    const report = createReport([createRecipient("ok@example.com", { sent: 1, delivered: 1 })]);
    const schedule = createSchedule({
      filters: { windowDays: 7, status: "all", rowLimit: "all", reportMode: "simplified" },
    });

    await sendReportEmail(schedule, report, { gmailUser: "reports@example.com", gmailAppPassword: "app-password" });

    const call = sendMail.mock.calls[0]![0];
    expect(call.attachments[0].filename).toContain("simplificado");
    expect(call.attachments[1].filename).toContain("simplificado");
  });
});

function createRpcClient(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(response);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const PERIOD_METRICS = { totalEventCount: 1000, deliveryRate: 96.5, bounceRate: 1.2, complaintRate: 0.05 };

describe("buildReportForSchedule — métricas do período ignoram os filtros", () => {
  beforeEach(() => {
    fetchEventRowsWithTimeFallback.mockReset().mockResolvedValue({ rows: [], truncated: false });
  });

  it("loads the period metrics without the schedule's filters", async () => {
    const { client, rpc } = createRpcClient({ data: PERIOD_METRICS, error: null });
    const schedule = createSchedule({ filters: { windowDays: 7, status: "bounced", origin: "app-x", rowLimit: "all" } });

    const report = await buildReportForSchedule(client, schedule);

    expect(rpc).toHaveBeenCalledWith(
      "overview_analytics",
      expect.objectContaining({ p_status: "all", p_origin: "", p_subject: "", p_provider: "" }),
    );
    expect(report.periodMetrics).toEqual({
      totalEvents: 1000,
      deliveryRate: 96.5,
      bounceRate: 1.2,
      complaintRate: 0.05,
    });
  });

  it("still builds the report when the period metrics cannot be loaded", async () => {
    const { client } = createRpcClient({ data: null, error: { message: "function does not exist" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const report = await buildReportForSchedule(client, createSchedule());

    expect(report.periodMetrics).toBeNull();
    expect(report.summary.totalEvents).toBe(0);
  });
});

describe("buildEmailHtml/buildEmailText — saúde do envio com filtro aplicado", () => {
  // Agendamento filtrado por Bounce: todos os eventos do relatório são
  // bounces, mas o selo tem que refletir o período inteiro.
  const bounceOnlySchedule = createSchedule({ filters: { windowDays: 7, status: "bounced", rowLimit: "all" } });
  const bounceOnlyReport = createReport([createRecipient("bad@example.com", { bounced: 10 })]);

  it("uses the unfiltered period metrics for the badge and rates, not the filtered events", () => {
    const report = {
      ...bounceOnlyReport,
      periodMetrics: { totalEvents: 1000, deliveryRate: 96.5, bounceRate: 1.2, complaintRate: 0.05 },
    };

    const html = buildEmailHtml(bounceOnlySchedule, report, false);
    const text = buildEmailText(bounceOnlySchedule, report, false);

    expect(html).toContain("Saúde do envio no período");
    expect(html).toContain("Saudável");
    expect(html).toContain("1,2%");
    expect(html).not.toContain("100,0%");
    expect(html).toContain("Resultado dos filtros");
    expect(text).toContain("Situação: Saudável");
    expect(text).toContain("não afetado pelos filtros do agendamento");
  });

  it("omits the health section instead of showing filtered rates when the period metrics are missing", () => {
    const report = { ...bounceOnlyReport, periodMetrics: null };

    const html = buildEmailHtml(bounceOnlySchedule, report, false);
    const text = buildEmailText(bounceOnlySchedule, report, false);

    expect(html).not.toContain("Saúde do envio no período");
    expect(html).not.toContain("Crítico");
    expect(text).not.toContain("SAÚDE DO ENVIO NO PERÍODO");
  });
});
