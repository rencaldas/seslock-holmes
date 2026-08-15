import { parsePositiveNumber } from "@/lib/utils";
import type { TimeFilterMode } from "@/lib/supabase/types";

export interface TimeFilterState {
  timeMode: TimeFilterMode;
  windowDays: number;
  startAt: string;
  endAt: string;
}

function parseIsoDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function buildDefaultCustomRange(windowDays: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - windowDays);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export function parseTimeFilterState(searchParams: URLSearchParams): TimeFilterState {
  const windowDays = parsePositiveNumber(searchParams.get("windowDays"));
  const timeMode = searchParams.get("timeMode") === "custom" ? "custom" : "window";
  const startAt = searchParams.get("startAt") ?? "";
  const endAt = searchParams.get("endAt") ?? "";

  if (timeMode === "custom" && (!startAt || !endAt)) {
    return {
      timeMode,
      windowDays,
      ...buildDefaultCustomRange(windowDays),
    };
  }

  return {
    timeMode,
    windowDays,
    startAt,
    endAt,
  };
}

export function resolveTimeRange(filters: TimeFilterState) {
  if (filters.timeMode === "custom") {
    const startIso = parseIsoDateTime(filters.startAt);
    const endIso = parseIsoDateTime(filters.endAt);
    if (startIso && endIso && endIso >= startIso) {
      return { startIso, endIso };
    }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - filters.windowDays);
  return { startIso: cutoff.toISOString() };
}

// Mesma resolução de resolveTimeRange, mas sempre com um fim explícito — em
// modo "window" o fim aberto normalmente é "agora" no momento em que a query
// roda no banco; aqui fixamos em `asOf` para poder calcular a janela anterior
// de mesma duração sem ambiguidade.
function resolveClosedTimeRange(filters: TimeFilterState, asOf: Date): { startIso: string; endIso: string } {
  if (filters.timeMode === "custom") {
    const startIso = parseIsoDateTime(filters.startAt);
    const endIso = parseIsoDateTime(filters.endAt);
    if (startIso && endIso && endIso >= startIso) {
      return { startIso, endIso };
    }
  }

  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - filters.windowDays);
  return { startIso: cutoff.toISOString(), endIso: asOf.toISOString() };
}

// Janela imediatamente anterior à atual, com a mesma duração — usada pela
// comparação "vs período anterior" no Overview. Chama a mesma
// overview_analytics já usada para a janela atual, só que com bounds
// diferentes, em vez de alargar a assinatura da RPC (ver comentário em
// fetchOverviewAggregate sobre o risco de quebrar o Overview inteiro ao
// adicionar parâmetros novos antes da migration estar confirmada).
export function resolvePriorTimeRange(filters: TimeFilterState, asOf: Date = new Date()): { startIso: string; endIso: string } {
  const current = resolveClosedTimeRange(filters, asOf);
  const durationMs = new Date(current.endIso).getTime() - new Date(current.startIso).getTime();
  const priorEnd = new Date(current.startIso);
  const priorStart = new Date(priorEnd.getTime() - durationMs);
  return { startIso: priorStart.toISOString(), endIso: priorEnd.toISOString() };
}
