import { useRef, useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import { Select } from "@/components/ui/select";
import {
  buildEmailReport,
  createEmailReportFilename,
  emailReportToCsv,
  emailReportToJson,
  emailReportToPdf,
  type EmailReportSortBy,
} from "@/lib/email-report";
import type { EmailEvent } from "@/lib/supabase/types";

type ExportFormat = "pdf" | "csv" | "json";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function EmailReportExport({
  events,
  query,
}: {
  events: EmailEvent[];
  query: Record<string, string>;
}) {
  const t = useI18n();
  const language = useAppLanguage();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [sortBy, setSortBy] = useState<EmailReportSortBy>("email");

  const sortOptions: { value: EmailReportSortBy; label: string }[] = [
    { value: "email", label: t.overview.exportSortEmail },
    { value: "criticality", label: t.overview.exportSortCriticality },
    { value: "totalEvents", label: t.overview.exportSortTotalEvents },
    { value: "recentActivity", label: t.overview.exportSortRecentActivity },
    { value: "complaints", label: t.overview.exportSortComplaints },
    { value: "domain", label: t.overview.exportSortDomain },
    { value: "problemRate", label: t.overview.exportSortProblemRate },
  ];

  function exportReport(format: ExportFormat) {
    const report = buildEmailReport(events, { language, query, sortBy });
    const filename = createEmailReportFilename(format, report.generatedAt);

    if (format === "pdf") {
      downloadBlob(emailReportToPdf(report), filename);
    } else if (format === "csv") {
      downloadBlob(new Blob([emailReportToCsv(report)], { type: "text/csv;charset=utf-8" }), filename);
    } else {
      downloadBlob(
        new Blob([emailReportToJson(report)], { type: "application/json;charset=utf-8" }),
        filename,
      );
    }

    menuRef.current?.removeAttribute("open");
  }

  return (
    <details ref={menuRef} className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-control bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
        <Download className="mr-2 h-4 w-4" />
        {t.overview.exportReport}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-card border border-slate-200 bg-white p-2 shadow-hover dark:border-slate-700 dark:bg-slate-900 md:left-0 md:right-auto">
        <p className="px-3 py-2 text-xs leading-5 text-ink-muted">{t.overview.exportAllResults}</p>
        <div className="px-3 pb-2">
          <label className="mb-1 block text-xs font-medium text-ink-muted">{t.overview.exportSortLabel}</label>
          <Select
            className="h-9 text-xs"
            options={sortOptions}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as EmailReportSortBy)}
          />
        </div>
        <button
          type="button"
          className="flex w-full items-center rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => exportReport("pdf")}
        >
          <FileText className="mr-2 h-4 w-4" />
          {t.overview.exportPdf}
        </button>
        <button
          type="button"
          className="flex w-full items-center rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => exportReport("csv")}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t.overview.exportCsv}
        </button>
        <button
          type="button"
          className="flex w-full items-center rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => exportReport("json")}
        >
          <FileJson className="mr-2 h-4 w-4" />
          {t.overview.exportJson}
        </button>
      </div>
    </details>
  );
}
