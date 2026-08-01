import { AlertTriangle } from "lucide-react";
import { useAppLanguage, useI18n } from "@/lib/i18n/use-i18n";
import { UNLIMITED_ROW_LIMIT_CAP } from "@/lib/row-limits";

// Aviso exibido quando a busca parou no teto de segurança de linhas e o
// conjunto mostrado está incompleto (ver UNLIMITED_ROW_LIMIT_CAP).
//
// É um aviso, não um estado de erro: os dados abaixo dele continuam válidos,
// só não são o total do período. A distinção importa porque esta é uma
// ferramenta de investigação — quem olha um resultado truncado sem saber
// disso pode concluir que não existem mais bounces para um destinatário
// quando existem.
export function TruncationNotice() {
  const t = useI18n();
  const language = useAppLanguage();

  return (
    <div
      role="status"
      className="flex gap-3 rounded-panel border border-amber-500/30 bg-amber-500/10 p-4"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
          {t.common.resultTruncatedTitle}
        </h3>
        <p className="mt-1 text-sm text-amber-700/90 dark:text-amber-200/90">
          {t.common.resultTruncatedDescription}{" "}
          <span className="whitespace-nowrap font-semibold">
            ({UNLIMITED_ROW_LIMIT_CAP.toLocaleString(language)})
          </span>
        </p>
      </div>
    </div>
  );
}
