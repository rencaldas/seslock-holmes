import { useQuery } from "@tanstack/react-query";
import { FileJson, FileSpreadsheet, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { downloadBlob } from "@/lib/download-blob";
import { createEmailReportFilename, emailReportToCsv, emailReportToJson, emailReportToPdf } from "@/lib/email-report";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { listRunsForSchedule } from "@/lib/scheduled-reports/queries";
import { adminListRunsForSchedule } from "@/lib/scheduled-reports/admin-queries";

export function ScheduleHistory({ scheduleId, scheduleName, onClose }: { scheduleId: string; scheduleName: string; onClose: () => void }) {
  const t = useI18n();
  const history = t.scheduledReports.history;
  const supabase = useSupabase();
  const { isDefaultProject, adminToken } = supabase;

  const runsQuery = useQuery({
    queryKey: ["scheduled-report-runs", scheduleId],
    enabled: isDefaultProject ? Boolean(adminToken) : Boolean(supabase.client),
    queryFn: () => (isDefaultProject ? adminListRunsForSchedule(adminToken!, scheduleId) : listRunsForSchedule(supabase.client!, scheduleId)),
  });

  const runs = runsQuery.data ?? [];

  return (
    <div className="space-y-4 rounded-panel border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-bold text-ink">
          {history.title} — {scheduleName}
        </h3>
        <Button variant="ghost" onClick={onClose} aria-label={history.close}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {runsQuery.isLoading ? <p className="text-sm text-ink-muted">{t.common.loading}</p> : null}

      {!runsQuery.isLoading && !runs.length ? (
        <EmptyState title={history.emptyTitle} description={history.emptyDescription} />
      ) : null}

      {runs.map((run) => (
        <div
          key={run.id}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">{new Date(run.generatedAt).toLocaleString()}</span>
              <Badge tone={run.status === "success" ? "success" : "destructive"}>
                {run.status === "success" ? t.scheduledReports.list.lastRunSuccess : t.scheduledReports.list.lastRunError}
              </Badge>
            </div>
            {run.report ? (
              <p className="text-xs text-ink-muted">
                {history.eventsHeader}: {run.report.summary.totalEvents} · {history.recipientsHeader}: {(run.recipientsSent ?? []).join(", ")}
              </p>
            ) : null}
            {run.errorMessage ? (
              <p className="text-xs font-medium text-danger">
                {history.errorMessage}: {run.errorMessage}
              </p>
            ) : null}
          </div>

          {run.report ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const filename = createEmailReportFilename("csv", run.report!.generatedAt);
                  downloadBlob(new Blob([emailReportToCsv(run.report!)], { type: "text/csv;charset=utf-8" }), filename);
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {history.downloadCsv}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const filename = createEmailReportFilename("pdf", run.report!.generatedAt);
                  downloadBlob(emailReportToPdf(run.report!), filename);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                {history.downloadPdf}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const filename = createEmailReportFilename("json", run.report!.generatedAt);
                  downloadBlob(new Blob([emailReportToJson(run.report!)], { type: "application/json;charset=utf-8" }), filename);
                }}
              >
                <FileJson className="mr-2 h-4 w-4" />
                {history.downloadJson}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
