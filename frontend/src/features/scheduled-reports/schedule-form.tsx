import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";
import { useI18n } from "@/lib/i18n/use-i18n";
import { ROW_LIMIT_OPTIONS, UNLIMITED_ROW_LIMIT, parseRowLimit, DEFAULT_ROW_LIMIT } from "@/lib/row-limits";
import type { EmailReportSortBy } from "@/lib/email-report";
import { DEFAULT_FREQUENCY } from "@/lib/scheduled-reports/frequency";
import type { ReportSchedule, ScheduleFrequencyType, ScheduleInput } from "@/lib/scheduled-reports/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildInitialState(initial: ReportSchedule | undefined, eventsTable: string) {
  return {
    name: initial?.name ?? "",
    windowDays: initial?.filters.windowDays ?? 7,
    status: initial?.filters.status ?? "all",
    origin: initial?.filters.origin ?? "",
    subject: initial?.filters.subject ?? "",
    provider: initial?.filters.provider ?? "",
    rowLimit: initial?.filters.rowLimit ?? DEFAULT_ROW_LIMIT,
    sortBy: (initial?.filters.sortBy ?? "email") as EmailReportSortBy,
    frequencyType: initial?.frequency.type ?? DEFAULT_FREQUENCY.type,
    time: initial?.frequency.time ?? DEFAULT_FREQUENCY.time,
    dayOfWeek: initial?.frequency.dayOfWeek ?? DEFAULT_FREQUENCY.dayOfWeek ?? 1,
    dayOfMonth: initial?.frequency.dayOfMonth ?? 1,
    timezone: initial?.timezone ?? "America/Sao_Paulo",
    recipients: initial?.recipients ?? [],
    eventsTable: initial?.eventsTable ?? eventsTable,
    isActive: initial?.isActive ?? true,
  };
}

