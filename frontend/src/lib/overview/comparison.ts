export interface MetricDelta {
  // null quando o período anterior teve valor zero e o atual não — variação
  // percentual não é significativa nesse caso ("infinita"), então a UI
  // mostra só a direção, sem número.
  percent: number | null;
  direction: "up" | "down" | "flat";
}

export function computeDelta(current: number, prior: number): MetricDelta {
  if (prior === 0) {
    if (current === 0) {
      return { percent: 0, direction: "flat" };
    }
    return { percent: null, direction: "up" };
  }

  const percent = ((current - prior) / prior) * 100;
  if (percent === 0) {
    return { percent: 0, direction: "flat" };
  }
  return { percent, direction: percent > 0 ? "up" : "down" };
}
