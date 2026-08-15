// Exportação de relatório (CSV/PDF/JSON) na tela de Investigação:
// downloadBlob() (lib/download-blob.ts) cria um <a download> e clica nele —
// o Chromium trata isso como um download real, capturável pelo evento
// "download" do Playwright, mesmo sem nenhum servidor de arquivos por trás.
import { test, expect } from "@playwright/test";
import { mockAuth, mockOverviewData, FIXTURE_RECIPIENT_EMAIL } from "./fixtures/supabase-mock";

test("downloads a CSV report for the current search", async ({ page }) => {
  await mockAuth(page);
  await mockOverviewData(page);

  await page.goto(`/investigate?query=${encodeURIComponent(FIXTURE_RECIPIENT_EMAIL)}`);
  await expect(page.getByText("Bem-vindo")).toBeVisible();

  await page.getByText("Gerar relatório").click();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByText("Baixar CSV").click()]);

  expect(download.suggestedFilename()).toMatch(/^relatorio-emails-.*\.csv$/);
});
