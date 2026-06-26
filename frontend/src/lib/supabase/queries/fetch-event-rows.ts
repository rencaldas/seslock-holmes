import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailEventRow } from "@/lib/supabase/types";

const FETCH_BATCH_SIZE = 1000;

async function fetchRowsByTimeColumn(
  client: SupabaseClient,
  eventTable: string,
  cutoffIso: string,
  timeColumn: "timestamp" | "created_at",
) {
  const rows: EmailEventRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from(eventTable)
      .select("*")
      .gte(timeColumn, cutoffIso)
      .order(timeColumn, { ascending: false })
      .range(offset, offset + FETCH_BATCH_SIZE - 1);

    if (error) {
      if (error.message.includes("column") && error.message.includes("does not exist")) {
        throw error;
      }

      throw error;
    }

    const batch = (data ?? []) as EmailEventRow[];
    rows.push(...batch);

    if (batch.length < FETCH_BATCH_SIZE) {
      break;
    }

    offset += FETCH_BATCH_SIZE;
  }

  return rows;
}

export async function fetchEventRowsWithTimeFallback(
  client: SupabaseClient,
  eventTable: string,
  cutoffIso: string,
) {
  try {
    return await fetchRowsByTimeColumn(client, eventTable, cutoffIso, "timestamp");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("column") && message.includes("timestamp") && message.includes("does not exist")) {
      return fetchRowsByTimeColumn(client, eventTable, cutoffIso, "created_at");
    }

    throw error;
  }
}
