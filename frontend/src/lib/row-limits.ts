export const ROW_LIMIT_OPTIONS = [100, 500, 1000] as const;

export const UNLIMITED_ROW_LIMIT = "all" as const;

type NumericRowLimit = (typeof ROW_LIMIT_OPTIONS)[number];

export type RowLimit = NumericRowLimit | typeof UNLIMITED_ROW_LIMIT;

export const DEFAULT_ROW_LIMIT: RowLimit = 100;

export function parseRowLimit(value: string | null | undefined): RowLimit {
  if (value === UNLIMITED_ROW_LIMIT) {
    return UNLIMITED_ROW_LIMIT;
  }

  const parsed = Number(value);
  return ROW_LIMIT_OPTIONS.includes(parsed as NumericRowLimit) ? (parsed as NumericRowLimit) : DEFAULT_ROW_LIMIT;
}
