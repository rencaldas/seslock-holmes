import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Pause, Pencil, Play, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { describeFrequency } from "@/lib/scheduled-reports/frequency";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  runScheduleNow,
  setScheduleActive,
  updateSchedule,
} from "@/lib/scheduled-reports/queries";
import type { ReportSchedule, ScheduleInput } from "@/lib/scheduled-reports/types";
import { SetupPanel } from "@/features/scheduled-reports/setup-panel";
import { ScheduleForm } from "@/features/scheduled-reports/schedule-form";
import { ScheduleHistory } from "@/features/scheduled-reports/schedule-history";

function describeFilters(schedule: ReportSchedule, windowLabel: string) {
  const parts = [`${schedule.filters.windowDays}d`, schedule.filters.status];
  if (schedule.filters.subject) parts.push(`"${schedule.filters.subject}"`);
  if (schedule.filters.origin) parts.push(schedule.filters.origin);
  if (schedule.filters.provider) parts.push(`@${schedule.filters.provider}`);
  parts.push(`${windowLabel}: ${schedule.filters.rowLimit}`);
  return parts.join(" · ");
}

export function ScheduledReportsPage() {
  const t = useI18n();
  const list = t.scheduledReports.list;
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReportSchedule | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [runNowFeedback, setRunNowFeedback] = useState<
    Record<string, { status: "success" } | { status: "error"; message: string }>
  >({});

  const schedulesQuery = useQuery({
    queryKey: ["scheduled-reports", supabase.eventsTable],
    enabled: Boolean(supabase.client),
    queryFn: () => listSchedules(supabase.client!),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
  }

  const createMutation = useMutation({
    mutationFn: (input: ScheduleInput) => createSchedule(supabase.client!, input),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ScheduleInput }) => updateSchedule(supabase.client!, id, input),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(supabase.client!, id),
    onSuccess: invalidate,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setScheduleActive(supabase.client!, id, isActive),
    onSuccess: invalidate,
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => runScheduleNow(id),
    onMutate: (id) => {
      setRunNowFeedback((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
    },
    onSuccess: (_data, id) => {
      setRunNowFeedback((current) => ({ ...current, [id]: { status: "success" } }));
      invalidate();
    },
    onError: (error, id) => {
      const message = error instanceof Error ? error.message : list.forceRunError;
      setRunNowFeedback((current) => ({ ...current, [id]: { status: "error", message } }));
    },
  });

  if (!supabase.ready || !supabase.client) {
    return <LoadingState />;
  }

  const schedules = schedulesQuery.data ?? [];
  const tableUnavailable = schedulesQuery.isError && (schedulesQuery.error as { code?: string })?.code === "42P01";

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t.scheduledReports.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-ink-muted">{t.scheduledReports.subtitle}</p>
      </section>

      <SetupPanel collapsedByDefault={!tableUnavailable && schedules.length > 0} />

      {!tableUnavailable ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">{list.nameHeader}</h2>
            {!formOpen ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                {t.scheduledReports.newButton}
              </Button>
            ) : null}
          </div>

          {formOpen ? (
            <ScheduleForm
              initial={editing ?? undefined}
              eventsTable={supabase.eventsTable ?? "aws_sns"}
              isSubmitting={createMutation.isPending || updateMutation.isPending}
              onCancel={() => {
                setFormOpen(false);
                setEditing(null);
              }}
              onSubmit={async (input) => {
                if (editing) {
                  await updateMutation.mutateAsync({ id: editing.id, input });
                } else {
                  await createMutation.mutateAsync(input);
                }
              }}
            />
          ) : null}

          {schedulesQuery.isLoading ? <LoadingState /> : null}

          {schedulesQuery.isError && !tableUnavailable ? (
            <ErrorState
              description={schedulesQuery.error instanceof Error ? schedulesQuery.error.message : t.common.noAvailableData}
              onRetry={() => schedulesQuery.refetch()}
            />
          ) : null}

          {!schedulesQuery.isLoading && !schedules.length && !formOpen ? (
            <EmptyState title={t.scheduledReports.emptyTitle} description={t.scheduledReports.emptyDescription} />
          ) : null}

          {schedules.length ? (
            <div className="overflow-x-auto rounded-panel border border-slate-200 dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{list.nameHeader}</TableHead>
                    <TableHead>{list.frequencyHeader}</TableHead>
                    <TableHead>{list.filtersHeader}</TableHead>
                    <TableHead>{list.recipientsHeader}</TableHead>
                    <TableHead>{list.nextRunHeader}</TableHead>
                    <TableHead>{list.lastRunHeader}</TableHead>
                    <TableHead>{list.actionsHeader}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-semibold">
                        {schedule.name}
                        <div className="mt-1">
                          <Badge tone={schedule.isActive ? "success" : "muted"}>
                            {schedule.isActive ? list.active : list.paused}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{describeFrequency(schedule.frequency, t)}</TableCell>
                      <TableCell className="max-w-xs text-xs text-ink-muted">
                        {describeFilters(schedule, t.overview.filters.rows)}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs">{schedule.recipients.join(", ")}</TableCell>
                      <TableCell className="text-xs">{new Date(schedule.nextRunAt).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">
                        {schedule.lastRunAt ? (
                          <Badge tone={schedule.lastRunStatus === "success" ? "success" : "destructive"}>
                            {schedule.lastRunStatus === "success" ? list.lastRunSuccess : list.lastRunError}
                          </Badge>
                        ) : (
                          list.lastRunNever
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditing(schedule);
                              setFormOpen(true);
                            }}
                            aria-label={list.edit}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => toggleActiveMutation.mutate({ id: schedule.id, isActive: !schedule.isActive })}
                            aria-label={schedule.isActive ? list.pause : list.resume}
                          >
                            {schedule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setHistoryId((current) => (current === schedule.id ? null : schedule.id))}
                            aria-label={list.viewHistory}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={runNowMutation.isPending && runNowMutation.variables === schedule.id}
                            onClick={() => {
                              if (window.confirm(list.forceRunConfirm)) {
                                runNowMutation.mutate(schedule.id);
                              }
                            }}
                            aria-label={list.forceRun}
                            title={list.forceRun}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(list.confirmDelete)) {
                                deleteMutation.mutate(schedule.id);
                              }
                            }}
                            aria-label={list.delete}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        </div>
                        {runNowFeedback[schedule.id] ? (
                          <p
                            className={`mt-1 max-w-xs text-xs ${runNowFeedback[schedule.id]!.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-danger"}`}
                          >
                            {runNowFeedback[schedule.id]!.status === "success"
                              ? list.forceRunSuccess
                              : `${list.forceRunError} ${(runNowFeedback[schedule.id] as { message: string }).message}`}
                          </p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {historyId ? (
            <ScheduleHistory
              scheduleId={historyId}
              scheduleName={schedules.find((schedule) => schedule.id === historyId)?.name ?? ""}
              onClose={() => setHistoryId(null)}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
