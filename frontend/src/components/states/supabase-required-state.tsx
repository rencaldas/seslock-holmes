import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import {
  DEFAULT_CLOCK_FORMAT,
  DEFAULT_TIME_ZONE,
  DEFAULT_UPDATE_INTERVAL,
  saveSupabaseSettings,
} from "@/lib/supabase/settings";
import overviewLogo from "@/assets/overview-logo.png";
import overviewLogoBlack from "@/assets/overview-logo-black.png";

const SUPABASE_DASHBOARD_URL = "https://supabase.com/dashboard/org/";

function HelpLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function SupabaseLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
        fill="url(#supabase-logo-gradient-a)"
      />
      <path
        d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
        fill="url(#supabase-logo-gradient-b)"
        fillOpacity="0.2"
      />
      <path
        d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.16549 56.4175L45.317 2.07103Z"
        fill="#3ECF8E"
      />
      <defs>
        <linearGradient id="supabase-logo-gradient-a" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
          <stop stopColor="#249361" />
          <stop offset="1" stopColor="#3ECF8E" />
        </linearGradient>
        <linearGradient id="supabase-logo-gradient-b" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
          <stop />
          <stop offset="1" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SupabaseRequiredState() {
  const t = useI18n();
  const language = useAppLanguage();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleConnect() {
    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      setError(t.settings.missingSupabase);
      return;
    }

    setError(null);
    setIsSaving(true);
    saveSupabaseSettings({
      url: trimmedUrl,
      anonKey: trimmedKey,
      eventsTable: "aws_sns",
      language,
      timeZone: DEFAULT_TIME_ZONE,
      clockFormat: DEFAULT_CLOCK_FORMAT,
      updateInterval: DEFAULT_UPDATE_INTERVAL,
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <Card className="w-full text-left">
        <CardHeader className="items-center border-b-0 pb-0 text-center">
          <div className="mb-5 flex items-center justify-center gap-6">
            <img src={overviewLogoBlack} alt="Seslock Holmes" className="h-24 w-24 object-contain dark:hidden" />
            <img src={overviewLogo} alt="Seslock Holmes" className="hidden h-24 w-24 object-contain dark:block" />
            <ArrowRight className="h-9 w-9 shrink-0 text-ink-muted" />
            <SupabaseLogo className="h-[84px] w-[84px]" />
          </div>
          <CardTitle className="text-xl">{t.supabaseRequired.title}</CardTitle>
          <CardDescription>{t.supabaseRequired.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="supabase-required-url">{t.settings.urlLabel}</Label>
            <Input
              id="supabase-required-url"
              placeholder={t.settings.urlPlaceholder}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <HelpLink href={SUPABASE_DASHBOARD_URL} label={t.supabaseRequired.findUrlLink} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-required-key">{t.settings.keyLabel}</Label>
            <Input
              id="supabase-required-key"
              type="password"
              placeholder={t.settings.keyPlaceholder}
              value={anonKey}
              onChange={(event) => setAnonKey(event.target.value)}
            />
            <HelpLink href={SUPABASE_DASHBOARD_URL} label={t.supabaseRequired.findKeyLink} />
          </div>

          {error ? <p className="text-sm font-medium text-rose-700 dark:text-rose-400">{error}</p> : null}

          <Button className="w-full" onClick={handleConnect} disabled={isSaving}>
            {isSaving ? t.supabaseRequired.connecting : t.supabaseRequired.connectButton}
          </Button>

          <p className="text-center text-xs text-ink-muted">{t.supabaseRequired.formHint}</p>

          <div className="border-t border-slate-100 pt-4 text-center dark:border-slate-800">
            <p className="text-xs text-ink-muted">{t.supabaseRequired.advancedHint}</p>
            <Button variant="ghost" className="mt-1" onClick={() => navigate("/settings")}>
              {t.supabaseRequired.advancedButton}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
