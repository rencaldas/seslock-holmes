export const ROW_LIMIT_OPTIONS = [100, 500, 1000] as const;

export const UNLIMITED_ROW_LIMIT = "all" as const;

// Teto de segurança para a opção "sem limite". Sem ele, "all" vira
// Number.POSITIVE_INFINITY em fetch-event-rows e a busca pagina a tabela
// inteira em lotes de 1000 — numa tabela de eventos SES, que só cresce, isso
// trava a aba do navegador e ainda processa tudo de forma síncrona na thread
// principal ao montar o analytics.
//
// O teto é aplicado num único ponto (fetchEventRowsWithTimeFallback), então
// vale igualmente para o Overview, a investigação de destinatário e os
// relatórios agendados. Quando ele é atingido o resultado sai incompleto, e
// isso PRECISA ser visível: numa ferramenta de investigação, truncar em
// silêncio faz alguém concluir "não há mais bounces" quando há. Ver
// `resultTruncated` em lib/i18n/messages.ts e TruncationNotice.
export const UNLIMITED_ROW_LIMIT_CAP = 20_000;

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
