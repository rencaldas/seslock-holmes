import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const faqSections = [
  {
    title: "Sobre o painel",
    items: [
      {
        question: "O que é o Seslock Holmes?",
        answer: (
          <>
            <p className="mb-3">
              O Seslock Holmes é um painel web para investigação de eventos de email do AWS SES armazenados em um banco de dados Supabase/PostgreSQL.
            </p>
            <p>
              Ele foi projetado para permitir que times de suporte e operações analisem falhas de entrega sem precisar de acesso direto à AWS.
            </p>
          </>
        ),
        answerText:
          "O Seslock Holmes é um painel web para investigação de eventos de email do AWS SES armazenados em um banco de dados Supabase/PostgreSQL.",
      },
      {
        question: "O aplicativo permite criar ou alterar eventos?",
        answer: (
          <p>
            Não. O painel é somente leitura: ele faz apenas consultas ao Supabase e não cria, edita nem remove nenhum registro.
          </p>
        ),
        answerText: "Não. O painel é somente leitura: ele faz apenas consultas ao Supabase e não cria, edita nem remove nenhum registro.",
      },
      {
        question: "Quais variáveis de ambiente são necessárias?",
        answer: (
          <div className="space-y-3 text-sm leading-6">
            <p>O frontend usa as seguintes variáveis:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-600">
              <li><code>VITE_SUPABASE_URL</code></li>
              <li><code>VITE_SUPABASE_ANON_KEY</code></li>
              <li><code>VITE_SUPABASE_EVENTS_TABLE</code></li>
            </ul>
            <p>
              Se não houver <code>VITE_SUPABASE_EVENTS_TABLE</code>, a aplicação tenta usar <code>aws_sns</code>.
            </p>
          </div>
        ),
        answerText:
          "O frontend usa VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_SUPABASE_EVENTS_TABLE. Se não houver VITE_SUPABASE_EVENTS_TABLE, a aplicação tenta usar aws_sns.",
      },
      {
        question: "O painel aceita uma tabela ou view personalizada no Supabase?",
        answer: (
          <p>
            Sim. Você pode informar o nome da tabela ou view de eventos do SES e o app armazenará essa configuração localmente para próximas consultas.
          </p>
        ),
        answerText:
          "Sim. Você pode informar o nome da tabela ou view de eventos do SES e o app armazenará essa configuração localmente para próximas consultas.",
      },
    ],
  },
  {
    title: "Investigação e uso",
    items: [
      {
        question: "Como uso a busca por destinatário?",
        answer: (
          <p>
            Vá para a página inicial ou para /investigate, digite o email do destinatário e clique em buscar. O painel normaliza o email para melhorar a correspondência.
          </p>
        ),
        answerText:
          "Vá para a página inicial ou para /investigate, digite o email do destinatário e clique em buscar. O painel normaliza o email para melhorar a correspondência.",
      },
      {
        question: "O que significa cada modo de pesquisa?",
        answer: (
          <div className="space-y-3 text-sm leading-6">
            <p>
              O app oferece três modos de pesquisa principais:
            </p>
            <ul className="list-disc pl-5 text-slate-600">
              <li><strong>Destinatário</strong>: busca por email do destinatário.</li>
              <li><strong>Remetente</strong>: busca por email do remetente.</li>
              <li><strong>Origem</strong>: busca pelo domínio ou identidade de envio.</li>
            </ul>
          </div>
        ),
        answerText:
          "O app oferece modos de pesquisa por destinatário, remetente e origem. Destinatário busca emails de destino; remetente busca emails de origem; origem busca domínio ou identidade de envio.",
      },
      {
        question: "E se minha pesquisa não retornar resultados?",
        answer: (
          <div className="space-y-3 text-sm leading-6">
            <p>
              Primeiro, verifique se o texto foi normalizado corretamente e se a janela de tempo está correta.
            </p>
            <p>
              Se não houver correspondência exata, o app pode sugerir emails parecidos ou você pode ampliar a janela de tempo e remover filtros adicionais.
            </p>
          </div>
        ),
        answerText:
          "Verifique a normalização do texto, amplie a janela de tempo e remova filtros. O app pode sugerir emails parecidos se não houver correspondência exata.",
      },
      {
        question: "Como funciona a paginação da atividade recente?",
        answer: (
          <p>
            A página de visão geral carrega até 50 eventos por página e permite avançar ou retroceder entre as páginas de atividade recente.
          </p>
        ),
        answerText:
          "A página de visão geral carrega até 50 eventos por página e permite avançar ou retroceder entre as páginas de atividade recente.",
      },
    ],
  },
  {
    title: "Dados e informações do SES",
    items: [
      {
        question: "O que significa cada status de evento?",
        answer: (
          <div className="space-y-3 text-sm leading-6">
            <p>Os principais status exibidos no painel incluem:</p>
            <ul className="list-disc pl-5 text-slate-600">
              <li><strong>sent</strong>: mensagem aceita para envio.</li>
              <li><strong>delivered</strong>: mensagem entregue com sucesso.</li>
              <li><strong>bounced</strong>: rejeitada pelo servidor de destino.</li>
              <li><strong>complained</strong>: o destinatário registrou uma reclamação.</li>
              <li><strong>delayed</strong>: entrega atrasada.</li>
              <li><strong>rejected</strong>: recusada pelo SES.</li>
              <li><strong>rendering_failure</strong>: falha ao renderizar o conteúdo ou anexos.</li>
            </ul>
          </div>
        ),
        answerText:
          "Status incluem sent, delivered, bounced, complained, delayed, rejected e rendering_failure.",
      },
      {
        question: "Como o rastreamento de mensagens é gerado?",
        answer: (
          <p>
            O painel usa o <code>messageId</code> e os eventos relacionados registrados no Supabase para reconstruir a linha do tempo completa da mensagem.
          </p>
        ),
        answerText:
          "O painel usa o messageId e os eventos relacionados registrados no Supabase para reconstruir a linha do tempo completa da mensagem.",
      },
      {
        question: "Quais campos são esperados na tabela de eventos?",
        answer: (
          <div className="space-y-3 text-sm leading-6">
            <p>O app espera campos-chave como:</p>
            <ul className="list-disc pl-5 text-slate-600">
              <li><code>id</code>, <code>messageId</code>, <code>eventType</code> ou <code>notificationType</code></li>
              <li><code>timestamp</code> ou <code>created_at</code></li>
              <li><code>subject</code>, <code>source</code>, <code>destination</code></li>
              <li>campos de bounce, complaint e SMTP para detalhes de falha.</li>
            </ul>
          </div>
        ),
        answerText:
          "O app espera campos como id, messageId, eventType/notificationType, timestamp/created_at, subject, source, destination e campos de bounce, complaint e SMTP.",
      },
    ],
  },
  {
    title: "Suporte e segurança",
    items: [
      {
        question: "Como reporto um bug ou incidente?",
        answer: (
          <p>
            Para problemas com o painel, use o email de contato no rodapé ou abra uma issue no GitHub do projeto.
          </p>
        ),
        answerText:
          "Para problemas com o painel, use o email de contato no rodapé ou abra uma issue no GitHub do projeto.",
      },
      {
        question: "Os dados do usuário ficam armazenados no navegador?",
        answer: (
          <p>
            O único dado salvo localmente é a configuração da tabela de eventos escolhida pelo usuário para evitar ter que configurá-la novamente.
          </p>
        ),
        answerText:
          "O único dado salvo localmente é a configuração da tabela de eventos escolhida pelo usuário.",
      },
      {
        question: "Como garantir que só consultas seguras são feitas?",
        answer: (
          <p>
            O painel usa apenas consultas de leitura no Supabase e depende de políticas de RLS para permitir apenas acesso seguro aos dados.
          </p>
        ),
        answerText:
          "O painel usa apenas consultas de leitura no Supabase e depende de políticas de RLS para acesso seguro aos dados.",
      },
    ],
  },
];

