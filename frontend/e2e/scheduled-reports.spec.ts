// CRUD de agendamentos na tela de Relatórios Agendados, pelo caminho
// direto-Supabase (queries.ts) — força isDefaultProject=false salvando uma
// URL/anonKey em Configurações antes de navegar, o que evita ter que também
// mockar o token de admin e a rota /api/schedules (caminho do projeto
// padrão). Mantém um array em memória no próprio handler de rota para que
// GET reflita create/update/delete subsequentes, como uma tabela de verdade.
import { test, expect, type Route } from "@playwright/test";
import { mockAuth } from "./fixtures/supabase-mock";

const STORAGE_KEY = "seslock-holmes.supabase.settings";

function scheduleRow(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Relatório E2E",
    is_active: true,
    events_table: "aws_sns",
    filters: { windowDays: 7, status: "all", origin: "", subject: "", provider: "", rowLimit: 100, sortBy: "email" },
    recipients: ["qa@example.com"],
    frequency: { type: "daily", time: "08:00" },
    timezone: "America/Sao_Paulo",
    next_run_at: now,
    last_run_at: null,
    last_run_status: null,
    last_run_error: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

test("creates, pauses, and deletes a schedule", async ({ page }) => {
  await mockAuth(page);
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: STORAGE_KEY,
      value: JSON.stringify({ url: "https://dummy-project.supabase.co", anonKey: "e2e-dummy-anon-key", eventsTable: "aws_sns" }),
    },
  );

  await page.route("**/rest/v1/rpc/record_audit_event**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });

  const schedules: Array<Record<string, unknown>> = [];

  await page.route("**/rest/v1/report_schedules**", async (route: Route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(schedules) });
      return;
    }
    if (request.method() === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      const row = scheduleRow({ name: body.name, recipients: body.recipients, frequency: body.frequency, filters: body.filters });
      schedules.push(row);
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(row) });
      return;
    }
    if (request.method() === "PATCH") {
      const body = JSON.parse(request.postData() ?? "{}");
      Object.assign(schedules[0]!, body);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(schedules[0]) });
      return;
    }
    if (request.method() === "DELETE") {
      schedules.length = 0;
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  });

  await page.goto("/scheduled-reports");

  await page.getByRole("button", { name: /novo agendamento/i }).click();
  await page.locator("#schedule-name").fill("Relatório E2E");
  await page.locator("#schedule-recipients").fill("qa@example.com");
  await page.locator("#schedule-recipients").press("Enter");
  await page.getByRole("button", { name: /salvar/i }).click();

  await expect(page.getByText("Relatório E2E")).toBeVisible();

  await page.getByRole("button", { name: /pausar/i }).click();
  await expect(page.getByText(/pausado/i)).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: /excluir/i }).click();

  await expect(page.getByText("Relatório E2E")).toBeHidden();
});
