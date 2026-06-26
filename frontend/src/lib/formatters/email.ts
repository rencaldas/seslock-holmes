import type { EmailEventType } from "@/lib/supabase/types";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function formatEventType(value: EmailEventType) {
  switch (value) {
    case "sent":
      return "Enviado";
    case "delivered":
      return "Entregue";
    case "bounced":
      return "Bounce";
    case "complained":
      return "Reclamação";
    case "delayed":
      return "Atrasado";
    case "rejected":
      return "Rejeitado";
    case "rendering_failure":
      return "Falha de renderização";
    default:
      return value;
  }
}

export function isProblemEventType(value: EmailEventType) {
  return value !== "sent" && value !== "delivered";
}