function FaqItem({ question, answer }: { question: string; answer: JSX.Element }) {
  return (
    <details className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft transition duration-200 hover:border-slate-300">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-slate-950 transition hover:bg-slate-50">
        <span>{question}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition duration-200 group-open:rotate-45 group-open:border-slate-300">
          +
        </span>
      </summary>
      <div className="border-t border-slate-100 px-6 py-5 text-sm leading-7 text-slate-600">{answer}</div>
    </details>
  );
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function searchTokens(value: string) {
  return normalizeQuery(value).split(/\W+/).filter(Boolean);
}

function getFaqItemRelevance(item: { question: string; answerText: string }, queryTokens: string[]) {
  const haystack = `${item.question} ${item.answerText}`.toLowerCase();
  return queryTokens.reduce((score, token) => {
    if (!token) {
      return score;
    }

    let next = score;

    if (haystack.includes(token)) {
      next += 3;
    }

    if (item.question.toLowerCase().includes(token)) {
      next += 2;
    }

    if (item.answerText.toLowerCase().includes(token)) {
      next += 1;
    }

    return next;
  }, 0);
}

function getSimilarFaqItems(query: string) {
  const tokens = searchTokens(query);
  if (!tokens.length) {
    return [];
  }

  const allItems = faqSections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      sectionTitle: section.title,
    })),
  );

  return allItems
    .map((item) => ({
      ...item,
      score: getFaqItemRelevance(item, tokens),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

export function FaqPage() {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const visibleSections = useMemo(
    () =>
      faqSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.question.toLowerCase().includes(query) ||
              item.answerText.toLowerCase().includes(query),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [query],
  );

  const similarSuggestions = useMemo(
    () => (query && visibleSections.length === 0 ? getSimilarFaqItems(query) : []),
    [query, visibleSections.length],
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-soft">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-4 py-2 text-slate-600">
              <BookOpen className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Perguntas Frequentes</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
              Tudo o que você precisa saber para investigar emails no Seslock Holmes.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Encontre respostas rápidas sobre instalação, pesquisas, filtros e como interpretar eventos do SES.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">Somente leitura</span>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">Suporte a filtros</span>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">Supabase e SES</span>
            </div>
          </div>
          <Card className="bg-slate-950 text-white">
            <CardHeader>
              <CardTitle>Busca rápida de dúvidas</CardTitle>
              <CardDescription>
                Digite termos como <strong>bounce</strong>, <strong>origem</strong> ou <strong>Supabase</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-3xl bg-slate-900/95 px-4 py-4 shadow-lg shadow-slate-900/10">
                <Search className="h-5 w-5 text-slate-300" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar FAQ"
                  className="bg-slate-950 text-slate-100 border-slate-800 placeholder:text-slate-500 focus:border-slate-600 focus:ring-slate-600/20"
                />
              </div>
              <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
                <p>
                  Um FAQ profissional inclui navegação clara, respostas diretas e acesso rápido às dúvidas mais comuns.
                </p>
                <p>
                  Se precisar de ajuda adicional, use o contato no rodapé da página.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        {visibleSections.length ? (
          visibleSections.map((section) => (
            <div key={section.title} className="space-y-4">
              <div className="space-y-3 px-2 py-2">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {section.title}
                </h2>
                <p className="text-base text-slate-600">Perguntas relacionadas a {section.title.toLowerCase()}.</p>
              </div>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <FaqItem key={item.question} question={item.question} answer={item.answer} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-soft">
            <p className="text-lg font-semibold text-slate-950">Nenhuma resposta encontrada</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Tente outro termo de busca ou use palavras relacionadas para encontrar respostas similares.
            </p>

            {similarSuggestions.length ? (
              <div className="mt-8 text-left">
                <p className="text-sm font-semibold text-slate-700">Perguntas similares que podem ajudar:</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {similarSuggestions.map((item) => (
                    <button
                      key={item.question}
                      type="button"
                      onClick={() => setSearch(item.question)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-slate-100"
                    >
                      {item.question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-500">
                Não encontramos sugestões similares. Tente termos mais gerais como <strong>origem</strong>, <strong>bounce</strong> ou <strong>Supabase</strong>.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm leading-7 text-slate-600 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-950">Sugestões de perguntas para o FAQ</p>
            <p className="mt-3 max-w-2xl">
              Se quiser sugerir uma nova pergunta ou contribuição para este FAQ, envie um email para:{' '}
              <a href="mailto:renato.deacaldas@gmail.com" className="font-semibold text-sky-600 hover:text-sky-500">
                renato.deacaldas@gmail.com
              </a>.
            </p>
          </div>
          <a
            href="mailto:renato.deacaldas@gmail.com"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Enviar sugestão
          </a>
        </div>
      </section>
    </div>
  );
}
