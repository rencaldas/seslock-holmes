import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/use-i18n";
import { saveEventsTableOverride } from "@/lib/supabase/table-resolution";

export function SetupState({
  title,
  description,
  triedTables,
}: {
  title?: string;
  description: string;
  triedTables: string[];
}) {
  const [value, setValue] = useState("");
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? t.common.setupTitle}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="events-table">{t.common.setupTableLabel}</Label>
          <Input
            id="events-table"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t.common.setupTablePlaceholder}
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            if (!value.trim()) {
              return;
            }
            saveEventsTableOverride(value);
          }}
        >
          {t.common.setupButton}
        </Button>
        {triedTables.length ? (
          <p className="text-sm text-slate-500">
            {t.common.setupTried}: {triedTables.join(", ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
