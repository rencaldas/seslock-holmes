import type { AppClockFormat, AppLanguage, AppUpdateInterval } from "@/lib/i18n/types";

export interface SupabaseSettings {
  url: string;
  anonKey: string;
  eventsTable: string;
  language?: AppLanguage;
  timeZone?: string;
  clockFormat?: AppClockFormat;
  updateInterval?: AppUpdateInterval;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
}

export const SUPABASE_SETTINGS_STORAGE_KEY = "seslock-holmes.supabase.settings";
export const SUPABASE_SETTINGS_UPDATED_EVENT = "seslock-holmes:supabase-settings-updated";
export const DEFAULT_TIME_ZONE = "UTC";
export const DEFAULT_CLOCK_FORMAT: AppClockFormat = "24h";
export const DEFAULT_UPDATE_INTERVAL: AppUpdateInterval = "1m";

function isBrowser() {
  return typeof window !== "undefined";
}

function readSettingsFromStorage() {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(SUPABASE_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<SupabaseSettings>;
  } catch {
    return null;
  }
}

export function loadSupabaseSettings(): Partial<SupabaseSettings> | null {
  const parsed = readSettingsFromStorage();
  if (!parsed) {
    return null;
  }

  return {
    url: typeof parsed.url === "string" ? parsed.url.trim() : "",
    anonKey: typeof parsed.anonKey === "string" ? parsed.anonKey.trim() : "",
    eventsTable: typeof parsed.eventsTable === "string" ? parsed.eventsTable.trim() : "",
    language: parsed.language === "pt-BR" || parsed.language === "en-US" ? parsed.language : undefined,
    timeZone: typeof parsed.timeZone === "string" ? parsed.timeZone : undefined,
    clockFormat: parsed.clockFormat === "12h" || parsed.clockFormat === "24h" ? parsed.clockFormat : undefined,
    updateInterval:
      parsed.updateInterval === "instant" ||
      parsed.updateInterval === "30s" ||
      parsed.updateInterval === "1m" ||
      parsed.updateInterval === "5m" ||
      parsed.updateInterval === "10m" ||
      parsed.updateInterval === "30m"
        ? parsed.updateInterval
        : undefined,
  };
}

export function getSupabaseLanguage(): AppLanguage {
  return loadSupabaseSettings()?.language ?? "pt-BR";
}

export function getDisplayPreferences() {
  const savedSettings = loadSupabaseSettings();

  return {
    timeZone: savedSettings?.timeZone || DEFAULT_TIME_ZONE,
    clockFormat: savedSettings?.clockFormat || DEFAULT_CLOCK_FORMAT,
    updateInterval: savedSettings?.updateInterval || DEFAULT_UPDATE_INTERVAL,
  };
}

export function getRefreshIntervalMs() {
  switch (getDisplayPreferences().updateInterval) {
    case "instant":
      return 10000;
    case "30s":
      return 30000;
    case "1m":
      return 60000;
    case "5m":
      return 300000;
    case "10m":
      return 600000;
    case "30m":
      return 1800000;
    default:
      return 60000;
  }
}

export function formatDisplayDateTime(value: Date | string) {
  const { timeZone, clockFormat } = getDisplayPreferences();
  const dateValue = typeof value === "string" ? new Date(value) : value;

  try {
    return new Intl.DateTimeFormat(getSupabaseLanguage(), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
      hour12: clockFormat === "12h",
    }).format(dateValue);
  } catch {
    return new Intl.DateTimeFormat(getSupabaseLanguage(), {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: clockFormat === "12h",
    }).format(dateValue);
  }
}

export function saveSupabaseSettings(settings: SupabaseSettings) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(SUPABASE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  syncDocumentLanguage(settings.language ?? "pt-BR");
  window.dispatchEvent(new CustomEvent(SUPABASE_SETTINGS_UPDATED_EVENT));
}

export function clearSupabaseSettings() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(SUPABASE_SETTINGS_STORAGE_KEY);
  syncDocumentLanguage("pt-BR");
  window.dispatchEvent(new CustomEvent(SUPABASE_SETTINGS_UPDATED_EVENT));
}

export function buildSupabaseEnvFile(settings: SupabaseSettings) {
  return [
    `VITE_SUPABASE_URL=${settings.url.trim()}`,
    `VITE_SUPABASE_ANON_KEY=${settings.anonKey.trim()}`,
    `VITE_SUPABASE_EVENTS_TABLE=${settings.eventsTable.trim() || "aws_sns"}`,
    "",
  ].join("\n");
}

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadSupabaseEnvFile(settings: SupabaseSettings) {
  if (!isBrowser()) {
    return;
  }

  downloadTextFile(".env.local", buildSupabaseEnvFile(settings));
}

async function looksLikeFrontendDirectory(directory: FileSystemDirectoryHandle) {
  try {
    await directory.getFileHandle("vite.config.ts");
    return true;
  } catch {
    // ignore
  }

  try {
    await directory.getDirectoryHandle("src");
    return true;
  } catch {
    // ignore
  }

  return false;
}

async function resolveTargetDirectory(root: FileSystemDirectoryHandle) {
  if (await looksLikeFrontendDirectory(root)) {
    return root;
  }

  try {
    const frontendDirectory = await root.getDirectoryHandle("frontend");
    if (await looksLikeFrontendDirectory(frontendDirectory)) {
      return frontendDirectory;
    }
  } catch {
    // ignore
  }

  return root;
}

export async function writeSupabaseEnvFileToProject(settings: SupabaseSettings) {
  const browserWindow = globalThis as unknown as WindowWithDirectoryPicker;

  if (!isBrowser() || typeof browserWindow.showDirectoryPicker !== "function") {
    throw new Error("Seu navegador não suporta gravação direta de arquivos locais.");
  }

  const rootDirectory = await browserWindow.showDirectoryPicker({ mode: "readwrite" });
  const targetDirectory = await resolveTargetDirectory(rootDirectory);
  const fileHandle = await targetDirectory.getFileHandle(".env.local", { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(buildSupabaseEnvFile(settings));
  } finally {
    await writable.close();
  }

  return targetDirectory;
}

export function syncDocumentLanguage(language: AppLanguage) {
  if (!isBrowser()) {
    return;
  }

  document.documentElement.lang = language;
}
