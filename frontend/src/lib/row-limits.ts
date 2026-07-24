export const ROW_LIMIT_OPTIONS = [100, 500, 1000] as const;

export type RowLimit = (typeof ROW_LIMIT_OPTIONS)[number];

export const DEFAULT_ROW_LIMIT: RowLimit = 100;

export function parseRowLimit(value: string | null | undefined): RowLimit {
  const parsed = Number(value);
  return ROW_LIMIT_OPTIONS.includes(parsed as RowLimit) ? (parsed as RowLimit) : DEFAULT_ROW_LIMIT;
}
