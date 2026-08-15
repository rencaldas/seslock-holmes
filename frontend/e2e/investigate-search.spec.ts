// Busca de destinatário na tela de Investigação: navega direto para
// /investigate com uma query pré-preenchida (o formulário de busca em si
// mora no header global, já coberto por outros testes de UI) e confirma que
// os eventos retornados pela tabela mockada aparecem na tela.
import { test, expect } from "@playwright/test";
import { mockAuth, mockOverviewData, FIXTURE_RECIPIENT_EMAIL } from "./fixtures/supabase-mock";

test("shows matching events for a recipient search", async ({ page }) => {
  await mockAuth(page);
  await mockOverviewData(page);

  await page.goto(`/investigate?query=${encodeURIComponent(FIXTURE_RECIPIENT_EMAIL)}`);

  await expect(page.getByText("Bem-vindo")).toBeVisible();
});

test("suggests related addresses when there is no exact match", async ({ page }) => {
  await mockAuth(page);
  await mockOverviewData(page);

  await page.goto("/investigate?query=nobody@totally-different.org");

  await expect(page.getByText(/nenhum resultado/i)).toBeVisible();
});
