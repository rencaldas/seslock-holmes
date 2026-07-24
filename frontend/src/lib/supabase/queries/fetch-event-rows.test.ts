import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { EmailEventRow } from "@/lib/supabase/types";
import { fetchEventRowsWithTimeFallback } from "@/lib/supabase/queries/fetch-event-rows";

function createClientReturning(rows: EmailEventRow[]) {
  const query = {
    gte: vi.fn(),
    lte: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);

  const select = vi.fn().mockReturnValue(query);
  const client = {
    from: vi.fn().mockReturnValue({ select }),
  } as unknown as SupabaseClient;

  return { client, query, select };
}

describe("fetchEventRowsWithTimeFallback", () => {
  it("never requests rows beyond the configured maximum", async () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({
      id: String(index),
      timestamp: "2026-07-24T00:00:00.000Z",
    })) as EmailEventRow[];
    const { client, query, select } = createClientReturning(rows);

    const result = await fetchEventRowsWithTimeFallback(
      client,
      "aws_sns",
      "2026-07-01T00:00:00.000Z",
      {
        maxRows: 100,
        columns: "id,timestamp",
        equals: [{ column: "destination", value: "recipient@example.com" }],
        inValues: [{ column: "eventType", values: ["BOUNCE", "bounced"] }],
      },
    );

    expect(result).toHaveLength(100);
    expect(select).toHaveBeenCalledWith("id,timestamp");
    expect(query.eq).toHaveBeenCalledWith("destination", "recipient@example.com");
    expect(query.in).toHaveBeenCalledWith("eventType", ["BOUNCE", "bounced"]);
    expect(query.range).toHaveBeenCalledOnce();
    expect(query.range).toHaveBeenCalledWith(0, 99);
  });
});
