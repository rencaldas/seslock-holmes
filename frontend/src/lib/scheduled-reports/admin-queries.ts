// Client-side counterpart to queries.ts, used only when the browser is
// pointed at THIS deployment's own default Supabase project (i.e. nobody
// overrode Settings with their own project). That project's report_schedules
// table now denies the anon role entirely (see
// supabase/migrations/20260730140000_lock_default_report_schedules.sql), so
// every read/write goes through the admin-gated /api/schedules endpoint
// instead of a direct supabase-js call — see api/schedules.ts for the
// server-side half of this and why it exists.
//
// A visitor's OWN registered Supabase project never goes through here: it
// keeps using queries.ts directly, with their own anon key, since it's their
// own data and their own project's RLS to manage.

import type { ReportSchedule, ReportScheduleRun, ScheduleInput } from "@/lib/scheduled-reports/types";

interface ScheduleRow {
  id: string;
  name: string;
  is_active: boolean;
  events_table: string;
  filters: ReportSchedule["filters"];
  recipients: string[];
  frequency: ReportSchedule["frequency"];
  timezone: string;
  next_run_at: string;
  last_run_at: string | null;
  last_run_status: "success" | "error" | null;
  last_run_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduleRunRow {
  id: string;
  schedule_id: string;
  generated_at: string;
  status: "success" | "error";
  error_message: string | null;
  report: ReportScheduleRun["report"];
  recipients_sent: string[] | null;
}

function rowToSchedule(row: ScheduleRow): ReportSchedule {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    eventsTable: row.events_table,
    filters: row.filters,
    recipients: row.recipients,
    frequency: row.frequency,
    timezone: row.timezone,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    lastRunError: row.last_run_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRun(row: ScheduleRunRow): ReportScheduleRun {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    generatedAt: row.generated_at,
    status: row.status,
    errorMessage: row.error_message,
    report: row.report,
    recipientsSent: row.recipients_sent,
  };
}

export class AdminApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function adminFetch(adminToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    throw new AdminApiError(
      (body?.error as string | undefined) || `HTTP ${response.status}`,
      response.status,
      body?.code as string | undefined,
    );
  }

  return body;
}

// PostgREST error code for "relation does not exist" — surfaced when the
// scheduled-reports migration hasn't been run yet on this Supabase project.
const UNDEFINED_TABLE_ERROR_CODE = "42P01";

export async function adminCheckScheduledReportsConfigured(adminToken: string): Promise<boolean> {
  try {
    await adminFetch(adminToken, "/api/schedules");
    return true;
  } catch (error) {
    if (error instanceof AdminApiError && error.code === UNDEFINED_TABLE_ERROR_CODE) {
      return false;
    }
    throw error;
  }
}

export async function adminListSchedules(adminToken: string): Promise<ReportSchedule[]> {
  const body = await adminFetch(adminToken, "/api/schedules");
  return ((body?.schedules ?? []) as ScheduleRow[]).map(rowToSchedule);
}

function scheduleInputToBody(input: ScheduleInput) {
  return {
    name: input.name,
    eventsTable: input.eventsTable,
    filters: input.filters,
    recipients: input.recipients,
    frequency: input.frequency,
    timezone: input.timezone,
    isActive: input.isActive,
  };
}

export async function adminCreateSchedule(adminToken: string, input: ScheduleInput): Promise<ReportSchedule> {
  const body = await adminFetch(adminToken, "/api/schedules", {
    method: "POST",
    body: JSON.stringify(scheduleInputToBody(input)),
  });
  return rowToSchedule(body?.schedule as ScheduleRow);
}

export async function adminUpdateSchedule(adminToken: string, id: string, input: ScheduleInput): Promise<ReportSchedule> {
  const body = await adminFetch(adminToken, `/api/schedules?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(scheduleInputToBody(input)),
  });
  return rowToSchedule(body?.schedule as ScheduleRow);
}

export async function adminDeleteSchedule(adminToken: string, id: string): Promise<void> {
  await adminFetch(adminToken, `/api/schedules?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function adminSetScheduleActive(adminToken: string, id: string, isActive: boolean): Promise<ReportSchedule> {
  const body = await adminFetch(adminToken, `/api/schedules?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
  return rowToSchedule(body?.schedule as ScheduleRow);
}

export async function adminListRunsForSchedule(adminToken: string, scheduleId: string): Promise<ReportScheduleRun[]> {
  const body = await adminFetch(adminToken, `/api/schedules?historyOf=${encodeURIComponent(scheduleId)}`);
  return ((body?.runs ?? []) as ScheduleRunRow[]).map(rowToRun);
}
