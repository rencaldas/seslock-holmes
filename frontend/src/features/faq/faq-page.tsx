import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/use-i18n";

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function searchTokens(value: string) {
  return normalizeQuery(value).split(/\W+/).filter(Boolean);
}

function getFaqItemRelevance(item: { question: string; answer: string }, queryTokens: string[]) {
  const haystack = `${item.question} ${item.answer}`.toLowerCase();
  return queryTokens.reduce((score, token) => {
    if (!token) {
      return score;
    }

    let next = score;
    if (haystack.includes(token)) next += 3;
    if (item.question.toLowerCase().includes(token)) next += 2;
    if (item.answer.toLowerCase().includes(token)) next += 1;
    return next;
  }, 0);
}

export function FaqPage() {
  const t = useI18n();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const sections = [
    { key: "about", title: t.faq.sections.about },
    { key: "usage", title: t.faq.sections.usage },
    { key: "data", title: t.faq.sections.data },
    { key: "support", title: t.faq.sections.support },
  ];

  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: t.faqItems.filter((item) => item.section === section.key && (item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query))),
        }))
        .filter((section) => section.items.length > 0),
    [query, t],
  );

  const similarSuggestions = useMemo(() => {
    const tokens = searchTokens(query);
    if (!tokens.length) {
      return [];
    }

    return t.faqItems
      .map((item) => ({
        ...item,
        score: getFaqItemRelevance(item, tokens),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [query, t]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-soft">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-4 py-2 text-slate-600">
              <BookOpen className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{t.faq.title}</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">{t.faq.subtitle}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">Read only</span>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">Filters</span>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">Supabase</span>
            </div>
          </div>
          <Card className="border-slate-800 bg-slate-950 text-white shadow-none">
            <CardHeader className="border-b-0 px-6 py-4">
              <CardTitle className="text-white">{t.faq.searchHelpTitle}</CardTitle>
              <CardDescription className="text-slate-400">
                {t.faq.searchPlaceholder}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <div className="flex items-center gap-3 rounded-3xl bg-slate-900/95 px-4 py-4 shadow-lg shadow-slate-900/10">
                <Search className="h-5 w-5 text-slate-300" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.faq.searchPlaceholder}
                  className="border-slate-800 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-slate-600 focus:ring-slate-600/20"
                />
              </div>
              <div className="mt-6 text-sm leading-7 text-slate-300">
                <p>{t.faq.searchHelpDescription}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        {visibleSections.length ? (
          visibleSections.map((section) => (
            <div key={section.key} className="space-y-4">
              <div className="px-2 py-2">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {section.title}
                </h2>
              </div>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <details key={item.question} className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft transition duration-200 hover:border-slate-300">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-slate-950 transition hover:bg-slate-50">
                      <span>{item.question}</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition duration-200 group-open:rotate-45 group-open:border-slate-300">
                        +
                      </span>
                    </summary>
                    <div className="border-t border-slate-100 px-6 py-5 text-sm leading-7 text-slate-600">{item.answer}</div>
                  </details>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-soft">
            <p className="text-lg font-semibold text-slate-950">{t.faq.emptyTitle}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{t.faq.emptyDescription}</p>

            {similarSuggestions.length ? (
              <div className="mt-8 text-left">
                <p className="text-sm font-semibold text-slate-700">{t.faq.suggestionsTitle}</p>
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
              <p className="mt-6 text-sm text-slate-500">{t.faq.emptyDescription}</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm leading-7 text-slate-600 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-950">{t.faq.suggestionsTitle}</p>
            <p className="mt-3 max-w-2xl">
              {t.faq.sendSuggestion}:{' '}
              <a href="mailto:renato.deacaldas@gmail.com" className="font-semibold text-sky-600 hover:text-sky-500">
                renato.deacaldas@gmail.com
              </a>
            </p>
          </div>
          <a
            href="mailto:renato.deacaldas@gmail.com"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {t.faq.suggestionsEmail}
          </a>
        </div>
      </section>
    </div>
  );
}
