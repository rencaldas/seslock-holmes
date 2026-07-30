import type { TranslationBundle } from "@/lib/i18n/types";
import type { ScheduleFrequency } from "@/lib/scheduled-reports/types";

export function describeFrequency(frequency: ScheduleFrequency, t: TranslationBundle) {
  const text = t.scheduledReports.frequencyText;
  const dayName = text.dayNames[frequency.dayOfWeek ?? 0] ?? text.dayNames[0];

  if (frequency.type === "daily") {
    return text.daily.replace("{time}", frequency.time);
  }
  if (frequency.type === "weekly") {
    return text.weekly.replace("{day}", dayName).replace("{time}", frequency.time);
  }
  return text.monthly.replace("{day}", String(frequency.dayOfMonth ?? 1)).replace("{time}", frequency.time);
}

export const DEFAULT_FREQUENCY: ScheduleFrequency = {
  type: "weekly",
  time: "12:00",
  dayOfWeek: 1,
};
