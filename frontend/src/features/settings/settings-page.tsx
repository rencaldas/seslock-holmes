import { useState } from "react";
import { AlertCircle, Download, FolderOpen, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getSupabaseEnv } from "@/lib/env";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { AppLanguage } from "@/lib/i18n/types";
import {
  clearSupabaseSettings,
  downloadSupabaseEnvFile,
  loadSupabaseSettings,
  saveSupabaseSettings,
  writeSupabaseEnvFileToProject,
} from "@/lib/supabase/settings";

function getInitialValues() {
  const savedSettings = loadSupabaseSettings();
  const envSettings = getSupabaseEnv();

  return {
    url: savedSettings?.url ?? envSettings?.url ?? "",
    anonKey: savedSettings?.anonKey ?? envSettings?.anonKey ?? "",
    eventsTable: savedSettings?.eventsTable ?? envSettings?.eventsTable ?? "aws_sns",
    language: savedSettings?.language ?? "pt-BR",
  };
}

export function SettingsPage() {
  const t = useI18n();
  const initialValues = getInitialValues();
  const [url, setUrl] = useState(initialValues.url);
  const [anonKey, setAnonKey] = useState(initialValues.anonKey);
  const [eventsTable, setEventsTable] = useState(initialValues.eventsTable);
  const [language, setLanguage] = useState<AppLanguage>(initialValues.language);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(mode: "browser" | "project" | "download") {
    setIsSaving(true);
    setFeedback(null);
    setError(null);

    const settings = {
      url: url.trim(),
      anonKey: anonKey.trim(),
      eventsTable: eventsTable.trim() || "aws_sns",
      language,
    };

    try {
      if (!settings.url || !settings.anonKey) {
        throw new Error(t.settings.missingSupabase);
      }

      saveSupabaseSettings(settings);

      if (mode === "project") {
        await writeSupabaseEnvFileToProject(settings);
        setFeedback(t.settings.savedProject);
      } else if (mode === "download") {
        downloadSupabaseEnvFile(settings);
        setFeedback(t.settings.savedDownload);
      } else {
        setFeedback(t.settings.savedBrowser);
      }
    } catch (persistError) {
      setError(persistError instanceof Error ? persistError.message : t.common.noAvailableData);
    } finally {
      setIsSaving(false);
    }
  }

  function clearLocalSettings() {
    clearSupabaseSettings();
    setFeedback(t.settings.localCleared);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-soft backdrop-blur-sm lg:p-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t.settings.title}</p>
          <h2 className="text-4xl font-semibold tracking-tight text-slate-950">{t.settings.introTitle}</h2>
          <p className="text-base leading-7 text-slate-600">{t.settings.introDescription}</p>
        </div>
      </section>

      <Card className="border-slate-200/80 bg-white/90">
        <CardHeader>
          <CardTitle>{t.settings.languageTitle}</CardTitle>
          <CardDescription>{t.settings.languageDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="language">Idioma</Label>
            <Select
              id="language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as AppLanguage)}
              options={[
                { value: "pt-BR", label: t.settings.languageOptions.pt },
                { value: "en-US", label: t.settings.languageOptions.en },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white/90">
        <CardHeader>
          <CardTitle>{t.settings.supabaseTitle}</CardTitle>
          <CardDescription>{t.settings.supabaseDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="supabase-url">{t.settings.urlLabel}</Label>
            <Input
              id="supabase-url"
              placeholder={t.settings.urlPlaceholder}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-key">{t.settings.keyLabel}</Label>
            <Input
              id="supabase-key"
              type="password"
              placeholder={t.settings.keyPlaceholder}
              value={anonKey}
              onChange={(event) => setAnonKey(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-table">{t.settings.tableLabel}</Label>
            <Input
              id="supabase-table"
              placeholder={t.settings.tablePlaceholder}
              value={eventsTable}
              onChange={(event) => setEventsTable(event.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t.settings.warning}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => persist("browser")} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {t.settings.saveBrowser}
            </Button>
            <Button type="button" variant="secondary" onClick={() => persist("project")} disabled={isSaving}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {t.settings.saveProject}
            </Button>
            <Button type="button" variant="secondary" onClick={() => persist("download")} disabled={isSaving}>
              <Download className="mr-2 h-4 w-4" />
              {t.settings.downloadEnv}
            </Button>
            <Button type="button" variant="secondary" onClick={clearLocalSettings} disabled={isSaving}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t.settings.clearLocal}
            </Button>
          </div>

          {feedback ? <p className="text-sm font-medium text-emerald-700">{feedback}</p> : null}
          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
