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
      "Falha de autenticação/alinhamento DMARC do remetente",
      "Corrigir autenticação do domínio remetente no SES: DKIM alinhado ao From, SPF/MAIL FROM alinhado e política DMARC consistente. Prioridade alta para Outlook, Hotmail e Microsoft 365.",
      "high",
      "Autenticação do remetente",
    );
  }

  if (hasAny(text, [/5\.7\.51\b/, /tenantinboundattribution/, /restrictdomainstoipaddresses/, /restrictdomainstocertificate/])) {
    return diagnosis(
      "Servidor do destinatário restringe remetentes por conector, IP ou certificado",
      "Pedir ao destinatário para liberar o remetente ou IP do SES, ou revisar o conector Microsoft 365. O bloqueio está na política do ambiente receptor.",
      "medium",
      "Política do destinatário",
    );
  }

  if (hasAny(text, [/5\.4\.14/, /hop count exceeded/, /possible mail loop/])) {
    return diagnosis(
      "Loop de roteamento no e-mail do destinatário",
      "Solicitar ao administrador do domínio destinatário que revise regras de encaminhamento, conectores e roteamento MX.",
      "medium",
      "Roteamento do destinatário",
    );
  }

  if (hasAny(text, [/5\.7\.7/, /email policy violation detected/])) {
    return diagnosis(
      "Bloqueio por política de e-mail ou antispam do destinatário",
      "Revisar conteúdo, anexos, reputação e autenticação. Se o envio for transacional legítimo, pedir whitelist ao destinatário.",
      "medium",
      "Política/antispam",
    );
  }

  if (hasAny(text, [/mailbox is disabled/, /554 30 .*cannot be delivered/])) {
    return diagnosis(
      "Caixa postal desativada",
      "Remover ou atualizar o contato. A conta existe no domínio, mas está desabilitada para receber.",
      "high",
      "Cadastro do destinatário",
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
      "Caixa postal cheia ou sem espaço",
      "Tentar novamente depois ou avisar o cliente para liberar espaço. Não é problema do remetente, mas pode continuar falhando.",
      "medium",
      "Caixa cheia",
    );
  }

  if (hasAny(text, [/invalid domain/, /5\.4\.4/])) {
    return diagnosis(
      "Domínio do e-mail inválido",
      "Corrigir o cadastro do e-mail. Validar digitação e existência do domínio antes de reenviar.",
      "high",
      "Cadastro do destinatário",
    );
  }

  if (hasAny(text, [/unable to lookup dns/, /unknown mail server/, /could not find a mail server/, /no mx/, /domain not found/])) {
    return diagnosis(
      "Domínio sem DNS ou MX válido para receber e-mail",
      "Corrigir o domínio no cadastro ou acionar o destinatário para configurar DNS/MX. Reenvio só deve funcionar após o domínio responder.",
      normalizedBounceType === "permanent" ? "high" : "medium",
      "DNS/MX do destinatário",
    );
  }

  if (hasAny(text, [/failed to establish connection/, /unable to connect to remote host/, /4\.4\.1/])) {
    return diagnosis(
      "Servidor do destinatário indisponível ou recusando conexão",
      "Reenviar depois e monitorar recorrência. Se persistir para o mesmo domínio, acionar o administrador do destinatário.",
      "low",
      "Infraestrutura do destinatário",
    );
  }

  if (hasAny(text, [/4\.4\.7/, /message expired/])) {
    return diagnosis(
      "Tempo de entrega expirado após várias tentativas",
      "Reenviar depois. Se repetir, tratar como problema de infraestrutura ou DNS do destinatário.",
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
      "Endereço inexistente ou destinatário não encontrado",
      "Corrigir ou remover o e-mail no cadastro do parceiro. Este tipo costuma ser bounce permanente.",
      "high",
      "Cadastro do destinatário",
    );
  }

  if (hasAny(text, [/5\.5\.0/, /mailbox unavailable/, /requested action not taken/])) {
    return diagnosis(
      "Caixa postal indisponível",
      "Validar o endereço com o cliente e tentar novamente. Se persistir, remover ou substituir o contato.",
      "medium",
      "Caixa indisponível",
    );
  }

  if (hasAny(text, [/5\.4\.1/, /access denied/, /5\.7\.0 recipient rejected/, /tiir502/])) {
    return diagnosis(
      "Destinatário rejeitou por acesso, reputação ou política",
      "Revisar reputação e autenticação. Se o envio for esperado, pedir liberação ao destinatário.",
      "medium",
      "Política do destinatário",
    );
  }

  return diagnosis(
    "Diagnostic code não classificado automaticamente",
    "Revisar manualmente o diagnosticCode completo e confirmar com o administrador do domínio destinatário.",
    "medium",
    "Revisão manual",
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
