import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Flag,
  GitBranch,
  Globe,
  Hash,
  KeyRound,
  ListTree,
  Mail,
  MailWarning,
  PackageCheck,
  Search,
  Send,
  Server,
  Settings2,
  Tag,
  Terminal,
  Timer,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copyToClipboard } from "@/lib/clipboard";
import { formatDateTime } from "@/lib/formatters/dates";
import { formatEventType, toneForEventType } from "@/lib/formatters/email";
import { getOriginLabel } from "@/lib/formatters/event";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useDisclosure } from "@/lib/hooks/use-disclosure";
import { cn } from "@/lib/utils";
import type { EmailEvent } from "@/lib/supabase/types";
import type { BounceDiagnosisSeverity } from "@/lib/supabase/bounce-diagnostics";

type Tone = NonNullable<BadgeProps["tone"]>;

const STATUS_ICON: Record<EmailEvent["eventType"], LucideIcon> = {
  sent: Send,
  delivered: CheckCircle2,
  bounced: AlertTriangle,
  complained: MailWarning,
  delayed: Clock,
  rejected: AlertTriangle,
  rendering_failure: AlertTriangle,
};

const ICON_TONE_CLASS: Record<Tone, string> = {
  default: "bg-slate-100 text-ink dark:bg-slate-800",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-danger-soft text-danger",
  muted: "bg-slate-100 text-ink-muted dark:bg-slate-800",
};

const SEVERITY_TONE: Record<BounceDiagnosisSeverity, Tone> = {
  high: "destructive",
  medium: "warning",
  low: "muted",
};

function parseJsonEncodedArray(value: string): unknown {
  const text = value.trim();
  if (!text.startsWith("[") && !text.startsWith("{")) {
    return value;
  }

  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function extractRecipientList(recipientInfo: Record<string, unknown>): string[] {
  const raw = recipientInfo.destinations ?? recipientInfo.destination;
  // PostgreSQL JSON columns may come back as JSON-encoded strings instead of arrays.
  const normalized = typeof raw === "string" ? parseJsonEncodedArray(raw) : raw;
  const values = Array.isArray(normalized) ? normalized : normalized ? [normalized] : [];

  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : String(value ?? "")))
        .filter(Boolean),
    ),
  );
}

