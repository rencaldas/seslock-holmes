import type { EmailEventType } from "@/lib/supabase/types";
import type { RowLimit } from "@/lib/row-limits";
import type { EmailReport, EmailReportSortBy } from "@/lib/email-report";

export const REPORT_SCHEDULES_TABLE = "report_schedules";
export const REPORT_SCHEDULE_RUNS_TABLE = "report_schedule_runs";

// Subset of OverviewFilterValues: deliberately excludes timeMode/startAt/endAt
// (absolute custom ranges) since a recurring schedule only makes sense with a
// relative window like "last 7 days", recomputed on every run.
export interface ScheduleFilters {
  windowDays: number;
  status: "all" | EmailEventType;
  origin: string;
  subject: string;
  provider: string;
  rowLimit: RowLimit;
  sortBy: EmailReportSortBy;
}

export type ScheduleFrequencyType = "daily" | "weekly" | "monthly";

export interface ScheduleFrequency {
  type: ScheduleFrequencyType;
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export interface ReportSchedule {
  id: string;
  name: string;
  isActive: boolean;
  eventsTable: string;
  filters: ScheduleFilters;
  recipients: string[];
  frequency: ScheduleFrequency;
  timezone: string;
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportScheduleRun {
  id: string;
  scheduleId: string;
  generatedAt: string;
  status: "success" | "error";
  errorMessage: string | null;
  report: EmailReport | null;
  recipientsSent: string[] | null;
}

export interface ScheduleInput {
  name: string;
  eventsTable: string;
  filters: ScheduleFilters;
  recipients: string[];
  frequency: ScheduleFrequency;
  timezone: string;
  isActive: boolean;
}
