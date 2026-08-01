import { describe, expect, it } from "vitest";
import { buildOverviewAnalyticsFromAggregate, type OverviewAggregate } from "./analytics";

// Molde com números plausíveis da base real (janela de 30 dias), para os
// testes falarem de valores reconhecíveis em vez de 1, 2, 3.
function aggregate(overrides: Partial<OverviewAggregate> = {}): OverviewAggregate {
  return {
    totalEventCount: 99012,
    sentCount: 46451,
    deliveredCount: 44604,
    bouncedCount: 2986,
    complaintCount: 0,
    delayedCount: 4961,
    rejectedCount: 0,
    renderingFailureCount: 0,
    uniqueMessagesCount: 47421,
    uniqueRecipientsCount: 7439,
    lastEventAt: "2026-08-01T14:46:03.893Z",
    averageDeliveryTimeMs: 0,
    deliveryRate: 96.02,
    bounceRate: 3.01,
    complaintRate: 0,
    topProviders: [
      { domain: "gmail.com", totalCount: 500, deliveredCount: 480, bouncedCount: 20, bounceRate: 4 },
    ],
    topBounceReasons: [
      { label: "Suppressed", count: 1489, percentage: 49.95 },
      { label: "MailboxFull", count: 290, percentage: 9.73 },
    ],
    originApplications: [{ name: "ses-events", count: 99012 }],
    ...overrides,
  };
}

describe("buildOverviewAnalyticsFromAggregate", () => {
  it("repassa as contagens do banco sem recalcular", () => {
    const result = buildOverviewAnalyticsFromAggregate(aggregate(), "pt-BR");

    expect(result.totalEventCount).toBe(99012);
    expect(result.sentCount).toBe(46451);
    expect(result.deliveredCount).toBe(44604);
    expect(result.bouncedCount).toBe(2986);
    expect(result.delayedCount).toBe(4961);
    expect(result.uniqueRecipientsCount).toBe(7439);
    expect(result.deliveryRate).toBe(96.02);
  });

  // A UI itera esta lista na ordem para desenhar o donut; trocar a ordem
  // trocaria as fatias de lugar sem nenhum dado ter mudado.
  it("monta a distribuição na ordem fixa esperada pela UI", () => {
    const result = buildOverviewAnalyticsFromAggregate(aggregate(), "pt-BR");

    expect(result.eventDistribution.map((entry) => entry.type)).toEqual([
      "sent",
      "delivered",
      "bounced",
      "complained",
      "rejected",
      "delayed",
      "rendering_failure",
      "open",
      "click",
    ]);
  });

  // O SES emite open/click, mas a tabela não os recebe. O cálculo original
  // fixava zero; manter isso evita que a UI mostre buraco ou NaN.
  it("mantém open e click em zero", () => {
    const result = buildOverviewAnalyticsFromAggregate(aggregate(), "pt-BR");
    const porTipo = new Map(result.eventDistribution.map((entry) => [entry.type, entry.count]));

    expect(porTipo.get("open")).toBe(0);
    expect(porTipo.get("click")).toBe(0);
    expect(porTipo.get("sent")).toBe(46451);
    expect(porTipo.get("delayed")).toBe(4961);
  });

  it("traduz os rótulos da distribuição conforme o idioma", () => {
    const pt = buildOverviewAnalyticsFromAggregate(aggregate(), "pt-BR");
    const en = buildOverviewAnalyticsFromAggregate(aggregate(), "en-US");

    expect(pt.eventDistribution[0]!.label).toBe("Enviado");
    expect(en.eventDistribution[0]!.label).toBe("Sent");
  });

  // O SQL devolve só o rótulo cru vindo do SES ("MailboxFull"); o texto
  // legível é resolvido no JS, que é onde as traduções vivem. É justamente
  // por isso que a tradução não foi para o banco: duplicá-la em SQL exigiria
  // mantê-la em sincronia com a do frontend.
  it("traduz o detalhe de cada motivo de bounce, preservando contagem e percentual", () => {
    const pt = buildOverviewAnalyticsFromAggregate(aggregate(), "pt-BR");
    const en = buildOverviewAnalyticsFromAggregate(aggregate(), "en-US");

    expect(pt.topBounceReasons).toHaveLength(2);
    expect(pt.topBounceReasons[0]!.label).toBe("Suppressed");
    expect(pt.topBounceReasons[0]!.count).toBe(1489);
    expect(pt.topBounceReasons[0]!.percentage).toBe(49.95);

    expect(pt.topBounceReasons[1]!.label).toBe("MailboxFull");
    expect(pt.topBounceReasons[1]!.detail).toBe("Caixa do email cheia");
    expect(en.topBounceReasons[1]!.detail).not.toBe(pt.topBounceReasons[1]!.detail);
  });

  describe("reputação", () => {
    it("é saudável abaixo dos limiares", () => {
      const result = buildOverviewAnalyticsFromAggregate(
        aggregate({ bounceRate: 1.5, complaintRate: 0.05 }),
        "pt-BR",
      );
      expect(result.reputation.status).toBe("healthy");
    });

    // 2% é o limite inferior INCLUSIVO da zona de atenção (bounceRate >= 2).
    it("entra em atenção exatamente em 2% de bounce", () => {
      expect(
        buildOverviewAnalyticsFromAggregate(aggregate({ bounceRate: 2, complaintRate: 0 }), "pt-BR")
          .reputation.status,
      ).toBe("attention");
      expect(
        buildOverviewAnalyticsFromAggregate(aggregate({ bounceRate: 1.99, complaintRate: 0 }), "pt-BR")
          .reputation.status,
      ).toBe("healthy");
    });

    // Já o crítico é EXCLUSIVO (> 5), então 5 ainda é atenção.
    it("só vira crítico acima de 5% de bounce", () => {
      expect(
        buildOverviewAnalyticsFromAggregate(aggregate({ bounceRate: 5, complaintRate: 0 }), "pt-BR")
          .reputation.status,
      ).toBe("attention");
      expect(
        buildOverviewAnalyticsFromAggregate(aggregate({ bounceRate: 5.01, complaintRate: 0 }), "pt-BR")
          .reputation.status,
      ).toBe("critical");
    });

    it("fica crítico por reclamação mesmo com bounce baixo", () => {
      const result = buildOverviewAnalyticsFromAggregate(
        aggregate({ bounceRate: 0.1, complaintRate: 0.4 }),
        "pt-BR",
      );
      expect(result.reputation.status).toBe("critical");
    });

    it("leva a justificativa no idioma pedido", () => {
      const pt = buildOverviewAnalyticsFromAggregate(aggregate({ bounceRate: 6 }), "pt-BR");
      const en = buildOverviewAnalyticsFromAggregate(aggregate({ bounceRate: 6 }), "en-US");

      expect(pt.reputation.reason).toBe("Bounce acima do recomendado");
      expect(en.reputation.reason).toBe("Bounce rate is above the recommended threshold");
    });
  });

  it("sobrevive a listas ausentes no retorno do banco", () => {
    const parcial = aggregate();
    // @ts-expect-error simula um retorno sem as listas, que o jsonb_agg
    // devolveria como null se o coalesce da função falhasse.
    parcial.topProviders = null;
    // @ts-expect-error idem
    parcial.topBounceReasons = null;
    // @ts-expect-error idem
    parcial.originApplications = null;

    const result = buildOverviewAnalyticsFromAggregate(parcial, "pt-BR");

    expect(result.topProviders).toEqual([]);
    expect(result.topBounceReasons).toEqual([]);
    expect(result.originApplications).toEqual([]);
  });
});
