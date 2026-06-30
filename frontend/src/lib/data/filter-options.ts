import type { EmailEventType } from "@/lib/supabase/types";
import type { RecipientSearchMode } from "@/lib/supabase/types";

export const windowDayOptions = [
  { label: "Últimas 24 horas", value: "1" },
  { label: "Últimos 7 dias", value: "7" },
  { label: "Últimos 30 dias", value: "30" },
  { label: "Últimos 90 dias", value: "90" },
] as const;

export const eventStatusOptions: Array<{ label: string; value: "all" | EmailEventType }> = [
  { label: "Todos", value: "all" },
  { label: "Enviado", value: "sent" },
  { label: "Entregue", value: "delivered" },
  { label: "Bounce", value: "bounced" },
  { label: "Reclamação", value: "complained" },
  { label: "Atrasado", value: "delayed" },
  { label: "Rejeitado", value: "rejected" },
  { label: "Falha de renderização", value: "rendering_failure" },
];

export const recipientSearchModeOptions: Array<{ label: string; value: RecipientSearchMode }> = [
  { label: "Destinatário", value: "recipient" },
  { label: "Remetente", value: "sender" },
  { label: "Origem", value: "origin" },
];
