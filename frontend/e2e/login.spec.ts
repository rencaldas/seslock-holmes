// Fluxo de login: uma consulta negada por permissão deve mostrar a tela de
// login (ver isPermissionDeniedError em lib/supabase/auth.ts), e submeter
// credenciais válidas deve fazer a sessão aparecer e a tela de login sumir.
// Não valida o conteúdo do dashboard pós-login (a query da Overview
// continua mockada como negada nesta suíte) — só o próprio mecanismo de
// entrada/saída da tela de login, que é o que este teste existe para cobrir.
import { test, expect } from "@playwright/test";
import { mockAuth, mockPermissionDenied } from "./fixtures/supabase-mock";

test("shows the login screen when a query is denied, and clears it after signing in", async ({ page }) => {
  await mockAuth(page);
  await mockPermissionDenied(page);

  await page.goto("/");

  const emailInput = page.locator("#login-email");
  await expect(emailInput).toBeVisible();

  await emailInput.fill("e2e@example.com");
  await page.locator("#login-password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: /entrar/i }).click();

  await expect(emailInput).toBeHidden();
});
