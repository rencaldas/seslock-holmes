import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const { buildReportForSchedule, sendReportEmail, recordScheduleRun, recordLastRunOnly, maybeSingle } = vi.hoisted(() => ({
  buildReportForSchedule: vi.fn(),
  sendReportEmail: vi.fn(),
  recordScheduleRun: vi.fn(),
  recordLastRunOnly: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("../src/lib/scheduled-reports/report-runner.js", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  GMAIL_USER: "reports@example.com",
  GMAIL_APP_PASSWORD: "app-password",
  GMAIL_FROM_NAME: "Seslock Holmes",
  readEnv: (...keys: string[]) => {
    for (const key of keys) {
      const value = process.env[key];
      if (value) return value;
    }
    return null;
  },
  buildReportForSchedule,
  sendReportEmail,
  recordScheduleRun,
  recordLastRunOnly,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }),
}));

import handler from "./run-schedule-now";

function createRequest(init: { headers?: Record<string, string>; body?: unknown } = {}): VercelRequest {
  return {
    method: "POST",
    headers: init.headers ?? {},
    body: init.body ?? { scheduleId: "schedule-1" },
  } as unknown as VercelRequest;
}

function createResponse() {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    headersSent: false,
    status(code: number) {
      response.statusCode = code;
      return response as unknown as VercelResponse;
    },
    json(payload: unknown) {
      response.body = payload;
      return response as unknown as VercelResponse;
    },
  };
  return response;
}

describe("run-schedule-now handler", () => {
  const originalAdminToken = process.env.ADMIN_API_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_API_TOKEN = "correct-token";
  });

  afterEach(() => {
    if (originalAdminToken === undefined) delete process.env.ADMIN_API_TOKEN;
    else process.env.ADMIN_API_TOKEN = originalAdminToken;
  });

  it("rejects a request with no Authorization header", async () => {
    const response = createResponse();

    await handler(createRequest(), response as unknown as VercelResponse);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(sendReportEmail).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong token", async () => {
    const response = createResponse();

    await handler(
      createRequest({ headers: { authorization: "Bearer wrong-token" } }),
      response as unknown as VercelResponse,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(sendReportEmail).not.toHaveBeenCalled();
  });

  it("runs the schedule and sends the report when the token is correct", async () => {
    const schedule = { id: "schedule-1", recipients: ["client@example.com"] };
    const report = { summary: { totalEvents: 3 } };
    maybeSingle.mockResolvedValue({ data: schedule, error: null });
    buildReportForSchedule.mockResolvedValue(report);
    sendReportEmail.mockResolvedValue(undefined);
    recordScheduleRun.mockResolvedValue(undefined);
    recordLastRunOnly.mockResolvedValue(undefined);

    const response = createResponse();

    await handler(
      createRequest({ headers: { authorization: "Bearer correct-token" } }),
      response as unknown as VercelResponse,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: "success" });
    expect(buildReportForSchedule).toHaveBeenCalledWith(expect.anything(), schedule);
    expect(sendReportEmail).toHaveBeenCalledWith(schedule, report, expect.any(Object), { forced: true });
    expect(recordScheduleRun).toHaveBeenCalledWith(expect.anything(), schedule, "success", report, undefined);
    expect(recordLastRunOnly).toHaveBeenCalledWith(expect.anything(), schedule.id, "success", undefined);
  });
});
