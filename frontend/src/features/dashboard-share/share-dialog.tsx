import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/states/empty-state";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { generateShareToken } from "@/lib/dashboard-shares/token";
import { buildShareUrl } from "@/lib/dashboard-shares/link";
import { checkDashboardSharesConfigured, createDashboardShare } from "@/lib/dashboard-shares/queries";
import type { DashboardShareExpiryOption, DashboardShareFilters } from "@/lib/dashboard-shares/types";
import type { OverviewSearchFilters } from "@/lib/overview/overview-search-params";

const EXPIRY_DAYS: Record<Exclude<DashboardShareExpiryOption, "never">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function expiryToIso(option: DashboardShareExpiryOption): string | null {
  if (option === "never") return null;
  const days = EXPIRY_DAYS[option];
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function toShareFilters(filters: OverviewSearchFilters): DashboardShareFilters {
  return {
    windowDays: filters.windowDays,
    status: filters.status,
    // O seletor de subtipo só aparece na UI quando status === "bounced", mas
    // o valor escolhido antes fica no estado (persistido em localStorage)
    // mesmo depois de trocar o status de volta para "all" — sem isso, um
    // link "todos os e-mails" herdaria um subtipo obsoleto e mostraria só
    // bounces daquele subtipo. Mesma regra de overviewFiltersToSearchParams.
    bounceSubType: filters.status === "bounced" ? filters.bounceSubType : "all",
    origin: filters.origin,
    subject: filters.subject,
    provider: filters.provider,
  };
}

export function ShareDialog({ filters, onClose }: { filters: OverviewSearchFilters; onClose: () => void }) {
  const t = useI18n();
  const s = t.dashboardShare;
  const supabase = useSupabase();

  const [label, setLabel] = useState("");
  const [includeRecentActivity, setIncludeRecentActivity] = useState(false);
  const [expiryOption, setExpiryOption] = useState<DashboardShareExpiryOption>("30d");
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const configuredQuery = useQuery({
    queryKey: ["dashboard-shares-configured", supabase.eventsTable],
    enabled: Boolean(supabase.client),
    queryFn: () => checkDashboardSharesConfigured(supabase.client!),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = generateShareToken();
      await createDashboardShare(supabase.client!, {
        token,
        label: label.trim(),
        eventsTable: supabase.eventsTable ?? "aws_sns",
        filters: toShareFilters(filters),
        includeRecentActivity,
        expiresAt: expiryToIso(expiryOption),
      });

      return buildShareUrl({
        token,
        supabaseUrl: supabase.url ?? "",
        supabaseAnonKey: supabase.anonKey ?? "",
        eventsTable: supabase.eventsTable ?? "aws_sns",
      });
    },
    onSuccess: (url) => setShareUrl(url),
  });

  const isCustomRange = filters.timeMode === "custom";

  function handleCopy() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-panel border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 id="share-dialog-title" className="text-base font-bold tracking-tight text-ink">
              {s.dialogTitle}
            </h3>
            <p className="mt-1 text-sm text-ink-muted">{s.dialogDescription}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {configuredQuery.data === false ? (
            <EmptyState title={s.notConfiguredTitle} description={s.notConfiguredDescription} />
          ) : shareUrl ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ink">{s.linkReadyTitle}</p>
              <p className="text-xs text-ink-muted">{s.linkReadyDescription}</p>
              <div className="flex items-center gap-2 rounded-control border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                <Link2 className="h-4 w-4 shrink-0 text-ink-muted" />
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 truncate bg-transparent text-xs text-ink outline-none"
                />
                <Button variant="secondary" className="h-8 shrink-0 px-3" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="ml-1.5 text-xs">{copied ? s.copied : s.copyButton}</span>
                </Button>
              </div>
            </div>
          ) : isCustomRange ? (
            <p className="text-sm text-ink-muted">{s.customRangeUnsupported}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="share-label">{s.labelFieldLabel}</Label>
                <Input
                  id="share-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder={s.labelFieldPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="share-expiry">{s.expiresLabel}</Label>
                <Select
                  id="share-expiry"
                  value={expiryOption}
                  onChange={(event) => setExpiryOption(event.target.value as DashboardShareExpiryOption)}
                  options={[
                    { label: s.expiresOptions.d7, value: "7d" },
                    { label: s.expiresOptions.d30, value: "30d" },
                    { label: s.expiresOptions.d90, value: "90d" },
                    { label: s.expiresOptions.never, value: "never" },
                  ]}
                />
              </div>

              <label className="flex items-start gap-2.5 rounded-control border border-slate-200 p-3 text-sm dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={includeRecentActivity}
                  onChange={(event) => setIncludeRecentActivity(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand/30"
                />
                <span>
                  <span className="block font-medium text-ink">{s.includeRecentActivityLabel}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{s.includeRecentActivityHint}</span>
                </span>
              </label>

              {createMutation.isError ? <p className="text-xs text-danger">{s.errorGeneric}</p> : null}
            </>
          )}
        </div>

        {!shareUrl && configuredQuery.data !== false && !isCustomRange ? (
          <div className="flex justify-end border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? s.generating : s.generateButton}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
