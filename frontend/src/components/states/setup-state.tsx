import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEventsTableOverride } from "@/lib/supabase/table-resolution";

export function SetupState({
  title = "Configurar origem dos dados",
  description,
  triedTables,
}: {
  title?: string;
  description: string;
  triedTables: string[];
}) {
  const [value, setValue] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="events-table">Nome da tabela ou view de eventos</Label>
          <Input
            id="events-table"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="por exemplo: email_events ou ses_events_view"
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            if (!value.trim()) {
              return;
            }
            saveEventsTableOverride(value);
            window.location.reload();
          }}
        >
          Salvar e recarregar
        </Button>
        {triedTables.length ? (
          <p className="text-sm text-slate-500">
            Tentativas: {triedTables.join(", ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
