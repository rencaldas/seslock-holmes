import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useSupabase } from "@/lib/supabase/context";
import { generateShareToken } from "@/lib/dashboard-shares/token";
import { buildShareUrl } from "@/lib/dashboard-shares/link";
import { regenerateDashboardShareToken } from "@/lib/dashboard-shares/queries";
import type { DashboardShare } from "@/lib/dashboard-shares/types";

export function RegenerateLinkDialog({ share, onClose }: { share: DashboardShare; onClose: () => void }) {
  const t = useI18n();
  const s = t.dashboardShare;
  const supabase = useSupabase();

  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const token = generateShareToken();
      await regenerateDashboardShareToken(supabase.client!, share.id, token);

      return buildShareUrl({
        token,
        supabaseUrl: supabase.url ?? "",
        supabaseAnonKey: supabase.anonKey ?? "",
        eventsTable: share.eventsTable,
      });
    },
    onSuccess: (url) => setShareUrl(url),
  });

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
        aria-labelledby="regenerate-link-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-panel border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 id="regenerate-link-dialog-title" className="text-base font-bold tracking-tight text-ink">
              {s.regenerateLinkDialogTitle}
            </h3>
            <p className="mt-1 text-sm text-ink-muted">{share.label || "—"}</p>
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
          {shareUrl ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ink">{s.regenerateLinkReadyTitle}</p>
              <p className="text-xs text-ink-muted">{s.regenerateLinkReadyDescription}</p>
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
          ) : (
            <>
              <p className="text-sm text-ink-muted">{s.regenerateLinkDialogDescription}</p>
              {regenerateMutation.isError ? <p className="text-xs text-danger">{s.regenerateLinkErrorGeneric}</p> : null}
            </>
          )}
        </div>

        {!shareUrl ? (
          <div className="flex justify-end border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <Button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
              {regenerateMutation.isPending ? s.regenerateLinkGenerating : s.regenerateLinkConfirmButton}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
