import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchOverviewAggregate } from "@/lib/supabase/queries/overview-aggregate";

function createRpcClient() {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      totalEventCount: 100,
      sentCount: 50,
      deliveredCount: 45,
      bouncedCount: 3,
      complaintCount: 0,
      delayedCount: 0,
      rejectedCount: 2,
      renderingFailureCount: 0,
      uniqueMessagesCount: 50,
      uniqueRecipientsCount: 40,
      lastEventAt: null,
      averageDeliveryTimeMs: null,
      deliveryRate: 90,
      bounceRate: 3,
      complaintRate: 0,
      topProviders: [],
      topBounceReasons: [],
      originApplications: [],
      timeSeriesGranularity: "day",
      timeSeries: [],
    },
    error: null,
  });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("fetchOverviewAggregate", () => {
  it("never forwards content filters to the metrics RPC, even when the caller has them applied", async () => {
    const { client, rpc } = createRpcClient();
    // Um objeto de filtros completo, como o que a página tem em mãos: os
    // campos além do período não podem vazar para a consulta das métricas.
    const appliedFilters = {
      timeMode: "window" as const,
      windowDays: 7,
      startAt: "",
      endAt: "",
      status: "bounced",
      bounceSubType: "Suppressed",
      origin: "app-x",
      subject: "nota fiscal",
      provider: "gmail.com",
    };

    const result = await fetchOverviewAggregate(client, appliedFilters, "pt-BR");

    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, params] = rpc.mock.calls[0]!;
    expect(name).toBe("overview_analytics");
    expect(params).toMatchObject({ p_status: "all", p_origin: "", p_subject: "", p_provider: "" });
    expect(params).not.toHaveProperty("p_bounce_subtype");
    expect(result.analytics.reputation.bounceRate).toBe(3);
  });

  it("still scopes the metrics to the selected time range", async () => {
    const { client, rpc } = createRpcClient();

    await fetchOverviewAggregate(
      client,
      {
        timeMode: "custom",
        windowDays: 7,
        startAt: "2026-10-01T00:00:00.000Z",
        endAt: "2026-10-08T00:00:00.000Z",
      },
      "pt-BR",
    );

    expect(rpc.mock.calls[0]![1]).toMatchObject({
      p_start: "2026-10-01T00:00:00.000Z",
      p_end: "2026-10-08T00:00:00.000Z",
    });
  });
});
