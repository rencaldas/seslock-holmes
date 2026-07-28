import type { AppLanguage } from "@/lib/i18n/types";
import type { EmailEvent, EmailEventType } from "@/lib/supabase/types";

const EVENT_TYPES: EmailEventType[] = [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "delayed",
  "rejected",
  "rendering_failure",
];

export interface EmailReportRecipient {
  email: string;
  domain: string;
  totalEvents: number;
  uniqueMessages: number;
  firstEventAt: string;
  lastEventAt: string;
  eventCounts: Record<EmailEventType, number>;
  origins: string[];
  possibleReasons: string[];
  recommendations: string[];
  subjects: string[];
}

export interface EmailReport {
  generatedAt: string;
  language: AppLanguage;
  query: Record<string, string>;
  summary: {
    totalEvents: number;
    uniqueMessages: number;
    uniqueRecipients: number;
  };
  recipients: EmailReportRecipient[];
}

export type EmailReportSortBy =
  | "email"
  | "criticality"
  | "totalEvents"
  | "recentActivity"
  | "complaints"
  | "domain"
  | "problemRate";

interface EmailReportOptions {
  language: AppLanguage;
  query?: Record<string, string>;
  generatedAt?: string;
  sortBy?: EmailReportSortBy;
}

type MutableRecipient = EmailReportRecipient & {
  messageIds: Set<string>;
  originSet: Set<string>;
  reasonSet: Set<string>;
  recommendationSet: Set<string>;
  subjectSet: Set<string>;
};

function createEventCounts(): Record<EmailEventType, number> {
  return {
    sent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    delayed: 0,
    rejected: 0,
    rendering_failure: 0,
  };
}

function getTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function addOriginDetails(target: Set<string>, event: EmailEvent, language: AppLanguage) {
  const labels =
    language === "en-US"
      ? {
          app: "Application",
          smtp: "SMTP identity",
          configurationSet: "Configuration set",
          project: "Project",
          sender: "Sender",
        }
      : {
          app: "Aplicação",
          smtp: "Identidade SMTP",
          configurationSet: "Configuration set",
          project: "Projeto",
          sender: "Remetente",
        };

  const values: Array<[string, string]> = [
    [labels.app, event.originApp],
    [labels.smtp, event.smtpIdentity],
    [labels.configurationSet, event.configurationSet],
    [labels.project, event.projectTag],
    [labels.sender, event.senderEmail || event.fromAddress],
  ];

  for (const [label, value] of values) {
    const normalized = value.trim();
    if (normalized) {
      target.add(`${label}: ${normalized}`);
    }
  }
}

function addReasonDetails(
  reasons: Set<string>,
  recommendations: Set<string>,
  event: EmailEvent,
  language: AppLanguage,
) {
  if (event.bounceDiagnosis?.cause) {
    reasons.add(event.bounceDiagnosis.cause);
  }
  if (event.failureReason) {
    reasons.add(event.failureReason);
  }
  if (event.bounceDiagnosis?.recommendation) {
    recommendations.add(event.bounceDiagnosis.recommendation);
  }

  if (event.bounceDiagnosis?.cause || event.failureReason) {
    return;
  }

  const fallbackReasons: Partial<Record<EmailEventType, string>> =
    language === "en-US"
      ? {
          complained: "The recipient or provider registered a complaint.",
          delayed: "Delivery was temporarily delayed.",
          rejected: "The message was rejected before delivery.",
          rendering_failure: "The message content could not be rendered.",
        }
      : {
          complained: "O destinatário ou provedor registrou uma reclamação.",
          delayed: "A entrega sofreu um atraso temporário.",
          rejected: "A mensagem foi rejeitada antes da entrega.",
          rendering_failure: "O conteúdo da mensagem não pôde ser renderizado.",
        };

  const fallback = fallbackReasons[event.eventType];
  if (fallback) {
    reasons.add(fallback);
  }
}

function problemRate(recipient: EmailReportRecipient) {
  const problems = recipient.eventCounts.bounced + recipient.eventCounts.complained + recipient.eventCounts.rejected;
  return recipient.totalEvents > 0 ? problems / recipient.totalEvents : 0;
}

function createRecipientComparator(sortBy: EmailReportSortBy, language: AppLanguage) {
  const compareEmail = (left: EmailReportRecipient, right: EmailReportRecipient) =>
    left.email.localeCompare(right.email, language, { sensitivity: "base" });

  switch (sortBy) {
    case "criticality":
      return (left: EmailReportRecipient, right: EmailReportRecipient) =>
        right.eventCounts.bounced - left.eventCounts.bounced || compareEmail(left, right);
    case "totalEvents":
      return (left: EmailReportRecipient, right: EmailReportRecipient) =>
        right.totalEvents - left.totalEvents || compareEmail(left, right);
    case "recentActivity":
      return (left: EmailReportRecipient, right: EmailReportRecipient) =>
        getTimestamp(right.lastEventAt) - getTimestamp(left.lastEventAt) || compareEmail(left, right);
    case "complaints":
      return (left: EmailReportRecipient, right: EmailReportRecipient) =>
        right.eventCounts.complained - left.eventCounts.complained || compareEmail(left, right);
    case "domain":
      return (left: EmailReportRecipient, right: EmailReportRecipient) =>
        left.domain.localeCompare(right.domain, language, { sensitivity: "base" }) || compareEmail(left, right);
    case "problemRate":
      return (left: EmailReportRecipient, right: EmailReportRecipient) =>
        problemRate(right) - problemRate(left) || compareEmail(left, right);
    case "email":
    default:
      return compareEmail;
  }
}

