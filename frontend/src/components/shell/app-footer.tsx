import pkg from "../../../package.json";

export function AppFooter() {
  const currentYear = new Date().getFullYear();
  const lastUpdated = new Date().toLocaleString("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-2 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.9fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Contato</p>
            <div className="text-sm leading-7 text-slate-200">
              <p>Meu email: <a href="mailto:renato.deacaldas@gmail.com" className="text-sky-300 hover:text-sky-200">renato.deacaldas@gmail.com</a></p>
              <p>Meu Github: <a href="https://github.com/rencaldas" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200">github.com/rencaldas</a></p>
              <p>Meu LinkedIn: <a href="https://www.linkedin.com/in/rcaldas/" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200">linkedin.com/in/rcaldas</a></p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Perguntas Frequentes</p>
            <p className="text-sm leading-7 text-slate-200">
              <a
                href="/faq"
                className="text-sky-300 hover:text-sky-200"
              >
                FAQ
              </a>
            </p>
            <p className="text-sm leading-7 text-slate-200">
              <a
                href="https://github.com/rencaldas/seslock-holmes/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 hover:text-sky-200"
              >
                Reportar Incidente/Bug
              </a>
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Informações do Projeto</p>
            <div className="text-sm leading-7 text-slate-200">
              <p>Versão do projeto: <span className="font-semibold text-slate-100">v{pkg.version}</span></p>
              <p>Última atualização: <span className="font-medium text-slate-100">{lastUpdated}</span></p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-slate-800 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} Todos os direitos reservados. Permitido usar meu projeto, mas não copiar para fazer os próprios.
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:text-white"
          >
            Voltar ao Topo
          </button>
        </div>
      </div>
    </footer>
  );
}
