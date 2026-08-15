import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAuditLogConfigured, listAuditLog, recordAuditEvent } from "./queries";

describe("checkAuditLogConfigured", () => {
  it("returns false when the table does not exist yet", async () => {
    const client = {
      from: () => ({
        select: () => ({
          limit: () => Promise.resolve({ data: null, error: { code: "42P01", message: "relation does not exist" } }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(checkAuditLogConfigured(client)).resolves.toBe(false);
  });

  it("returns true when the table is reachable", async () => {
    const client = {
      from: () => ({
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(checkAuditLogConfigured(client)).resolves.toBe(true);
  });

  it("propagates unrelated errors", async () => {
    const client = {
      from: () => ({
        select: () => ({
          limit: () => Promise.resolve({ data: null, error: { code: "42501", message: "permission denied" } }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(checkAuditLogConfigured(client)).rejects.toEqual({ code: "42501", message: "permission denied" });
  });
});

describe("listAuditLog", () => {
  it("maps rows to camelCase entries", async () => {
    const row = {
      id: "1",
      actor_id: "user-1",
      actor_label: "someone@example.com",
      actor_type: "user",
      action: "schedule.created",
      resource_type: "report_schedule",
      resource_id: "sched-1",
      metadata: { recipientCount: 2 },
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const order2 = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [row], error: null }) });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    const client = { from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient;

    const result = await listAuditLog(client);

    expect(result).toEqual([
      {
        id: "1",
        actorId: "user-1",
        actorLabel: "someone@example.com",
        actorType: "user",
        action: "schedule.created",
        resourceType: "report_schedule",
        resourceId: "sched-1",
        metadata: { recipientCount: 2 },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("recordAuditEvent", () => {
  it("calls the RPC with the expected params", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await recordAuditEvent(client, { action: "schedule.created", resourceType: "report_schedule", resourceId: "sched-1" });

    expect(rpc).toHaveBeenCalledWith("record_audit_event", {
      p_action: "schedule.created",
      p_resource_type: "report_schedule",
      p_resource_id: "sched-1",
      p_metadata: {},
    });
  });

  it("never throws when the RPC fails (non-fatal by design)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    const client = { rpc } as unknown as SupabaseClient;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      recordAuditEvent(client, { action: "schedule.created", resourceType: "report_schedule" }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