export function buildEmailReport(events: EmailEvent[], options: EmailReportOptions): EmailReport {
  const groups = new Map<string, MutableRecipient>();
  const allMessageIds = new Set<string>();

  for (const event of events) {
    const email = event.recipientEmail.trim().toLowerCase();
    const recipientKey = email || (options.language === "en-US" ? "Unknown recipient" : "Destinatário desconhecido");
    const occurredAt = event.occurredAt;
    const existing = groups.get(recipientKey);
    const recipient =
      existing ??
      ({
        email: recipientKey,
        domain: email.includes("@") ? email.split("@").pop() ?? "" : "",
        totalEvents: 0,
        uniqueMessages: 0,
        firstEventAt: occurredAt,
        lastEventAt: occurredAt,
        eventCounts: createEventCounts(),
        origins: [],
        possibleReasons: [],
        recommendations: [],
        subjects: [],
        messageIds: new Set<string>(),
        originSet: new Set<string>(),
        reasonSet: new Set<string>(),
        recommendationSet: new Set<string>(),
        subjectSet: new Set<string>(),
      } satisfies MutableRecipient);

    recipient.totalEvents += 1;
    recipient.eventCounts[event.eventType] += 1;
    if (event.messageId) {
      recipient.messageIds.add(event.messageId);
      allMessageIds.add(event.messageId);
    }
    if (getTimestamp(occurredAt) < getTimestamp(recipient.firstEventAt)) {
      recipient.firstEventAt = occurredAt;
    }
    if (getTimestamp(occurredAt) > getTimestamp(recipient.lastEventAt)) {
      recipient.lastEventAt = occurredAt;
    }
    if (event.subject.trim()) {
      recipient.subjectSet.add(event.subject.trim());
    }

    addOriginDetails(recipient.originSet, event, options.language);
    addReasonDetails(recipient.reasonSet, recipient.recommendationSet, event, options.language);
    groups.set(recipientKey, recipient);
  }

  const unknownOrigin = options.language === "en-US" ? "Unknown origin" : "Origem desconhecida";
  const recipients = [...groups.values()]
    .map((recipient): EmailReportRecipient => ({
      email: recipient.email,
      domain: recipient.domain,
      totalEvents: recipient.totalEvents,
      uniqueMessages: recipient.messageIds.size,
      firstEventAt: recipient.firstEventAt,
      lastEventAt: recipient.lastEventAt,
      eventCounts: recipient.eventCounts,
      origins: recipient.originSet.size ? [...recipient.originSet].sort() : [unknownOrigin],
      possibleReasons: [...recipient.reasonSet].sort(),
      recommendations: [...recipient.recommendationSet].sort(),
      subjects: [...recipient.subjectSet].sort(),
    }))
    .sort(createRecipientComparator(options.sortBy ?? "email", options.language));

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    language: options.language,
    query: Object.fromEntries(
      Object.entries(options.query ?? {})
        .filter(([, value]) => value !== "")
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
    summary: {
      totalEvents: events.length,
      uniqueMessages: allMessageIds.size,
      uniqueRecipients: recipients.length,
    },
    recipients,
  };
}

function eventCountSummary(recipient: EmailReportRecipient) {
  return EVENT_TYPES.filter((eventType) => recipient.eventCounts[eventType] > 0)
    .map((eventType) => `${eventType}: ${recipient.eventCounts[eventType]}`)
    .join(" | ");
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function emailReportToCsv(report: EmailReport) {
  const headers =
    report.language === "en-US"
      ? [
          "Email",
          "Domain",
          "Total events",
          "Unique messages",
          "First event",
          "Last event",
          "Statuses",
          "Origins",
          "Possible reasons",
          "Recommendations",
          "Subjects",
        ]
      : [
          "Email",
          "Domínio",
          "Total de eventos",
          "Mensagens únicas",
          "Primeiro evento",
          "Último evento",
          "Status",
          "Origens",
          "Possíveis motivos",
          "Recomendações",
          "Assuntos",
        ];

  const rows = report.recipients.map((recipient) => [
    recipient.email,
    recipient.domain,
    recipient.totalEvents,
    recipient.uniqueMessages,
    recipient.firstEventAt,
    recipient.lastEventAt,
    eventCountSummary(recipient),
    recipient.origins.join(" | "),
    recipient.possibleReasons.join(" | "),
    recipient.recommendations.join(" | "),
    recipient.subjects.join(" | "),
  ]);

  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n")}`;
}

export function emailReportToJson(report: EmailReport) {
  return JSON.stringify(report, null, 2);
}

function wrapText(value: string, maxLength = 92) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of normalized.split(" ")) {
    if (word.length > maxLength) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxLength) {
        lines.push(word.slice(index, index + maxLength));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines;
}

