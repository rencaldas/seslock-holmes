// Ordenação da lista de atividade recente.
//
// O fetchOverview que vivia aqui foi removido: ele buscava até 20.000 linhas
// para o navegador e calculava os indicadores em JS. Isso agora acontece no
// banco — ver overview-aggregate.ts e a migration 20260801130000.
//
// sortRecentEvents continua porque descreve a regra de ordenação que a função
// overview_events replica em SQL, incluindo o desempate por destinatário. Se
// algum dia a ordem da lista sair errada, o teste deste arquivo é a referência
// de qual era o comportamento pretendido.

import type { OverviewQueryInput } from "@/lib/supabase/types";

function compareRecipientEmails(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

// O destinatário é sempre o critério de desempate: sem ele, dois eventos com o
// mesmo horário poderiam trocar de posição entre carregamentos idênticos.
export function sortRecentEvents<T extends { occurredAt: string; recipientEmail: string }>(
  events: T[],
  recentActivitySort: OverviewQueryInput["recentActivitySort"],
) {
  return [...events].sort((left, right) => {
    const leftTime = new Date(left.occurredAt).getTime();
    const rightTime = new Date(right.occurredAt).getTime();
    const timeComparison = rightTime - leftTime;

    switch (recentActivitySort) {
      case "time-asc":
        return leftTime - rightTime || compareRecipientEmails(left.recipientEmail, right.recipientEmail);
      case "recipient-asc":
        return compareRecipientEmails(left.recipientEmail, right.recipientEmail) || timeComparison;
      case "recipient-desc":
        return compareRecipientEmails(right.recipientEmail, left.recipientEmail) || timeComparison;
      case "time-desc":
      default:
        return timeComparison || compareRecipientEmails(left.recipientEmail, right.recipientEmail);
    }
  });
}
