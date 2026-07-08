import { describe, expect, it } from "vitest";
import { classifyDiagnosticCode, getDiagnosticSearchText } from "./bounce-diagnostics";

describe("classifyDiagnosticCode", () => {
  it("classifies Microsoft DMARC authentication failures", () => {
    const diagnosis = classifyDiagnosticCode(
      "smtp; 550 5.7.515 Access denied, sending domain RAMADA.COM.BR doesn't meet the required authentication level. Spf= Pass , Dkim= Pass , DMARC= Fail",
    );

    expect(diagnosis?.category).toBe("Autenticacao do remetente");
    expect(diagnosis?.severity).toBe("high");
  });

  it("classifies unknown recipients and invalid recipient text as a cadastro problem", () => {
    const diagnosis = classifyDiagnosticCode("smtp; 550 Invalid recipient: <nfe.fornecedor@example.com>");

    expect(diagnosis?.cause).toBe("Endereco inexistente ou destinatario nao encontrado");
    expect(diagnosis?.severity).toBe("high");
  });

  it("classifies full mailboxes as retryable recipient-side issues", () => {
    const diagnosis = classifyDiagnosticCode("smtp;554 5.2.2 mailbox full; QuotaExceededException");

    expect(diagnosis?.category).toBe("Caixa cheia");
    expect(diagnosis?.severity).toBe("medium");
  });

  it("adds human-readable causes to the diagnostic search text", () => {
    const searchText = getDiagnosticSearchText("smtp; 552 1 Requested mail action aborted, mailbox not found");

    expect(searchText).toContain("mailbox not found");
    expect(searchText).toContain("endereco inexistente");
  });
});