function CopyButton({ value }: { value: string }) {
  const t = useI18n();
  const [copied, setCopied] = useState(false);

  if (!value) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={t.eventDetail.copy}
      title={copied ? t.eventDetail.copied : t.eventDetail.copy}
      onClick={async () => {
        await copyToClipboard(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-muted transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:hover:bg-slate-800"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
  copyable = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const t = useI18n();
  const isEmpty = !value || value === t.eventDetail.notAvailable;

  return (
    <div className="-mx-2 flex items-start gap-3 rounded-control px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink-muted dark:bg-slate-800">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{label}</p>
        <p
          className={cn(
            "mt-0.5 break-all text-sm leading-5 text-ink",
            mono && "font-mono text-[13px]",
            isEmpty && "italic text-ink-muted/70",
          )}
        >
          {value}
        </p>
      </div>
      {copyable && !isEmpty ? <CopyButton value={value} /> : null}
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-control bg-slate-50 p-3.5 dark:bg-slate-800/60">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", ICON_TONE_CLASS[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-ink-muted">{label}</p>
        <p className="mt-0.5 break-words text-sm font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">{children}</CardContent>
    </Card>
  );
}

function EventHero({ event }: { event: EmailEvent }) {
  const t = useI18n();
  const tone = toneForEventType(event.eventType);
  const StatusIcon = STATUS_ICON[event.eventType];

  return (
    <section className="rounded-panel border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", ICON_TONE_CLASS[tone])}>
            <StatusIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={tone} className="px-3 py-1 text-sm">
                {formatEventType(event.eventType)}
              </Badge>
              <span className="text-sm text-ink-muted">{formatDateTime(event.occurredAt)}</span>
            </div>
            <h3 className="mt-2 truncate text-xl font-bold text-ink" title={event.subject || t.eventDetail.notAvailable}>
              {event.subject || t.eventDetail.notAvailable}
            </h3>
            {event.recipientEmail ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="break-all text-sm text-ink-muted">{event.recipientEmail}</p>
                <Link
                  to={`/investigate?query=${encodeURIComponent(event.recipientEmail)}&mode=recipient`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover"
                >
                  <Search className="h-3 w-3" />
                  {t.eventDetail.viewRecipientInvestigation}
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:w-64">
          <StatChip
            icon={PackageCheck}
            label={t.eventDetail.deliveryStatus}
            value={event.deliveryStatus || t.eventDetail.notAvailable}
            tone={tone}
          />
          <StatChip
            icon={Timer}
            label={t.eventDetail.processingTime}
            value={
              event.deliveryProcessingTimeMillis !== null
                ? `${event.deliveryProcessingTimeMillis} ms`
                : t.eventDetail.notAvailable
            }
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
        {[
          { label: t.eventDetail.eventId, value: event.id },
          { label: t.eventDetail.messageId, value: event.messageId },
          { label: t.eventDetail.snsMessageId, value: event.snsMessageId },
        ].map((item) =>
          item.value ? (
            <div key={item.label} className="flex min-w-0 items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{item.label}:</span>
              <span className="max-w-[14rem] truncate font-mono text-xs text-ink" title={item.value}>
                {item.value}
              </span>
              <CopyButton value={item.value} />
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}

function DiagnosisCallout({ event }: { event: EmailEvent }) {
  const t = useI18n();
  const diagnosis = event.bounceDiagnosis;
  if (!diagnosis) {
    return null;
  }

  const technicalCode = event.bounceDetails.diagnosticCode;

  return (
    <div className="rounded-card border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", ICON_TONE_CLASS[SEVERITY_TONE[diagnosis.severity]])}>
          <AlertCircle className="h-4 w-4" />
        </span>
        <p className="text-sm font-bold text-ink">{t.eventDetail.diagnosisTitle}</p>
        <Badge tone={SEVERITY_TONE[diagnosis.severity]}>
          {t.investigation.diagnosisSeverity}: {diagnosis.severity}
        </Badge>
        <span className="text-sm font-semibold text-ink-muted">{diagnosis.category}</span>
      </div>

      <div className="mt-3 space-y-2.5 text-sm leading-6 text-ink-muted">
        <p>
          <span className="font-semibold text-ink">{t.investigation.diagnosisCause}:</span> {diagnosis.cause}
        </p>
        <p>
          <span className="font-semibold text-ink">{t.investigation.diagnosisRecommendation}:</span> {diagnosis.recommendation}
        </p>
        {technicalCode ? (
          <div>
            <p className="font-semibold text-ink">{t.investigation.diagnosisTechnicalCode}:</p>
            <p className="mt-1.5 break-words rounded-control bg-slate-100 px-3 py-2 font-mono text-xs leading-5 text-ink dark:bg-slate-900">
              {String(technicalCode)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RawPayloadCard({ event }: { event: EmailEvent }) {
  const t = useI18n();
  const { isOpen, toggle } = useDisclosure(false);
  const payload = JSON.stringify(event.rawPayload, null, 2);

  return (
    <Card className="lg:col-span-2" id="raw-payload">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-ink-muted dark:bg-slate-800">
            <Braces className="h-4 w-4" />
          </span>
          <CardTitle>{t.eventDetail.rawPayload}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard(payload)}
            className="inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
          >
            <Copy className="h-3.5 w-3.5" />
            {t.eventDetail.copyPayload}
          </button>
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded-control bg-slate-100 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
            {isOpen ? t.eventDetail.hidePayload : t.eventDetail.showPayload}
          </button>
        </div>
      </CardHeader>
      {isOpen ? (
        <CardContent>
          <pre className="max-h-[32rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 dark:bg-black/40">
            {payload}
          </pre>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function EventDetailPanels({ event }: { event: EmailEvent }) {
  const t = useI18n();

  const otherRecipients = extractRecipientList(event.recipientInfo).filter(
    (recipient) => recipient.toLowerCase() !== event.recipientEmail.toLowerCase(),
  );

  const hasTechnicalDetails =
    event.failureReason ||
    event.bounceDetails.bounceType ||
    event.bounceDetails.bounceSubType ||
    event.bounceDetails.diagnosticCode ||
    event.deliveryDetails.smtpResponse ||
    event.deliveryDetails.remoteMtaIp ||
    event.deliveryDetails.reportingMta ||
    event.complaintDetails.complaintFeedbackType;

  return (
    <div className="space-y-6">
      <EventHero event={event} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t.eventDetail.originInfo} className={otherRecipients.length ? undefined : "lg:col-span-2"}>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <div className="space-y-0.5">
              <InfoRow icon={Settings2} label={t.eventDetail.appOrigin} value={event.originApp || t.eventDetail.notAvailable} />
              <InfoRow icon={Server} label={t.eventDetail.smtpIdentity} value={event.smtpIdentity || t.eventDetail.notAvailable} />
              <InfoRow icon={Mail} label={t.eventDetail.fromAddress} value={event.fromAddress || t.eventDetail.notAvailable} />
              <InfoRow icon={Send} label={t.eventDetail.senderEmail} value={event.senderEmail || t.eventDetail.notAvailable} />
              <InfoRow icon={Globe} label={t.eventDetail.sourceIp} value={event.sourceIp || t.eventDetail.notAvailable} mono />
            </div>
            <div className="space-y-0.5">
              <InfoRow icon={KeyRound} label={t.eventDetail.callerIdentity} value={event.callerIdentity || t.eventDetail.notAvailable} />
              <InfoRow icon={Tag} label={t.eventDetail.configurationSet} value={event.configurationSet || t.eventDetail.notAvailable} />
              <InfoRow icon={Hash} label={t.eventDetail.projectTag} value={event.projectTag || t.eventDetail.notAvailable} />
              <InfoRow icon={GitBranch} label={t.eventDetail.originTrace} value={getOriginLabel(event)} />
            </div>
          </div>
        </SectionCard>

        {otherRecipients.length ? (
          <SectionCard title={t.eventDetail.destination}>
            <InfoRow icon={UserRound} label={t.eventDetail.primaryRecipient} value={event.recipientEmail || t.eventDetail.notAvailable} copyable={Boolean(event.recipientEmail)} />
            <div className="-mx-2 flex items-start gap-3 rounded-control px-2 py-2">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink-muted dark:bg-slate-800">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{t.eventDetail.recipients}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {otherRecipients.map((recipient) => (
                    <span
                      key={recipient}
                      className="break-all rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink dark:bg-slate-800"
                    >
                      {recipient}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {event.bounceDiagnosis || hasTechnicalDetails ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t.eventDetail.routing}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <DiagnosisCallout event={event} />
              <div className="grid gap-x-6 gap-y-0.5 md:grid-cols-2">
                <InfoRow icon={AlertCircle} label={t.eventDetail.failureReason} value={event.failureReason || t.eventDetail.notAvailable} />
                <InfoRow icon={ArrowLeftRight} label={t.eventDetail.bounceType} value={String(event.bounceDetails.bounceType ?? t.eventDetail.notAvailable)} />
                <InfoRow icon={ListTree} label={t.eventDetail.bounceSubtype} value={String(event.bounceDetails.bounceSubType ?? t.eventDetail.notAvailable)} />
                <InfoRow icon={Code2} label={t.eventDetail.diagnosticCode} value={String(event.bounceDetails.diagnosticCode ?? t.eventDetail.notAvailable)} mono />
                <InfoRow icon={Terminal} label={t.eventDetail.smtpResponse} value={String(event.deliveryDetails.smtpResponse ?? t.eventDetail.notAvailable)} mono />
                <InfoRow icon={Server} label={t.eventDetail.remoteMtaIp} value={String(event.deliveryDetails.remoteMtaIp ?? t.eventDetail.notAvailable)} mono />
                <InfoRow icon={Server} label={t.eventDetail.reportingMta} value={String(event.deliveryDetails.reportingMta ?? t.eventDetail.notAvailable)} />
                <InfoRow icon={Flag} label={t.eventDetail.complaintFeedback} value={String(event.complaintDetails.complaintFeedbackType ?? t.eventDetail.notAvailable)} />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <RawPayloadCard event={event} />
      </div>
    </div>
  );
}