function addWrappedLines(lines: string[], label: string, values: string[]) {
  const content = values.length ? values.join(" | ") : "-";
  lines.push(...wrapText(`${label}: ${content}`));
}

function buildPdfLines(report: EmailReport) {
  const isEnglish = report.language === "en-US";
  const labels = isEnglish
    ? {
        title: "SES email report",
        generated: "Generated",
        query: "Query",
        summary: "Summary",
        events: "events",
        messages: "unique messages",
        recipients: "recipients",
        domain: "Domain",
        period: "Period",
        statuses: "Statuses",
        origins: "Origins",
        reasons: "Possible reasons",
        recommendations: "Recommendations",
        subjects: "Subjects",
      }
    : {
        title: "Relatório de emails SES",
        generated: "Gerado em",
        query: "Consulta",
        summary: "Resumo",
        events: "eventos",
        messages: "mensagens únicas",
        recipients: "destinatários",
        domain: "Domínio",
        period: "Período",
        statuses: "Status",
        origins: "Origens",
        reasons: "Possíveis motivos",
        recommendations: "Recomendações",
        subjects: "Assuntos",
      };
  const lines = [
    labels.title,
    `${labels.generated}: ${report.generatedAt}`,
    `${labels.summary}: ${report.summary.totalEvents} ${labels.events}; ${report.summary.uniqueMessages} ${labels.messages}; ${report.summary.uniqueRecipients} ${labels.recipients}`,
  ];

  const querySummary = Object.entries(report.query)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  if (querySummary) {
    lines.push(...wrapText(`${labels.query}: ${querySummary}`));
  }
  lines.push("", "=".repeat(92), "");

  for (const recipient of report.recipients) {
    lines.push(recipient.email);
    lines.push(
      `${labels.domain}: ${recipient.domain || "-"} | ${recipient.totalEvents} ${labels.events} | ${recipient.uniqueMessages} ${labels.messages}`,
    );
    lines.push(`${labels.period}: ${recipient.firstEventAt} - ${recipient.lastEventAt}`);
    addWrappedLines(lines, labels.statuses, [eventCountSummary(recipient)]);
    addWrappedLines(lines, labels.origins, recipient.origins);
    addWrappedLines(lines, labels.reasons, recipient.possibleReasons);
    addWrappedLines(lines, labels.recommendations, recipient.recommendations);
    addWrappedLines(lines, labels.subjects, recipient.subjects);
    lines.push("", "-".repeat(92), "");
  }

  return lines;
}

function toPdfBinaryString(value: string) {
  return [...value]
    .map((character) => {
      if (character === "\\") return "\\\\";
      if (character === "(") return "\\(";
      if (character === ")") return "\\)";
      if (character === "–" || character === "—") return "-";
      if (character === "…") return "...";
      return character.charCodeAt(0) <= 255 ? character : "?";
    })
    .join("");
}

function binaryStringToBytes(value: string) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
}

export function emailReportToPdf(report: EmailReport) {
  const lines = buildPdfLines(report);
  const linesPerPage = 54;
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(lines.length / linesPerPage)) },
    (_, index) => lines.slice(index * linesPerPage, (index + 1) * linesPerPage),
  );
  const fontObjectId = 3 + pages.length * 2;
  const objects = new Map<number, string>();
  const pageObjectIds = pages.map((_, index) => 3 + index * 2);

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((pageLines, index) => {
    const pageObjectId = pageObjectIds[index]!;
    const contentObjectId = pageObjectId + 1;
    const content = [
      "BT",
      "/F1 9 Tf",
      "12 TL",
      "42 800 Td",
      ...pageLines.flatMap((line) => [`(${toPdfBinaryString(line)}) Tj`, "T*"]),
      "ET",
    ].join("\n");
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.set(contentObjectId, `<< /Length ${binaryStringToBytes(content).length} >>\nstream\n${content}\nendstream`);
  });
  objects.set(
    fontObjectId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );

  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = new Array<number>(fontObjectId + 1).fill(0);
  for (let objectId = 1; objectId <= fontObjectId; objectId += 1) {
    offsets[objectId] = pdf.length;
    pdf += `${objectId} 0 obj\n${objects.get(objectId)}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${fontObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectId = 1; objectId <= fontObjectId; objectId += 1) {
    pdf += `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${fontObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([binaryStringToBytes(pdf)], { type: "application/pdf" });
}

export function createEmailReportFilename(extension: "pdf" | "csv" | "json", generatedAt: string) {
  const timestamp = generatedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  return `relatorio-emails-${timestamp}.${extension}`;
}
