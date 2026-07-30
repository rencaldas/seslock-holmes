export const PAGE_SIZE_OPTIONS = [5, 10, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 5;

export function parsePageSize(value: string | null | undefined): PageSize {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed as PageSize) ? (parsed as PageSize) : DEFAULT_PAGE_SIZE;
}