export function ScheduleForm({
  initial,
  eventsTable,
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  initial?: ReportSchedule;
  eventsTable: string;
  onCancel: () => void;
  onSubmit: (input: ScheduleInput) => Promise<void>;
  isSubmitting: boolean;
}) {
  const t = useI18n();
  const form = t.scheduledReports.form;
  const [state, setState] = useState(() => buildInitialState(initial, eventsTable));
  const [recipientInput, setRecipientInput] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function addRecipient() {
    const value = recipientInput.trim().toLowerCase();
    if (!value) return;

    if (!EMAIL_REGEX.test(value)) {
      setRecipientError(form.invalidEmail);
      return;
    }
    if (state.recipients.includes(value)) {
      setRecipientError(form.duplicateEmail);
      return;
    }

    setState((prev) => ({ ...prev, recipients: [...prev.recipients, value] }));
    setRecipientInput("");
    setRecipientError(null);
  }

  function removeRecipient(email: string) {
    setState((prev) => ({ ...prev, recipients: prev.recipients.filter((entry) => entry !== email) }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!state.name.trim() || !state.recipients.length) {
      setFormError(form.errorFeedback);
      return;
    }

    const input: ScheduleInput = {
      name: state.name.trim(),
      eventsTable: state.eventsTable,
      isActive: state.isActive,
      timezone: state.timezone,
      filters: {
        windowDays: state.windowDays,
        status: state.status,
        origin: state.origin,
        subject: state.subject,
        provider: state.provider,
        rowLimit: state.rowLimit,
        sortBy: state.sortBy,
      },
      frequency:
        state.frequencyType === "weekly"
          ? { type: "weekly", time: state.time, dayOfWeek: state.dayOfWeek }
          : state.frequencyType === "monthly"
            ? { type: "monthly", time: state.time, dayOfMonth: state.dayOfMonth }
            : { type: "daily", time: state.time },
      recipients: state.recipients,
    };

    try {
      await onSubmit(input);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : form.errorFeedback);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-panel border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-lg font-bold text-ink">{initial ? form.editTitle : form.createTitle}</h3>

      <div className="space-y-2">
        <Label htmlFor="schedule-name">{form.nameLabel}</Label>
        <Input
          id="schedule-name"
          placeholder={form.namePlaceholder}
          value={state.name}
          onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="schedule-window">{form.windowLabel}</Label>
          <Select
            id="schedule-window"
            value={String(state.windowDays)}
            onChange={(event) => setState((prev) => ({ ...prev, windowDays: Number(event.target.value) }))}
            options={[
              { label: t.overview.filters.timeOptions.d1, value: "1" },
              { label: t.overview.filters.timeOptions.d7, value: "7" },
              { label: t.overview.filters.timeOptions.d30, value: "30" },
              { label: t.overview.filters.timeOptions.d90, value: "90" },
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-status">{t.overview.filters.status}</Label>
          <Select
            id="schedule-status"
            value={state.status}
            onChange={(event) => setState((prev) => ({ ...prev, status: event.target.value as typeof prev.status }))}
            options={[
              { label: t.overview.filters.options.all, value: "all" },
              { label: t.overview.filters.options.sent, value: "sent" },
              { label: t.overview.filters.options.delivered, value: "delivered" },
              { label: t.overview.filters.options.bounced, value: "bounced" },
              { label: t.overview.filters.options.complained, value: "complained" },
              { label: t.overview.filters.options.delayed, value: "delayed" },
              { label: t.overview.filters.options.rejected, value: "rejected" },
              { label: t.overview.filters.options.rendering_failure, value: "rendering_failure" },
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-row-limit">{t.overview.filters.rows}</Label>
          <Select
            id="schedule-row-limit"
            value={String(state.rowLimit)}
            onChange={(event) => setState((prev) => ({ ...prev, rowLimit: parseRowLimit(event.target.value) }))}
            options={[
              ...ROW_LIMIT_OPTIONS.map((rowLimit) => ({ label: rowLimit.toLocaleString(), value: String(rowLimit) })),
              { label: t.overview.filters.noRowLimit, value: UNLIMITED_ROW_LIMIT },
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-subject">{t.overview.filters.subject}</Label>
          <Input
            id="schedule-subject"
            placeholder={t.overview.filters.subjectPlaceholder}
            value={state.subject}
            onChange={(event) => setState((prev) => ({ ...prev, subject: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-origin">{t.overview.filters.origin}</Label>
          <Input
            id="schedule-origin"
            placeholder={t.overview.originPlaceholder}
            value={state.origin}
            onChange={(event) => setState((prev) => ({ ...prev, origin: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-provider">{t.overview.filters.provider}</Label>
          <Input
            id="schedule-provider"
            placeholder={t.overview.filters.providerPlaceholder}
            value={state.provider}
            onChange={(event) => setState((prev) => ({ ...prev, provider: event.target.value }))}
          />
        </div>

        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="schedule-sort">{form.sortLabel}</Label>
          <Select
            id="schedule-sort"
            value={state.sortBy}
            onChange={(event) => setState((prev) => ({ ...prev, sortBy: event.target.value as EmailReportSortBy }))}
            options={[
              { label: t.overview.exportSortEmail, value: "email" },
              { label: t.overview.exportSortCriticality, value: "criticality" },
              { label: t.overview.exportSortTotalEvents, value: "totalEvents" },
              { label: t.overview.exportSortRecentActivity, value: "recentActivity" },
              { label: t.overview.exportSortComplaints, value: "complaints" },
              { label: t.overview.exportSortDomain, value: "domain" },
              { label: t.overview.exportSortProblemRate, value: "problemRate" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <h4 className="text-sm font-bold text-ink">{form.frequencyTitle}</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="schedule-frequency-type">{form.frequencyTypeLabel}</Label>
            <Select
              id="schedule-frequency-type"
              value={state.frequencyType}
              onChange={(event) =>
                setState((prev) => ({ ...prev, frequencyType: event.target.value as ScheduleFrequencyType }))
              }
              options={[
                { label: form.frequencyTypeOptions.daily, value: "daily" },
                { label: form.frequencyTypeOptions.weekly, value: "weekly" },
                { label: form.frequencyTypeOptions.monthly, value: "monthly" },
              ]}
            />
          </div>

          {state.frequencyType === "weekly" ? (
            <div className="space-y-2">
              <Label htmlFor="schedule-day-of-week">{form.dayOfWeekLabel}</Label>
              <Select
                id="schedule-day-of-week"
                value={String(state.dayOfWeek)}
                onChange={(event) => setState((prev) => ({ ...prev, dayOfWeek: Number(event.target.value) }))}
                options={form.dayOfWeekOptions.map((label, index) => ({ label, value: String(index) }))}
              />
            </div>
          ) : null}

          {state.frequencyType === "monthly" ? (
            <div className="space-y-2">
              <Label htmlFor="schedule-day-of-month">{form.dayOfMonthLabel}</Label>
              <Input
                id="schedule-day-of-month"
                type="number"
                min={1}
                max={31}
                value={state.dayOfMonth}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    dayOfMonth: Math.min(31, Math.max(1, Number(event.target.value) || 1)),
                  }))
                }
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="schedule-time">{form.timeLabel}</Label>
            <Input
              id="schedule-time"
              type="time"
              value={state.time}
              onChange={(event) => setState((prev) => ({ ...prev, time: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-timezone">{form.timezoneLabel}</Label>
            <Select
              id="schedule-timezone"
              value={state.timezone}
              onChange={(event) => setState((prev) => ({ ...prev, timezone: event.target.value }))}
              options={[
                { value: "America/Sao_Paulo", label: "America/Sao_Paulo" },
                { value: "UTC", label: "UTC" },
                { value: "America/New_York", label: "America/New_York" },
                { value: "Europe/London", label: "Europe/London" },
                { value: "Europe/Berlin", label: "Europe/Berlin" },
                { value: "Asia/Tokyo", label: "Asia/Tokyo" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="schedule-recipients">{form.recipientsLabel}</Label>
        <div className="flex gap-2">
          <Input
            id="schedule-recipients"
            placeholder={form.recipientsPlaceholder}
            value={recipientInput}
            onChange={(event) => {
              setRecipientInput(event.target.value);
              setRecipientError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addRecipient();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addRecipient}>
            +
          </Button>
        </div>
        <p className="text-xs text-ink-muted">{form.recipientsHint}</p>
        {recipientError ? <p className="text-xs font-medium text-danger">{recipientError}</p> : null}
        {state.recipients.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {state.recipients.map((email) => (
              <Chip key={email} onRemove={() => removeRecipient(email)}>
                {email}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      {formError ? <p className="text-sm font-medium text-danger">{formError}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          {form.cancel}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {form.save}
        </Button>
      </div>
    </form>
  );
}
