import type { EmailEvent, EmailEventType, EmailEventRow } from "@/lib/supabase/types";
import { classifyDiagnosticCode } from "@/lib/supabase/bounce-diagnostics";

const EVENT_TYPE_MAP: Record<string, EmailEventType> = {
  sent: "sent",
  delivery: "delivered",
  delivered: "delivered",
  bounce: "bounced",
  bounced: "bounced",
  complaint: "complained",
  complained: "complained",
  delay: "delayed",
  delayed: "delayed",
  reject: "rejected",
  rejected: "rejected",
  renderingfailure: "rendering_failure",
  rendering_failure: "rendering_failure",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function summarizeArn(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) {
    return "";
  }

  const fragment = text.split(":").pop() ?? text;
  return fragment.split("/").pop() ?? fragment;
}

function toEmailList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return entry.trim() ? [entry.trim()] : [];
    }

    if (isRecord(entry)) {
      const candidate =
        (typeof entry.emailAddress === "string" && entry.emailAddress) ||
        (typeof entry.email === "string" && entry.email) ||
        (typeof entry.address === "string" && entry.address) ||
        (typeof entry.recipientEmail === "string" && entry.recipientEmail) ||
        null;

      return candidate?.trim() ? [candidate.trim()] : [];
    }

    return [];
  });
}

function toStringValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function hasDiagnosticSignal(row: EmailEventRow) {
  return Boolean(
    row.diagnosticCode?.trim() ||
      row.bounceType?.trim() ||
      row.bounceSubType?.trim() ||
      row.complaintFeedbackType?.trim(),
  );
}

export function normalizeAwsSnsEventType(value: string | null | undefined): EmailEventType {
  const normalized = normalizeText(value).replace(/\s+/g, "_");
  return EVENT_TYPE_MAP[normalized] ?? "sent";
}

export function getAwsSnsOccurredAt(row: EmailEventRow) {
  return row.timestamp ?? row.created_at ?? new Date(0).toISOString();
}

export function getAwsSnsPrimaryRecipient(row: EmailEventRow) {
  return (
    toEmailList(row.destination)[0] ??
    toEmailList(row.destinations)[0] ??
    toEmailList(row.bouncedRecipients)[0] ??
    toEmailList(row.complainedRecipients)[0] ??
    "Destinatário desconhecido"
  );
}

export function getAwsSnsRecipients(row: EmailEventRow) {
  return Array.from(
    new Set(
      [
        ...toEmailList(row.destination),
        ...toEmailList(row.destinations),
        ...toEmailList(row.bouncedRecipients),
        ...toEmailList(row.complainedRecipients),
      ].map((value) => value.trim()),
    ),
  ).filter(Boolean);
}

