import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/use-i18n";

export function RelatedEmailSuggestions({
  title,
  description,
  items,
  onSelect,
}: {
  title?: string;
  description?: string;
  items: Array<{ email: string; count: number }>;
  onSelect: (email: string) => void;
}) {
  const t = useI18n();

  if (!items.length) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
      <CardHeader>
        <CardTitle>{title ?? t.investigation.relatedEmailsTitle}</CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-300">{description ?? t.investigation.relatedEmailsDescription}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.email} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 dark:border-amber-500/30 dark:bg-slate-900">
            <div>
              <p className="font-medium text-slate-950 dark:text-slate-50">{item.email}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.count} {t.investigation.relatedEmailOccurrences}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => onSelect(item.email)}>
              {t.investigation.relatedEmailButton}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
