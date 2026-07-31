import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/use-i18n";
import { createConnection, deleteConnection, getConnectionStatus } from "@/lib/scheduled-reports/connection-queries";
import {
  clearStoredConnection,
  saveStoredConnection,
  type StoredConnection,
} from "@/lib/scheduled-reports/connection-settings";

interface RegisterFormState {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  gmailUser: string;
  gmailAppPassword: string;
  gmailFromName: string;
  label: string;
}

const EMPTY_FORM: RegisterFormState = {
  supabaseUrl: "",
  supabaseServiceRoleKey: "",
  gmailUser: "",
  gmailAppPassword: "",
  gmailFromName: "",
  label: "",
};

export function ConnectionPanel({
  connection,
  onConnectionChange,
}: {
  connection: StoredConnection | null;
  onConnectionChange: (connection: StoredConnection | null) => void;
}) {
  const t = useI18n();
  const c = t.scheduledReports.connection;

  const [form, setForm] = useState<RegisterFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreatedToken, setJustCreatedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["scheduled-reports-connection-status", connection?.connectionId],
    enabled: Boolean(connection),
    queryFn: () => getConnectionStatus(connection!.connectionId, connection!.token),
  });

  async function handleRegister() {
    setError(null);

    if (!form.supabaseUrl.trim() || !form.supabaseServiceRoleKey.trim() || !form.gmailUser.trim() || !form.gmailAppPassword.trim()) {
      setError(c.missingFields);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createConnection({
        supabaseUrl: form.supabaseUrl.trim(),
        supabaseServiceRoleKey: form.supabaseServiceRoleKey.trim(),
        gmailUser: form.gmailUser.trim(),
        gmailAppPassword: form.gmailAppPassword.trim(),
        gmailFromName: form.gmailFromName.trim() || undefined,
        label: form.label.trim() || undefined,
      });

      saveStoredConnection(result);
      onConnectionChange(result);
      setJustCreatedToken(result.token);
      setForm(EMPTY_FORM);
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : c.errorFeedback);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!connection) return;
    if (!window.confirm(c.removeConfirm)) return;

    setIsRemoving(true);
    setError(null);
    try {
      await deleteConnection(connection.connectionId, connection.token);
      clearStoredConnection();
      onConnectionChange(null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : c.errorFeedback);
    } finally {
      setIsRemoving(false);
    }
  }

  async function copyToken() {
    if (!justCreatedToken) return;
    await navigator.clipboard.writeText(justCreatedToken);
    setTokenCopied(true);
    window.setTimeout(() => setTokenCopied(false), 2000);
  }

  if (justCreatedToken) {
    return (
      <div className="space-y-4 rounded-panel border border-amber-300 bg-amber-50 p-6 dark:border-amber-500/40 dark:bg-amber-500/10">
        <h3 className="text-lg font-bold text-amber-950 dark:text-amber-200">{c.tokenWarningTitle}</h3>
        <p className="text-sm text-amber-900 dark:text-amber-200/90">{c.tokenWarningDescription}</p>
        <pre className="overflow-auto rounded-2xl border border-amber-300 bg-white p-4 text-xs text-ink dark:border-amber-500/40 dark:bg-slate-950 dark:text-slate-100">
          <code>{justCreatedToken}</code>
        </pre>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={copyToken}>
            {tokenCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {tokenCopied ? c.copied : c.copyToken}
          </Button>
          <Button type="button" onClick={() => setJustCreatedToken(null)}>
            {c.doneButton}
          </Button>
        </div>
      </div>
    );
  }

  if (connection) {
    const status = statusQuery.data;
    return (
      <div className="space-y-4 rounded-panel border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">{c.connectedTitle}</h3>
            <p className="mt-1 text-sm text-ink-muted">{status?.label || c.unnamedConnection}</p>
          </div>
          {status ? <Badge tone={status.isActive ? "success" : "muted"}>{status.isActive ? c.statusActive : c.statusInactive}</Badge> : null}
        </div>

        <div className="space-y-1 text-sm text-ink-muted">
          <p>
            {c.lastCheckedLabel}: {status?.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleString() : c.lastCheckedNever}
          </p>
          {status?.lastError ? (
            <p className="text-danger">
              {c.lastErrorLabel}: {status.lastError}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

        <Button type="button" variant="secondary" onClick={handleRemove} disabled={isRemoving}>
          {isRemoving ? c.removing : c.removeButton}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-panel border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-lg font-bold text-ink">{c.title}</h3>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{c.description}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="connection-supabase-url">{c.supabaseUrlLabel}</Label>
          <Input
            id="connection-supabase-url"
            placeholder={c.supabaseUrlPlaceholder}
            value={form.supabaseUrl}
            onChange={(event) => setForm((current) => ({ ...current, supabaseUrl: event.target.value }))}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="connection-service-role-key">{c.serviceRoleKeyLabel}</Label>
          <Input
            id="connection-service-role-key"
            type="password"
            value={form.supabaseServiceRoleKey}
            onChange={(event) => setForm((current) => ({ ...current, supabaseServiceRoleKey: event.target.value }))}
          />
          <p className="text-xs text-ink-muted">{c.serviceRoleKeyHint}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="connection-gmail-user">{c.gmailUserLabel}</Label>
          <Input
            id="connection-gmail-user"
            type="email"
            value={form.gmailUser}
            onChange={(event) => setForm((current) => ({ ...current, gmailUser: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="connection-gmail-app-password">{c.gmailAppPasswordLabel}</Label>
          <Input
            id="connection-gmail-app-password"
            type="password"
            value={form.gmailAppPassword}
            onChange={(event) => setForm((current) => ({ ...current, gmailAppPassword: event.target.value }))}
          />
          <p className="text-xs text-ink-muted">{c.gmailAppPasswordHint}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="connection-from-name">{c.fromNameLabel}</Label>
          <Input
            id="connection-from-name"
            value={form.gmailFromName}
            onChange={(event) => setForm((current) => ({ ...current, gmailFromName: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="connection-label">{c.labelLabel}</Label>
          <Input
            id="connection-label"
            value={form.label}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
          />
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      <Button type="button" onClick={handleRegister} disabled={isSubmitting}>
        {isSubmitting ? c.registering : c.registerButton}
      </Button>
    </div>
  );
}