export function getAwsSnsRowSearchText(row: EmailEventRow) {
  return normalizeText(
    [
      row.id,
      row.messageId,
      row.snsMessageId,
      row.subject,
      row.source,
      row.fromAddress,
      row.sourceIp,
      row.callerIdentity,
      row.configurationSet,
      row.projectTag,
      row.sourceArn,
      row.snsTopicArn,
      row.eventType,
      row.notificationType,
      row.bounceType,
      row.bounceSubType,
      row.diagnosticCode,
      row.reportingMta,
      row.remoteMtaIp,
      row.smtpResponse,
      row.complaintFeedbackType,
      ...toEmailList(row.destination),
      ...toEmailList(row.destinations),
      ...toEmailList(row.bouncedRecipients),
      ...toEmailList(row.complainedRecipients),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function rowMatchesRecipient(row: EmailEventRow, recipientEmail: string) {
  const query = normalizeText(recipientEmail);
  if (!query) {
    return true;
  }

  const candidates = getAwsSnsRecipients(row);
  return candidates.some((candidate) => {
    const normalized = normalizeText(candidate);
    return normalized === query || normalized.includes(query) || query.includes(normalized);
  });
}

function normalizeDomainQuery(value: string) {
  return normalizeText(value).replace(/^@+/, "");
}

function getEmailDomain(value: string) {
  const normalized = normalizeText(value);
  const domain = normalized.split("@")[1] ?? "";
  return domain.trim();
}

export function rowMatchesRecipientDomain(row: EmailEventRow, provider: string) {
  const query = normalizeDomainQuery(provider);
  if (!query) {
    return true;
  }

  return getAwsSnsRecipients(row).some((candidate) => {
    const domain = getEmailDomain(candidate);
    if (!domain) {
      return false;
    }

    return domain === query || domain.endsWith(`.${query}`) || query.endsWith(`.${domain}`);
  });
}

export function rowMatchesSender(row: EmailEventRow, sender: string) {
  const query = normalizeText(sender);
  if (!query) {
    return true;
  }

  const candidates = [row.source, row.fromAddress, row.callerIdentity, row.snsMessageId]
    .map((value) => normalizeText(toStringValue(value)))
    .filter(Boolean);

  return candidates.some((candidate) => candidate === query || candidate.includes(query) || query.includes(candidate));
}

export function rowMatchesStatus(row: EmailEventRow, status: "all" | EmailEventType) {
  if (status === "all") {
    return true;
  }

  return normalizeAwsSnsEventType(row.eventType ?? row.notificationType) === status;
}

export function rowMatchesOrigin(row: EmailEventRow, origin: string) {
  const query = normalizeText(origin);
  if (!query) {
    return true;
  }

  return getAwsSnsRowSearchText(row).includes(query);
}

export function rowMatchesSubject(row: EmailEventRow, subject: string) {
  const query = normalizeText(subject);
  if (!query) {
    return true;
  }

  return normalizeText(row.subject).includes(query);
}

export function rowMatchesBounceDiagnostic(row: EmailEventRow, diagnosticQuery: string) {
  const query = normalizeText(diagnosticQuery);
  if (!query) {
    return true;
  }

  const diagnosis = hasDiagnosticSignal(row)
    ? classifyDiagnosticCode(row.diagnosticCode || row.smtpResponse, row.bounceType)
    : null;
  const diagnosticSearchText = normalizeText(
    [
      row.diagnosticCode,
      row.smtpResponse,
      row.bounceType,
      row.bounceSubType,
      row.complaintFeedbackType,
      row.reportingMta,
      row.remoteMtaIp,
      diagnosis?.cause,
      diagnosis?.recommendation,
      diagnosis?.category,
      diagnosis?.severity,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return diagnosticSearchText.includes(query);
}

export function getAwsSnsRawPayload(row: EmailEventRow) {
  const explicit = row.raw_payload ?? row.rawPayload;
  if (isRecord(explicit)) {
    return explicit;
  }

  return {
    id: row.id,
    created_at: row.created_at,
    timestamp: row.timestamp,
    messageId: row.messageId,
    snsMessageId: row.snsMessageId,
    eventType: row.eventType,
    notificationType: row.notificationType,
    subject: row.subject,
    source: row.source,
    fromAddress: row.fromAddress,
    sourceIp: row.sourceIp,
    callerIdentity: row.callerIdentity,
    configurationSet: row.configurationSet,
    projectTag: row.projectTag,
    sourceArn: row.sourceArn,
    snsTopicArn: row.snsTopicArn,
    sesTags: row.sesTags,
    destination: row.destination,
    destinations: row.destinations,
    bounceType: row.bounceType,
    bounceSubType: row.bounceSubType,
    bouncedRecipients: row.bouncedRecipients,
    diagnosticCode: row.diagnosticCode,
    remoteMtaIp: row.remoteMtaIp,
    reportingMta: row.reportingMta,
    smtpResponse: row.smtpResponse,
    deliveryProcessingTimeMillis: row.deliveryProcessingTimeMillis,
    complaintFeedbackType: row.complaintFeedbackType,
    complainedRecipients: row.complainedRecipients,
    userAgent: row.userAgent,
  };
}

export function rowToEmailEvent(row: EmailEventRow): EmailEvent {
  const eventType = normalizeAwsSnsEventType(row.eventType ?? row.notificationType);
  const recipientEmail = getAwsSnsPrimaryRecipient(row);
  const subject = row.subject?.trim() ?? "";
  const fromAddress = row.fromAddress?.trim() || row.source?.trim() || "";
  const sourceIp = row.sourceIp?.trim() || row.remoteMtaIp?.trim() || "";
  const callerIdentity = row.callerIdentity?.trim() || "";
  const configurationSet = row.configurationSet?.trim() || "";
  const projectTag = row.projectTag?.trim() || "";
  const snsMessageId = row.snsMessageId?.trim() || row.messageId || row.id;
  const originLabel =
    summarizeArn(row.snsTopicArn) ||
    summarizeArn(row.sourceArn) ||
    fromAddress ||
    subject ||
    "Origem desconhecida";
  const identityLabel =
    summarizeArn(row.sourceArn) ||
    row.source?.trim() ||
    row.fromAddress?.trim() ||
    "Identidade desconhecida";
  const senderEmail = row.source?.trim() || row.fromAddress?.trim() || summarizeArn(row.sourceArn) || "Remetente desconhecido";
  const deliveryProcessingTimeMillis =
    typeof row.deliveryProcessingTimeMillis === "number"
      ? row.deliveryProcessingTimeMillis
      : typeof row.deliveryProcessingTimeMillis === "string" && row.deliveryProcessingTimeMillis.trim()
        ? Number(row.deliveryProcessingTimeMillis)
        : null;
  const bounceDiagnosis = hasDiagnosticSignal(row)
    ? classifyDiagnosticCode(row.diagnosticCode || row.smtpResponse, row.bounceType)
    : null;

  return {
    id: row.id,
    messageId: row.messageId ?? row.id,
    snsMessageId,
    recipientEmail,
    eventType,
    occurredAt: getAwsSnsOccurredAt(row),
    subject,
    originApp: originLabel,
    smtpIdentity: identityLabel,
    senderEmail,
    fromAddress,
    sourceIp,
    callerIdentity,
    configurationSet,
    projectTag,
    deliveryStatus: row.notificationType ?? row.eventType ?? eventType,
    deliveryProcessingTimeMillis,
    failureReason: row.bounceType || row.bounceSubType || row.diagnosticCode || row.complaintFeedbackType || "",
    bounceDiagnosis,
    recipientInfo: {
      destination: row.destination,
      destinations: row.destinations,
      subject: row.subject,
      notificationType: row.notificationType,
      snsTopicArn: row.snsTopicArn,
      sourceArn: row.sourceArn,
      sesTags: row.sesTags,
    },
    bounceDetails: {
      bounceType: row.bounceType,
      bounceSubType: row.bounceSubType,
      bouncedRecipients: row.bouncedRecipients,
      diagnosticCode: row.diagnosticCode,
      remoteMtaIp: row.remoteMtaIp,
      reportingMta: row.reportingMta,
      smtpResponse: row.smtpResponse,
    },
    complaintDetails: {
      complaintFeedbackType: row.complaintFeedbackType,
      complainedRecipients: row.complainedRecipients,
      userAgent: row.userAgent,
    },
    deliveryDetails: {
      smtpResponse: row.smtpResponse,
      remoteMtaIp: row.remoteMtaIp,
      reportingMta: row.reportingMta,
      deliveryProcessingTimeMillis,
    },
    delayDetails: {},
    rejectionDetails: {
      subject: row.subject,
      source: row.source,
      sourceArn: row.sourceArn,
    },
    renderingFailureDetails: {},
    rawPayload: getAwsSnsRawPayload(row) as Record<string, unknown>,
    metadata: {
      created_at: row.created_at,
      timestamp: row.timestamp,
      messageId: row.messageId,
      snsMessageId: row.snsMessageId,
      eventType: row.eventType,
      notificationType: row.notificationType,
      source: row.source,
      fromAddress: row.fromAddress,
      sourceIp: row.sourceIp,
      callerIdentity: row.callerIdentity,
      configurationSet: row.configurationSet,
      projectTag: row.projectTag,
      sourceArn: row.sourceArn,
      snsTopicArn: row.snsTopicArn,
      destination: row.destination,
      destinations: row.destinations,
      sesTags: row.sesTags,
    },
  };
}
