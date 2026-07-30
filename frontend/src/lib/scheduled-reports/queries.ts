import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REPORT_SCHEDULES_TABLE,
  REPORT_SCHEDULE_RUNS_TABLE,
  type ReportSchedule,
  type ReportScheduleRun,
  type ScheduleInput,
} from "@/lib/scheduled-reports/types";

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

// PostgREST error code for "relation does not exist" — surfaced when the
// scheduled-reports migration hasn't been run yet on this Supabase project.
const UNDEFINED_TABLE_ERROR_CODE = "42P01";

export async function checkScheduledReportsConfigured(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from(REPORT_SCHEDULES_TABLE).select("id").limit(1);
  if (error) {
    if (error.code === UNDEFINED_TABLE_ERROR_CODE) {
      return false;
    }
    throw error;
  }
  return true;
}

export async function listSchedules(client: SupabaseClient): Promise<ReportSchedule[]> {
  const { data, error } = await client
    .from(REPORT_SCHEDULES_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as ScheduleRow[]).map(rowToSchedule);
}

function scheduleInputToRow(input: ScheduleInput) {
  return {
    name: input.name,
    events_table: input.eventsTable,
    filters: input.filters,
    recipients: input.recipients,
    frequency: input.frequency,
    timezone: input.timezone,
    is_active: input.isActive,
  };
}

export async function createSchedule(client: SupabaseClient, input: ScheduleInput): Promise<ReportSchedule> {
  const { data, error } = await client
    .from(REPORT_SCHEDULES_TABLE)
    .insert(scheduleInputToRow(input))
    .select("*")
    .single();

  if (error) throw error;
  return rowToSchedule(data as ScheduleRow);
}

export async function updateSchedule(client: SupabaseClient, id: string, input: ScheduleInput): Promise<ReportSchedule> {
  const { data, error } = await client
    .from(REPORT_SCHEDULES_TABLE)
    .update(scheduleInputToRow(input))
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return rowToSchedule(data as ScheduleRow);
}

export async function deleteSchedule(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from(REPORT_SCHEDULES_TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function setScheduleActive(client: SupabaseClient, id: string, isActive: boolean): Promise<ReportSchedule> {
  const { data, error } = await client
    .from(REPORT_SCHEDULES_TABLE)
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return rowToSchedule(data as ScheduleRow);
}

export async function listRunsForSchedule(client: SupabaseClient, scheduleId: string): Promise<ReportScheduleRun[]> {
  const { data, error } = await client
    .from(REPORT_SCHEDULE_RUNS_TABLE)
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("generated_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return ((data ?? []) as ScheduleRunRow[]).map(rowToRun);
}
