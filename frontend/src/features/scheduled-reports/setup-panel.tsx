import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { checkScheduledReportsConfigured } from "@/lib/scheduled-reports/queries";
import { adminCheckScheduledReportsConfigured } from "@/lib/scheduled-reports/admin-queries";
import { HUB_ONLY_MIGRATIONS_SQL, REPORT_SCHEDULES_MIGRATION_SQL, REQUIRED_VERCEL_ENV_VARS } from "@/lib/scheduled-reports/setup-sql";

function CopyableBlock({ value, label }: { value: string; label: string }) {
  const t = useI18n();
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? t.scheduledReports.setup.copied : t.scheduledReports.setup.copyButton}
        </Button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100 dark:border-slate-800">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function EnvVarCopyButton({ name }: { name: string }) {
  const t = useI18n();
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(name);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? t.scheduledReports.setup.copied : name}
    </Button>
  );
}

export function SetupPanel({ collapsedByDefault }: { collapsedByDefault: boolean }) {
  const t = useI18n();
  const setup = t.scheduledReports.setup;
  const supabase = useSupabase();
  const { isDefaultProject, adminToken } = supabase;
  const [expanded, setExpanded] = useState(!collapsedByDefault);

  const configuredQuery = useQuery({
    queryKey: ["scheduled-reports-configured", supabase.eventsTable, isDefaultProject, adminToken],
    enabled: isDefaultProject ? Boolean(adminToken) : Boolean(supabase.client),
    queryFn: () => (isDefaultProject ? adminCheckScheduledReportsConfigured(adminToken!) : checkScheduledReportsConfigured(supabase.client!)),
  });

  const isConfigured = configuredQuery.data === true;

  return (
    <div className="space-y-4 rounded-panel border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="text-lg font-bold text-ink">{setup.title}</h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{setup.description}</p>
        </div>
        <Badge tone={configuredQuery.isLoading ? "muted" : isConfigured ? "success" : "warning"}>
          {configuredQuery.isLoading ? setup.checking : isConfigured ? setup.configuredBadge : setup.notConfiguredBadge}
        </Badge>
      </button>

      {expanded ? (
        <div className="space-y-6 pt-2">
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-ink">{setup.step1Title}</h4>
            <p className="text-sm text-ink-muted">{setup.step1Description}</p>
            <CopyableBlock value={REPORT_SCHEDULES_MIGRATION_SQL} label="SQL" />
          </div>

          <div className="space-y-2 rounded-2xl border border-amber-200 p-4 dark:border-amber-500/30">
            <h4 className="text-sm font-bold text-ink">{setup.hubStepTitle}</h4>
            <p className="text-sm text-ink-muted">{setup.hubStepDescription}</p>
            <CopyableBlock value={HUB_ONLY_MIGRATIONS_SQL} label="SQL" />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-ink">{setup.step2Title}</h4>
            <p className="text-sm text-ink-muted">{setup.step2Description}</p>
            <div className="space-y-3">
              {REQUIRED_VERCEL_ENV_VARS.map((envVar) => (
                <div
                  key={envVar.name}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-xs text-ink-muted">{envVar.description}</p>
                  <EnvVarCopyButton name={envVar.name} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-ink">{setup.step3Title}</h4>
            <p className="text-sm text-ink-muted">{setup.step3Description}</p>
          </div>

          <Button variant="secondary" onClick={() => configuredQuery.refetch()}>
            {setup.recheckButton}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
