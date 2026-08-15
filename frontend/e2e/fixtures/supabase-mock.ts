// Ajuda a interceptar as chamadas de rede que o app faria a um projeto
// Supabase real, para exercitar os fluxos reais de componentes/queries sem
// precisar de um projeto de verdade nem de segredos em CI. `page.route()`
// intercepta antes de qualquer resolução de DNS — funciona mesmo com um
// domínio fictício (ver DUMMY_SUPABASE_URL em playwright.config.ts). Precisa
// ser https:// para não violar a CSP em enforcement (connect-src 'self'
// https:), embora a interceptação nunca chegue a sair do processo.
import type { Page } from "@playwright/test";

export interface MockUser {
  id: string;
  email: string;
}

const DEFAULT_USER: MockUser = { id: "11111111-1111-4111-8111-111111111111", email: "e2e@example.com" };

function authTokenResponse(user: MockUser) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    access_token: "e2e-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: nowSeconds + 3600,
    refresh_token: "e2e-refresh-token",
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

// Mocka login (POST /auth/v1/token) e a checagem de papel (RPC
// current_user_role, ver 20260814090000_user_roles_rbac.sql) sempre como
// manager — o hook useUserRole já tem "manager" como fallback quando a RPC
// falha, mas mockar deixa o teste silencioso em vez de gerar erros de rede
// esperados no console.
export async function mockAuth(page: Page, user: MockUser = DEFAULT_USER) {
  await page.route("**/auth/v1/token?grant_type=password**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(authTokenResponse(user)) });
  });

  await page.route("**/rest/v1/rpc/current_user_role**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("manager") });
  });
}

// Simula uma consulta negada por RLS (ver isPermissionDeniedError em
// lib/supabase/auth.ts) — é isso que faz a tela de login aparecer. Mocka
// tanto a RPC de overview quanto a leitura direta da tabela de eventos, já
// que dependendo da rota qualquer uma pode ser a primeira chamada.
export async function mockPermissionDenied(page: Page) {
  const body = JSON.stringify({ code: "42501", message: "permission denied for table aws_sns" });
  await page.route("**/rest/v1/rpc/overview_analytics**", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body });
  });
  await page.route("**/rest/v1/rpc/overview_events**", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body });
  });
  await page.route("**/rest/v1/aws_sns**", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body });
  });
}

function fixtureAggregate() {
  return {
    totalEventCount: 3,
    sentCount: 3,
    deliveredCount: 2,
    bouncedCount: 1,
    complaintCount: 0,
    delayedCount: 0,
    rejectedCount: 0,
    renderingFailureCount: 0,
    uniqueMessagesCount: 3,
    uniqueRecipientsCount: 2,
    lastEventAt: new Date().toISOString(),
    averageDeliveryTimeMs: 1500,
    deliveryRate: 66.7,
    bounceRate: 33.3,
    complaintRate: 0,
    topProviders: [{ domain: "example.com", totalCount: 3, deliveredCount: 2, bouncedCount: 1, bounceRate: 33.3 }],
    topBounceReasons: [{ label: "Mailbox full", count: 1, percentage: 100 }],
    originApplications: [{ name: "app", count: 3 }],
    timeSeriesGranularity: "hour",
    timeSeries: [],
  };
}

export const FIXTURE_RECIPIENT_EMAIL = "visitor@example.com";

function fixtureEventRow(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: "11111111-1111-4111-8111-000000000001",
    created_at: now,
    timestamp: now,
    messageId: "msg-1",
    snsMessageId: "sns-1",
    eventType: "Delivery",
    notificationType: "Delivery",
    subject: "Bem-vindo",
    source: "app@example.com",
    fromAddress: "app@example.com",
    sourceIp: null,
    callerIdentity: null,
    configurationSet: null,
    projectTag: null,
    sourceArn: null,
    snsTopicArn: null,
    sesTags: null,
    destination: [FIXTURE_RECIPIENT_EMAIL],
    destinations: null,
    bounceType: null,
    bounceSubType: null,
    bouncedRecipients: null,
    diagnosticCode: null,
    remoteMtaIp: null,
    reportingMta: null,
    smtpResponse: null,
    deliveryProcessingTimeMillis: 900,
    complaintFeedbackType: null,
    complainedRecipients: null,
    userAgent: null,
    ...overrides,
  };
}

// Mocka os dados usados pela Visão Geral: a RPC agregada e a página de
// atividade recente. Passe `eventRows` para alimentar telas (Investigate)
// que leem a tabela de eventos diretamente em vez de via RPC.
export async function mockOverviewData(page: Page, options: { eventRows?: Array<Record<string, unknown>> } = {}) {
  await page.route("**/rest/v1/rpc/overview_analytics**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixtureAggregate()) });
  });
  await page.route("**/rest/v1/rpc/overview_events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], totalCount: 0 }),
    });
  });

  const rows = options.eventRows ?? [fixtureEventRow()];
  await page.route("**/rest/v1/aws_sns**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
  });
}

export { fixtureEventRow };
