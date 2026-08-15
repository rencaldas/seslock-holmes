// Metadata do audit log nunca inclui o array recipients — só a contagem (ver
// nota de PII em supabase/migrations/20260814100000_audit_log.sql). Usado
// tanto pelo caminho direto-Supabase (queries.ts) quanto pela rota
// admin-token (api/schedules.ts, via import relativo com extensão .js — ver
// a mesma convenção em report-runner.ts). Aceita entrada frouxa de propósito:
// serve tanto para o ScheduleInput já tipado quanto para o corpo bruto (não
// validado) de uma requisição HTTP.
export function scheduleAuditMetadata(input: { name?: unknown; recipients?: unknown; frequency?: unknown }) {
  const recipients = Array.isArray(input.recipients) ? input.recipients : [];
  const frequency = input.frequency as { type?: string } | undefined;
  return {
    scheduleName: typeof input.name === "string" ? input.name : undefined,
    recipientCount: recipients.length,
    frequencyType: frequency?.type,
  };
}
