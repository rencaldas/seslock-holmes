export type BounceDiagnosisSeverity = "high" | "medium" | "low";

export interface BounceDiagnosis {
  cause: string;
  recommendation: string;
  severity: BounceDiagnosisSeverity;
  category: string;
}

function normalizeDiagnosticText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function hasAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function diagnosis(
  cause: string,
  recommendation: string,
  severity: BounceDiagnosisSeverity,
  category = cause,
): BounceDiagnosis {
  return { cause, recommendation, severity, category };
}

export function classifyDiagnosticCode(
  diagnosticCode: string | null | undefined,
  bounceType?: string | null,
): BounceDiagnosis | null {
  const text = normalizeDiagnosticText(diagnosticCode);
  const normalizedBounceType = normalizeDiagnosticText(bounceType);

  if (!text) {
    return null;
  }

  if (hasAny(text, [/5\.7\.515/, /dmarc=\s*fail/, /required authentication level/])) {
    return diagnosis(
      "Falha de autenticacao/alinhamento DMARC do remetente",
      "Corrigir autenticacao do dominio remetente no SES: DKIM alinhado ao From, SPF/MAIL FROM alinhado e politica DMARC consistente. Prioridade alta para Outlook, Hotmail e Microsoft 365.",
      "high",
      "Autenticacao do remetente",
    );
  }

  if (hasAny(text, [/5\.7\.51\b/, /tenantinboundattribution/, /restrictdomainstoipaddresses/, /restrictdomainstocertificate/])) {
    return diagnosis(
      "Servidor do destinatario restringe remetentes por conector, IP ou certificado",
      "Pedir ao destinatario para liberar o remetente ou IP do SES, ou revisar o conector Microsoft 365. O bloqueio esta na politica do ambiente receptor.",
      "medium",
      "Politica do destinatario",
    );
  }

  if (hasAny(text, [/5\.4\.14/, /hop count exceeded/, /possible mail loop/])) {
    return diagnosis(
      "Loop de roteamento no e-mail do destinatario",
      "Solicitar ao administrador do dominio destinatario que revise regras de encaminhamento, conectores e roteamento MX.",
      "medium",
      "Roteamento do destinatario",
    );
  }

  if (hasAny(text, [/5\.7\.7/, /email policy violation detected/])) {
    return diagnosis(
      "Bloqueio por politica de e-mail ou antispam do destinatario",
      "Revisar conteudo, anexos, reputacao e autenticacao. Se o envio for transacional legitimo, pedir whitelist ao destinatario.",
      "medium",
      "Politica/antispam",
    );
  }

  if (hasAny(text, [/mailbox is disabled/, /554 30 .*cannot be delivered/])) {
    return diagnosis(
      "Caixa postal desativada",
      "Remover ou atualizar o contato. A conta existe no dominio, mas esta desabilitada para receber.",
      "high",
      "Cadastro do destinatario",
    );
  }

  if (
    hasAny(text, [
      /5\.2\.2/,
      /quotaexceededexception/,
      /inbox is out of storage/,
      /mailbox full/,
      /quota exceeded/,
      /storage is full/,
      /overquot/,
    ])
  ) {
    return diagnosis(
      "Caixa postal cheia ou sem espaco",
      "Tentar novamente depois ou avisar o cliente para liberar espaco. Nao e problema do remetente, mas pode continuar falhando.",
      "medium",
      "Caixa cheia",
    );
  }

  if (hasAny(text, [/invalid domain/, /5\.4\.4/])) {
    return diagnosis(
      "Dominio do e-mail invalido",
      "Corrigir o cadastro do e-mail. Validar digitacao e existencia do dominio antes de reenviar.",
      "high",
      "Cadastro do destinatario",
    );
  }

  if (hasAny(text, [/unable to lookup dns/, /unknown mail server/, /could not find a mail server/, /no mx/, /domain not found/])) {
    return diagnosis(
      "Dominio sem DNS ou MX valido para receber e-mail",
      "Corrigir o dominio no cadastro ou acionar o destinatario para configurar DNS/MX. Reenvio so deve funcionar apos o dominio responder.",
      normalizedBounceType === "permanent" ? "high" : "medium",
      "DNS/MX do destinatario",
    );
  }

  if (hasAny(text, [/failed to establish connection/, /unable to connect to remote host/, /4\.4\.1/])) {
    return diagnosis(
      "Servidor do destinatario indisponivel ou recusando conexao",
      "Reenviar depois e monitorar recorrencia. Se persistir para o mesmo dominio, acionar o administrador do destinatario.",
      "low",
      "Infraestrutura do destinatario",
    );
  }

  if (hasAny(text, [/4\.4\.7/, /message expired/])) {
    return diagnosis(
      "Tempo de entrega expirado apos varias tentativas",
      "Reenviar depois. Se repetir, tratar como problema de infraestrutura ou DNS do destinatario.",
      "low",
      "Timeout de entrega",
    );
  }

  if (
    hasAny(text, [
      /5\.1\.10/,
      /5\.1\.1/,
      /recipientnotfound/,
      /user unknown/,
      /no such user/,
      /no such recipient/,
      /invalid recipient/,
      /mailbox not found/,
      /no mailbox here/,
      /requested mail action aborted, mailbox not found/,
      /user does not exist/,
    ])
  ) {
    return diagnosis(
      "Endereco inexistente ou destinatario nao encontrado",
      "Corrigir ou remover o e-mail no cadastro do parceiro. Este tipo costuma ser bounce permanente.",
      "high",
      "Cadastro do destinatario",
    );
  }

  if (hasAny(text, [/5\.5\.0/, /mailbox unavailable/, /requested action not taken/])) {
    return diagnosis(
      "Caixa postal indisponivel",
      "Validar o endereco com o cliente e tentar novamente. Se persistir, remover ou substituir o contato.",
      "medium",
      "Caixa indisponivel",
    );
  }

  if (hasAny(text, [/5\.4\.1/, /access denied/, /5\.7\.0 recipient rejected/, /tiir502/])) {
    return diagnosis(
      "Destinatario rejeitou por acesso, reputacao ou politica",
      "Revisar reputacao e autenticacao. Se o envio for esperado, pedir liberacao ao destinatario.",
      "medium",
      "Politica do destinatario",
    );
  }

  return diagnosis(
    "Diagnostic code nao classificado automaticamente",
    "Revisar manualmente o diagnosticCode completo e confirmar com o administrador do dominio destinatario.",
    "medium",
    "Revisao manual",
  );
}

export function getDiagnosticSearchText(diagnosticCode: string | null | undefined, bounceType?: string | null) {
  const diagnosisResult = classifyDiagnosticCode(diagnosticCode, bounceType);
  return normalizeDiagnosticText(
    [
      diagnosticCode,
      bounceType,
      diagnosisResult?.cause,
      diagnosisResult?.recommendation,
      diagnosisResult?.category,
      diagnosisResult?.severity,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
