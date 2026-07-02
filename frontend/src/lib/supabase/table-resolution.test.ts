/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS_TABLE_STORAGE_KEY, saveEventsTableOverride } from "./table-resolution";
import { SUPABASE_SETTINGS_UPDATED_EVENT } from "./settings";

describe("table resolution persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores the override and notifies listeners", () => {
    const listener = vi.fn();
    window.addEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, listener);

    saveEventsTableOverride("  ses_events_view  ");

    expect(window.localStorage.getItem(EVENTS_TABLE_STORAGE_KEY)).toBe("ses_events_view");
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(SUPABASE_SETTINGS_UPDATED_EVENT, listener);
  });
});
