import type { EmailEventType } from "@/lib/supabase/types";
import { getSupabaseLanguage } from "@/lib/supabase/settings";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function formatEventType(value: EmailEventType, language = getSupabaseLanguage()) {
  const isEnglish = language === "en-US";

  switch (value) {
    case "sent":
      return isEnglish ? "Sent" : "Enviado";
    case "delivered":
      return isEnglish ? "Delivered" : "Entregue";
    case "bounced":
      return isEnglish ? "Bounced" : "Bounce";
    case "complained":
      return isEnglish ? "Complaint" : "Reclamação";
    case "delayed":
      return isEnglish ? "Delayed" : "Atrasado";
    case "rejected":
      return isEnglish ? "Rejected" : "Rejeitado";
    case "rendering_failure":
      return isEnglish ? "Rendering failure" : "Falha de renderização";
    default:
      return value;
  }
}

export function isProblemEventType(value: EmailEventType) {
  return value !== "sent" && value !== "delivered";
}

export function toneForEventType(value: EmailEventType): "default" | "success" | "warning" | "destructive" | "muted" {
  switch (value) {
    case "sent":
      return "muted";
    case "delivered":
      return "success";
    case "bounced":
    case "rejected":
    case "rendering_failure":
      return "destructive";
    case "complained":
    case "delayed":
      return "warning";
    default:
      return "muted";
  }
}
