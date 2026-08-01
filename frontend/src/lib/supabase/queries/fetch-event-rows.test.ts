import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { EmailEventRow } from "@/lib/supabase/types";
import { fetchEventRowsWithTimeFallback } from "@/lib/supabase/queries/fetch-event-rows";
import { UNLIMITED_ROW_LIMIT_CAP } from "@/lib/row-limits";

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

    expect(result.rows).toHaveLength(100);
    expect(result.truncated).toBe(false);
    expect(select).toHaveBeenCalledWith("id,timestamp");
    expect(query.eq).toHaveBeenCalledWith("destination", "recipient@example.com");
    expect(query.in).toHaveBeenCalledWith("eventType", ["BOUNCE", "bounced"]);
    expect(query.range).toHaveBeenCalledOnce();
    expect(query.range).toHaveBeenCalledWith(0, 99);
  });

  // Sem maxRows (a opção "sem limite" do seletor de linhas) a busca antes
  // usava Number.POSITIVE_INFINITY e paginava a tabela inteira em lotes de
  // 1000, travando a aba. Agora para no teto de segurança.
  it("aplica o teto de segurança quando nenhum maxRows é informado", async () => {
    const batch = Array.from({ length: 1000 }, (_, index) => ({
      id: String(index),
      timestamp: "2026-07-24T00:00:00.000Z",
    })) as EmailEventRow[];
    const { client, query } = createClientReturning(batch);

    const result = await fetchEventRowsWithTimeFallback(client, "aws_sns", "2026-07-01T00:00:00.000Z");

    expect(result.rows).toHaveLength(UNLIMITED_ROW_LIMIT_CAP);
    expect(result.truncated).toBe(true);
    expect(query.range).toHaveBeenCalledTimes(UNLIMITED_ROW_LIMIT_CAP / 1000);
    // Nunca pede além do teto.
    expect(query.range).toHaveBeenLastCalledWith(UNLIMITED_ROW_LIMIT_CAP - 1000, UNLIMITED_ROW_LIMIT_CAP - 1);
  });

  it("não marca truncado quando os dados acabam antes do teto", async () => {
    const rows = Array.from({ length: 42 }, (_, index) => ({
      id: String(index),
      timestamp: "2026-07-24T00:00:00.000Z",
    })) as EmailEventRow[];
    const { client } = createClientReturning(rows);

    const result = await fetchEventRowsWithTimeFallback(client, "aws_sns", "2026-07-01T00:00:00.000Z");

    expect(result.rows).toHaveLength(42);
    expect(result.truncated).toBe(false);
  });

  // Um recorte pedido pelo próprio usuário não é truncagem inesperada: ele
  // escolheu aquele número e o vê no seletor de filtros.
  it("não marca truncado quando o limite veio do usuário", async () => {
    const batch = Array.from({ length: 100 }, (_, index) => ({
      id: String(index),
      timestamp: "2026-07-24T00:00:00.000Z",
    })) as EmailEventRow[];
    const { client } = createClientReturning(batch);

    const result = await fetchEventRowsWithTimeFallback(client, "aws_sns", "2026-07-01T00:00:00.000Z", {
      maxRows: 100,
    });

    expect(result.rows).toHaveLength(100);
    expect(result.truncated).toBe(false);
  });
});
