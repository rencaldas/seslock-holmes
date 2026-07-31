import { ArrowUpRight, Clock, FileText, ListChecks, MessageSquare, Radio } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, isProblemEventType, toneForEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import type { RecipientInvestigationResult } from "@/lib/supabase/types";

function diagnosisTone(severity: string): "destructive" | "warning" | "muted" {
  if (severity === "high") {
    return "destructive";
  }

  if (severity === "medium") {
    return "warning";
  }

  return "muted";
}

function accentBorderForEventType(eventType: RecipientInvestigationResult["events"][number]["eventType"]) {
  switch (eventType) {
    case "delivered":
      return "border-l-success";
    case "sent":
      return "border-l-slate-300 dark:border-l-slate-600";
    case "bounced":
    case "rejected":
    case "rendering_failure":
      return "border-l-danger";
    case "complained":
    case "delayed":
      return "border-l-warning";
    default:
      return "border-l-slate-300 dark:border-l-slate-600";
  }
}

function FieldLabel({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

export function RecipientResults({
  data,
}: {
  data: RecipientInvestigationResult;
}) {
  const t = useI18n();

  if (!data.events.length) {
    return (
      <EmptyState
        title={t.investigation.noResultsTitle}
        description={t.investigation.noResultsDescription}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={data.hasProblemActivity ? "destructive" : "success"}>
              {data.totalCount} {t.investigation.resultCount}
            </Badge>

            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t.investigation.latestActivity}: {formatDateTime(data.latestEventAt)}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {data.events.map((event) => (
            <div
              key={event.id}
              className={cn(
                "grid grid-cols-1 gap-6 rounded-2xl border border-l-4 border-slate-200 bg-white px-6 py-6 shadow-sm transition-shadow hover:shadow-md lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-900/60",
                accentBorderForEventType(event.eventType),
              )}
            >
              <div className="space-y-5 lg:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel icon={Clock}>{t.investigation.tableHour}</FieldLabel>
                    <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                      {formatDateTime(event.occurredAt)}
                    </p>
                  </div>

                  <Link
                    className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand/40 hover:bg-brand/5 hover:text-brand hover:shadow dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand/40 dark:hover:bg-brand/10"
                    to={`/events/${event.id}`}
                  >
                    {t.investigation.inspectEvent}
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel icon={FileText}>{t.investigation.tableSubject}</FieldLabel>
                  <p
                    className="break-words text-sm font-medium text-slate-950 dark:text-slate-50"
                    title={event.subject || t.common.noAvailableData}
                  >
                    {event.subject || t.common.noAvailableData}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel icon={Radio}>{t.investigation.tableOrigin}</FieldLabel>
                  <p className="break-words text-sm font-medium text-slate-950 dark:text-slate-50">
                    {getOriginLabel(event)}
                  </p>
                  <p className="break-words text-xs text-slate-500 dark:text-slate-400">
                    {event.smtpIdentity}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel icon={MessageSquare}>{t.investigation.tableMessage}</FieldLabel>
                  <p className="break-words text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {t.overview.tableFromLabel}:
                    </span>{" "}
                    {event.senderEmail}
                  </p>
                  <p className="break-words text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {t.overview.tableToLabel}:
                    </span>{" "}
                    {event.recipientEmail}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-3">
                <FieldLabel icon={ListChecks}>{t.investigation.tableResult}</FieldLabel>

                <div className="mt-2">
                  {event.bounceDiagnosis ? (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge tone={toneForEventType(event.eventType)}>
                          {formatEventType(event.eventType)}
                        </Badge>

                        <Badge tone={diagnosisTone(event.bounceDiagnosis.severity)}>
                          {t.investigation.diagnosisSeverity}: {event.bounceDiagnosis.severity}
                        </Badge>

                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {event.bounceDiagnosis.category}
                        </span>
                      </div>

                      <div className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        <p className="break-words leading-6">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {t.investigation.diagnosisCause}:
                          </span>{" "}
                          {event.bounceDiagnosis.cause}
                        </p>

                        <p className="mt-3 break-words leading-6">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {t.investigation.diagnosisRecommendation}:
                          </span>{" "}
                          {event.bounceDiagnosis.recommendation}
                        </p>

                        {event.bounceDetails.diagnosticCode ? (
                          <div className="mt-3">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {t.investigation.diagnosisTechnicalCode}:
                            </p>

                            <p className="mt-2 break-words rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                              {String(event.bounceDetails.diagnosticCode)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <Badge tone={toneForEventType(event.eventType)}>
                        {formatEventType(event.eventType)}
                      </Badge>

                      <div className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        <p className="break-words leading-6">
                          {t.investigation.resultStatus[event.eventType]}
                        </p>

                        {isProblemEventType(event.eventType) && event.failureReason ? (
                          <p className="mt-3 break-words leading-6">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {t.investigation.resultStatusDetail}:
                            </span>{" "}
                            {event.failureReason}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
