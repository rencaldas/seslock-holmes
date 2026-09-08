// Sem nenhum import de propósito: este módulo também é consumido pelo runner
// server-only de relatórios agendados (lib/scheduled-reports/report-runner.ts),
// que só pode importar valores via caminho relativo com extensão .js — um
// import daqui não pode arrastar nada que dependa do alias `@/`.

export const BOUNCE_RATE_ATTENTION_PERCENT = 2;
export const BOUNCE_RATE_CRITICAL_PERCENT = 5;
export const COMPLAINT_RATE_ATTENTION_PERCENT = 0.1;
export const COMPLAINT_RATE_CRITICAL_PERCENT = 0.3;

export type ReputationStatus = "healthy" | "attention" | "critical";

export function getReputationStatus(bounceRate: number, complaintRate: number): ReputationStatus {
  if (bounceRate > BOUNCE_RATE_CRITICAL_PERCENT || complaintRate > COMPLAINT_RATE_CRITICAL_PERCENT) {
    return "critical";
  }

  if (bounceRate >= BOUNCE_RATE_ATTENTION_PERCENT || complaintRate > COMPLAINT_RATE_ATTENTION_PERCENT) {
    return "attention";
  }

  return "healthy";
}
