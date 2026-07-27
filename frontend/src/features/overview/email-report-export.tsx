import { useRef } from "react";
import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import {
  buildEmailReport,
  createEmailReportFilename,
  emailReportToCsv,
  emailReportToJson,
  emailReportToPdf,
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

  function exportReport(format: ExportFormat) {
    const report = buildEmailReport(events, { language, query });
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
      <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">
        <Download className="mr-2 h-4 w-4" />
        {t.overview.exportReport}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl md:left-0 md:right-auto">
        <p className="px-3 py-2 text-xs leading-5 text-slate-500">{t.overview.exportAllResults}</p>
        <button
          type="button"
          className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
          onClick={() => exportReport("pdf")}
        >
          <FileText className="mr-2 h-4 w-4" />
          {t.overview.exportPdf}
        </button>
        <button
          type="button"
          className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
          onClick={() => exportReport("csv")}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t.overview.exportCsv}
        </button>
        <button
          type="button"
          className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
          onClick={() => exportReport("json")}
        >
          <FileJson className="mr-2 h-4 w-4" />
          {t.overview.exportJson}
        </button>
      </div>
    </details>
  );
}
