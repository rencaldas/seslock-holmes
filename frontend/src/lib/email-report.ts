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

export interface EmailReportCategorySummary {
  category: string;
  subjectCount: number;
  uniqueRecipients: number;
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
  categories: EmailReportCategorySummary[];
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

interface SubjectCategoryDefinition {
  keywords: string[];
  label: Record<AppLanguage, string>;
}

// Keyword rules for grouping free-text email subjects into business categories
// for the report's summary table. Order matters: the first matching rule wins,
// so more specific rules (e.g. site orders) are listed before broader ones
// (e.g. generic sales orders) that would otherwise shadow them.
const SUBJECT_CATEGORIES: SubjectCategoryDefinition[] = [
  {
    keywords: ["nf-e", "nfe", "nota fiscal"],
    label: { "pt-BR": "Emissão de NF-e", "en-US": "Invoice issuance (NF-e)" },
  },
  {
    keywords: ["ramada.com.br", "pedido via site"],
    label: {
      "pt-BR": "Pedido via site (www.ramada.com.br)",
      "en-US": "Website order (www.ramada.com.br)",
    },
  },
  {
    keywords: ["pedido de venda", "boleto", "pedido"],
    label: {
      "pt-BR": "Pedido de venda (inclui boleto+pedido)",
      "en-US": "Sales order (includes invoice+order)",
    },
  },
  {
    keywords: ["cotacao"],
    label: { "pt-BR": "Cotação", "en-US": "Quote" },
  },
  {
    keywords: ["relatorio", "bi/erp", "comunicado de ferias", "erp"],
    label: {
      "pt-BR": 'Relatórios automáticos (BI/ERP, inclui "Comunicado de Férias")',
      "en-US": 'Automated reports (BI/ERP, incl. "Vacation Notice")',
    },
  },
  {
    keywords: ["glpi", "chamado"],
    label: { "pt-BR": "GLPI — chamados internos", "en-US": "GLPI — internal tickets" },
  },
  {
    keywords: ["senha", "cadastro"],
    label: { "pt-BR": "Senha / cadastro de cliente", "en-US": "Password / customer registration" },
  },
  {
    keywords: ["ocorrencia", "s.a.c"],
    label: { "pt-BR": "Abertura de ocorrência S.A.C.", "en-US": "Customer service ticket (S.A.C.)" },
  },
  {
    keywords: ["marketing", "oportunidade", "promo", "oferta", "desconto"],
    label: { "pt-BR": "Marketing / oportunidades de compra", "en-US": "Marketing / purchase opportunities" },
  },
];

const OTHER_SUBJECT_CATEGORY_LABEL: Record<AppLanguage, string> = {
  "pt-BR": "Outros",
  "en-US": "Other",
};

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function classifySubjectCategory(subject: string, language: AppLanguage) {
  const normalized = normalizeForMatch(subject);
  if (normalized) {
    for (const definition of SUBJECT_CATEGORIES) {
      if (definition.keywords.some((keyword) => normalized.includes(normalizeForMatch(keyword)))) {
        return definition.label[language];
      }
    }
  }
  return OTHER_SUBJECT_CATEGORY_LABEL[language];
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
  const categoryStats = new Map<string, { subjectCount: number; recipients: Set<string> }>();

  for (const event of events) {
    const email = event.recipientEmail.trim().toLowerCase();
    const recipientKey = email || (options.language === "en-US" ? "Unknown recipient" : "Destinatário desconhecido");
    const occurredAt = event.occurredAt;

    const category = classifySubjectCategory(event.subject, options.language);
    const stats = categoryStats.get(category) ?? { subjectCount: 0, recipients: new Set<string>() };
    stats.subjectCount += 1;
    stats.recipients.add(recipientKey);
    categoryStats.set(category, stats);
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

  const categories = [...categoryStats.entries()]
    .map(
      ([category, stats]): EmailReportCategorySummary => ({
        category,
        subjectCount: stats.subjectCount,
        uniqueRecipients: stats.recipients.size,
      }),
    )
    .sort(
      (left, right) =>
        right.subjectCount - left.subjectCount || left.category.localeCompare(right.category, options.language),
    );

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
    categories,
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

function formatDateTimeBR(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const EVENT_TYPE_LABELS: Record<AppLanguage, Record<EmailEventType, string>> = {
  "en-US": {
    sent: "Sent",
    delivered: "Delivered",
    bounced: "Bounced",
    complained: "Complaint",
    delayed: "Delayed",
    rejected: "Rejected",
    rendering_failure: "Rendering failure",
  },
  "pt-BR": {
    sent: "Enviado",
    delivered: "Entregue",
    bounced: "Rejeitado (bounce)",
    complained: "Reclamação",
    delayed: "Atrasado",
    rejected: "Rejeitado",
    rendering_failure: "Falha de renderização",
  },
};

function eventCountLabels(recipient: EmailReportRecipient, language: AppLanguage) {
  const labels = EVENT_TYPE_LABELS[language];
  return EVENT_TYPES.filter((eventType) => recipient.eventCounts[eventType] > 0).map(
    (eventType) => `${labels[eventType]}: ${recipient.eventCounts[eventType]}`,
  );
}

// --- PDF layout engine -----------------------------------------------------
// A small hand-rolled layout engine: no external PDF library is used, so we
// track a text cursor across pages ourselves and emit positioned text/line
// drawing operators directly into the PDF content streams.

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 54;
const START_Y = PAGE_HEIGHT - MARGIN_TOP;
const TITLE_GRAY = 0.09;
const HEADING_GRAY = 0.12;
const LABEL_GRAY = 0.28;
const VALUE_GRAY = 0.18;
const META_GRAY = 0.42;
const RULE_GRAY = 0.8;

type PdfFont = "F1" | "F2";

type PdfCommand =
  | { kind: "text"; x: number; y: number; font: PdfFont; size: number; gray: number; text: string }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; gray: number; width: number };

function charsPerLine(size: number, x: number, bold: boolean) {
  const availableWidth = PAGE_WIDTH - MARGIN_RIGHT - x;
  const avgCharWidth = size * (bold ? 0.56 : 0.5);
  return Math.max(12, Math.floor(availableWidth / avgCharWidth));
}

function columnChars(width: number, size: number, bold: boolean) {
  const avgCharWidth = size * (bold ? 0.56 : 0.5);
  return Math.max(6, Math.floor(width / avgCharWidth));
}

const CATEGORY_TABLE_CATEGORY_X = MARGIN_LEFT;
const CATEGORY_TABLE_SUBJECTS_X = MARGIN_LEFT + 330;
const CATEGORY_TABLE_RECIPIENTS_X = MARGIN_LEFT + 420;

function createPdfLayout() {
  const pages: PdfCommand[][] = [[]];
  let y = START_Y;

  function newPage() {
    pages.push([]);
    y = START_Y;
  }

  function ensureSpace(height: number) {
    if (y - height < MARGIN_BOTTOM) {
      newPage();
    }
  }

  function currentPage() {
    return pages[pages.length - 1]!;
  }

  function spacer(height: number) {
    ensureSpace(height);
    y -= height;
  }

  function rule(gray = RULE_GRAY, width = 0.75) {
    ensureSpace(12);
    y -= 5;
    currentPage().push({
      kind: "line",
      x1: MARGIN_LEFT,
      y1: y,
      x2: PAGE_WIDTH - MARGIN_RIGHT,
      y2: y,
      gray,
      width,
    });
    y -= 7;
  }

  function textLine(x: number, font: PdfFont, size: number, gray: number, text: string, leading?: number) {
    const lineLeading = leading ?? size * 1.5;
    ensureSpace(lineLeading);
    currentPage().push({ kind: "text", x, y: y - size, font, size, gray, text });
    y -= lineLeading;
  }

  function wrapped(x: number, font: PdfFont, size: number, gray: number, text: string, leading?: number) {
    const chars = charsPerLine(size, x, font === "F2");
    for (const line of wrapText(text, chars)) {
      textLine(x, font, size, gray, line, leading);
    }
  }

  function bulletList(x: number, size: number, gray: number, items: string[], emptyLabel: string) {
    if (!items.length) {
      textLine(x, "F1", size, gray, emptyLabel);
      return;
    }
    const chars = charsPerLine(size, x + 12, false);
    for (const item of items) {
      const wrappedLines = wrapText(item, chars);
      wrappedLines.forEach((line, index) => {
        textLine(x, "F1", size, gray, `${index === 0 ? "• " : "  "}${line}`);
      });
    }
  }

  function field(x: number, label: string, items: string[], emptyLabel: string) {
    ensureSpace(size1_5(9.5));
    textLine(x, "F2", 9.5, LABEL_GRAY, label);
    bulletList(x + 10, 9.3, VALUE_GRAY, items, emptyLabel);
    spacer(3);
  }

  function size1_5(size: number) {
    return size * 1.5;
  }

  // Draws several independently-wrapped text columns side by side on the same
  // row (e.g. a table row), then advances the shared cursor once by the
  // tallest column, since the rest of the layout only tracks a single cursor.
  function columnRow(columns: Array<{ x: number; font: PdfFont; size: number; gray: number; lines: string[] }>, leading: number) {
    const lineCount = Math.max(1, ...columns.map((column) => column.lines.length));
    ensureSpace(lineCount * leading);
    for (const column of columns) {
      column.lines.forEach((line, index) => {
        currentPage().push({
          kind: "text",
          x: column.x,
          y: y - column.size - index * leading,
          font: column.font,
          size: column.size,
          gray: column.gray,
          text: line,
        });
      });
    }
    y -= lineCount * leading;
  }

  return { pages, ensureSpace, spacer, rule, textLine, wrapped, field, columnRow, get y() {
    return y;
  } };
}

function buildPdfPages(report: EmailReport) {
  const isEnglish = report.language === "en-US";
  const labels = isEnglish
    ? {
        title: "SES Email Report",
        generated: "Generated on",
        query: "Applied filters",
        summary: "SUMMARY",
        totalEvents: "Total events",
        uniqueMessages: "Unique messages",
        uniqueRecipients: "Recipients",
        recipientsHeading: "RECIPIENTS",
        domain: "Domain",
        events: "events",
        uniqueMessagesShort: "unique messages",
        period: "Period",
        statuses: "Status",
        origins: "Origin",
        reasons: "Possible reasons",
        recommendations: "Recommendations",
        subjects: "Subjects",
        none: "None recorded",
        noRecipients: "No recipients match the applied filters.",
        categoryColumn: "Category",
        subjectsColumn: "Subjects",
        uniqueRecipientsColumn: "Unique recipients",
        noCategories: "No subjects classified.",
      }
    : {
        title: "Relatório de Emails SES",
        generated: "Gerado em",
        query: "Filtros aplicados",
        summary: "RESUMO",
        totalEvents: "Total de eventos",
        uniqueMessages: "Mensagens únicas",
        uniqueRecipients: "Destinatários",
        recipientsHeading: "DESTINATÁRIOS",
        domain: "Domínio",
        events: "eventos",
        uniqueMessagesShort: "mensagens únicas",
        period: "Período",
        statuses: "Status",
        origins: "Origem",
        reasons: "Possíveis motivos",
        recommendations: "Recomendações",
        subjects: "Assuntos",
        none: "Nenhum registrado",
        noRecipients: "Nenhum destinatário corresponde aos filtros aplicados.",
        categoryColumn: "Categoria",
        subjectsColumn: "Assuntos",
        uniqueRecipientsColumn: "Destinatários únicos",
        noCategories: "Nenhum assunto classificado.",
      };

  const layout = createPdfLayout();

  layout.textLine(MARGIN_LEFT, "F2", 12, TITLE_GRAY, "Seslock Holmes", 16);
  layout.textLine(MARGIN_LEFT, "F2", 19, TITLE_GRAY, labels.title, 26);
  layout.rule(TITLE_GRAY, 1.2);
  layout.spacer(6);
  layout.textLine(MARGIN_LEFT, "F1", 9.5, META_GRAY, `${labels.generated}: ${formatDateTimeBR(report.generatedAt)}`);

  const querySummary = Object.entries(report.query)
    .map(([key, value]) => `${key} = ${value}`)
    .join("   •   ");
  if (querySummary) {
    layout.spacer(2);
    layout.textLine(MARGIN_LEFT, "F2", 9.5, LABEL_GRAY, `${labels.query}:`);
    layout.wrapped(MARGIN_LEFT + 10, "F1", 9.3, META_GRAY, querySummary);
  }

  layout.spacer(10);
  layout.textLine(MARGIN_LEFT, "F2", 11.5, HEADING_GRAY, labels.summary, 18);
  layout.textLine(
    MARGIN_LEFT,
    "F1",
    10,
    VALUE_GRAY,
    `${labels.totalEvents}: ${report.summary.totalEvents}   •   ${labels.uniqueMessages}: ${report.summary.uniqueMessages}   •   ${labels.uniqueRecipients}: ${report.summary.uniqueRecipients}`,
  );

  layout.spacer(8);
  if (report.categories.length) {
    layout.columnRow(
      [
        { x: CATEGORY_TABLE_CATEGORY_X, font: "F2", size: 9.5, gray: HEADING_GRAY, lines: [labels.categoryColumn] },
        { x: CATEGORY_TABLE_SUBJECTS_X, font: "F2", size: 9.5, gray: HEADING_GRAY, lines: [labels.subjectsColumn] },
        {
          x: CATEGORY_TABLE_RECIPIENTS_X,
          font: "F2",
          size: 9.5,
          gray: HEADING_GRAY,
          lines: wrapText(
            labels.uniqueRecipientsColumn,
            columnChars(PAGE_WIDTH - MARGIN_RIGHT - CATEGORY_TABLE_RECIPIENTS_X, 9.5, true),
          ),
        },
      ],
      13,
    );
    layout.rule();

    report.categories.forEach((entry) => {
      layout.columnRow(
        [
          {
            x: CATEGORY_TABLE_CATEGORY_X,
            font: "F1",
            size: 9.3,
            gray: VALUE_GRAY,
            lines: wrapText(
              entry.category,
              columnChars(CATEGORY_TABLE_SUBJECTS_X - CATEGORY_TABLE_CATEGORY_X - 10, 9.3, false),
            ),
          },
          { x: CATEGORY_TABLE_SUBJECTS_X, font: "F1", size: 9.3, gray: VALUE_GRAY, lines: [String(entry.subjectCount)] },
          {
            x: CATEGORY_TABLE_RECIPIENTS_X,
            font: "F1",
            size: 9.3,
            gray: VALUE_GRAY,
            lines: [String(entry.uniqueRecipients)],
          },
        ],
        13,
      );
      layout.rule(RULE_GRAY, 0.5);
    });
  } else {
    layout.textLine(MARGIN_LEFT, "F1", 10, VALUE_GRAY, labels.noCategories);
  }

  layout.spacer(10);
  layout.rule();
  layout.spacer(6);
  layout.textLine(
    MARGIN_LEFT,
    "F2",
    11.5,
    HEADING_GRAY,
    `${labels.recipientsHeading} (${report.recipients.length})`,
    20,
  );

  if (!report.recipients.length) {
    layout.textLine(MARGIN_LEFT, "F1", 10, VALUE_GRAY, labels.noRecipients);
  }

  report.recipients.forEach((recipient, index) => {
    layout.ensureSpace(70);
    layout.textLine(MARGIN_LEFT, "F2", 12.5, TITLE_GRAY, `${index + 1}. ${recipient.email}`, 18);
    layout.textLine(
      MARGIN_LEFT,
      "F1",
      9.5,
      META_GRAY,
      `${labels.domain}: ${recipient.domain || "-"}   •   ${recipient.totalEvents} ${labels.events}   •   ${recipient.uniqueMessages} ${labels.uniqueMessagesShort}`,
    );
    layout.textLine(
      MARGIN_LEFT,
      "F1",
      9.5,
      META_GRAY,
      `${labels.period}: ${formatDateTimeBR(recipient.firstEventAt)} - ${formatDateTimeBR(recipient.lastEventAt)}`,
    );
    layout.spacer(5);

    layout.field(MARGIN_LEFT, `${labels.statuses}:`, eventCountLabels(recipient, report.language), labels.none);
    layout.field(MARGIN_LEFT, `${labels.origins}:`, recipient.origins, labels.none);
    layout.field(MARGIN_LEFT, `${labels.reasons}:`, recipient.possibleReasons, labels.none);
    layout.field(MARGIN_LEFT, `${labels.recommendations}:`, recipient.recommendations, labels.none);
    layout.field(MARGIN_LEFT, `${labels.subjects}:`, recipient.subjects, labels.none);

    layout.spacer(4);
    layout.rule();
    layout.spacer(8);
  });

  return layout.pages;
}

function toPdfBinaryString(value: string) {
  return [...value]
    .map((character) => {
      if (character === "\\") return "\\\\";
      if (character === "(") return "\\(";
      if (character === ")") return "\\)";
      if (character === "–" || character === "—") return "-";
      if (character === "…") return "...";
      if (character === "•") return String.fromCharCode(0x95);
      return character.charCodeAt(0) <= 255 ? character : "?";
    })
    .join("");
}

function binaryStringToBytes(value: string) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
}

function renderPdfCommand(command: PdfCommand) {
  if (command.kind === "line") {
    return [
      `${command.gray} G`,
      `${command.width} w`,
      `${command.x1} ${command.y1} m`,
      `${command.x2} ${command.y2} l`,
      "S",
    ].join("\n");
  }
  return [
    `${command.gray} g`,
    "BT",
    `/${command.font} ${command.size} Tf`,
    `1 0 0 1 ${command.x} ${command.y} Tm`,
    `(${toPdfBinaryString(command.text)}) Tj`,
    "ET",
  ].join("\n");
}

function renderPdfPageContent(commands: PdfCommand[], pageNumber: number, totalPages: number) {
  const footer = renderPdfCommand({
    kind: "text",
    x: PAGE_WIDTH / 2 - 24,
    y: 28,
    font: "F1",
    size: 8,
    gray: META_GRAY,
    text: `${pageNumber} / ${totalPages}`,
  });
  return [...commands.map(renderPdfCommand), footer].join("\n");
}

export function emailReportToPdf(report: EmailReport) {
  const pages = buildPdfPages(report);
  const regularFontId = 3 + pages.length * 2;
  const boldFontId = regularFontId + 1;
  const objects = new Map<number, string>();
  const pageObjectIds = pages.map((_, index) => 3 + index * 2);

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((pageCommands, index) => {
    const pageObjectId = pageObjectIds[index]!;
    const contentObjectId = pageObjectId + 1;
    const content = renderPdfPageContent(pageCommands, index + 1, pages.length);
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.set(contentObjectId, `<< /Length ${binaryStringToBytes(content).length} >>\nstream\n${content}\nendstream`);
  });
  objects.set(
    regularFontId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  objects.set(
    boldFontId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = new Array<number>(boldFontId + 1).fill(0);
  for (let objectId = 1; objectId <= boldFontId; objectId += 1) {
    offsets[objectId] = pdf.length;
    pdf += `${objectId} 0 obj\n${objects.get(objectId)}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${boldFontId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectId = 1; objectId <= boldFontId; objectId += 1) {
    pdf += `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${boldFontId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([binaryStringToBytes(pdf)], { type: "application/pdf" });
}

function formatFilenameTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  }

  // "/" and ":" aren't safe in filenames, so dd/mm/yyyy and HH:mm:ss become
  // dd-mm-yyyy_HH-mm-ss, always converted to Brasília time regardless of the
  // machine's local timezone.
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}-${parts.month}-${parts.year}_${parts.hour}-${parts.minute}-${parts.second}`;
}

export function createEmailReportFilename(extension: "pdf" | "csv" | "json", generatedAt: string) {
  return `relatorio-emails-${formatFilenameTimestamp(generatedAt)}.${extension}`;
}
