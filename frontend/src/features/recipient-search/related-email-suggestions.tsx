import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RelatedEmailSuggestions({
  title = "Emails semelhantes",
  description = "Não encontramos correspondência exata, mas há pesquisas relacionadas que podem ajudar.",
  items,
  onSelect,
}: {
  title?: string;
  description?: string;
  items: Array<{ email: string; count: number }>;
  onSelect: (email: string) => void;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-slate-600">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.email} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3">
            <div>
              <p className="font-medium text-slate-950">{item.email}</p>
              <p className="text-xs text-slate-500">{item.count} ocorrência(s) parecida(s)</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => onSelect(item.email)}>
              Pesquisar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
