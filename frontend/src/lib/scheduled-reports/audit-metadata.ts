// Nunca inclui o array recipients, só a contagem — decisão de privacidade,
// ver docs/SECURITY.md#log-de-auditoria-e-origem-do-ator. Entrada frouxa de
// propósito: serve tanto o ScheduleInput tipado quanto o corpo bruto (não
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
