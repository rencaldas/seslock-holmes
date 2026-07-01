/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";
import { clearSupabaseSettings, loadSupabaseSettings, saveSupabaseSettings } from "./settings";

describe("Supabase settings persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearSupabaseSettings();
  });

  it("persists the new display and refresh preferences", () => {
    saveSupabaseSettings({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      eventsTable: "aws_sns",
      language: "pt-BR",
      timeZone: "America/Sao_Paulo",
      clockFormat: "24h",
      updateInterval: "1m",
    } as Parameters<typeof saveSupabaseSettings>[0]);

    expect(loadSupabaseSettings()).toMatchObject({
      timeZone: "America/Sao_Paulo",
      clockFormat: "24h",
      updateInterval: "1m",
    });
  });
});
