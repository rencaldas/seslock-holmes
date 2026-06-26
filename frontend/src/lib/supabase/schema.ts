import { getSupabaseEnv } from "@/lib/env";

export function getEventTable() {
  const env = getSupabaseEnv();
  return env?.eventsTable ?? "aws_sns";
}
