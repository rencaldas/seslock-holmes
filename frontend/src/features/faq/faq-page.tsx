import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  ChevronDown,
  Compass,
  Database,
  LifeBuoy,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type FaqSectionKey = "about" | "usage" | "reports" | "access" | "data" | "support";

const SECTION_ICONS: Record<FaqSectionKey, typeof BookOpen> = {
  about: BookOpen,
  usage: Compass,
  reports: Mail,
  access: ShieldCheck,
  data: Database,
  support: LifeBuoy,
};

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
  const [activeSection, setActiveSection] = useState<FaqSectionKey | "all">("all");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const query = search.trim().toLowerCase();

  const sections: Array<{ key: FaqSectionKey; title: string }> = [
    { key: "about", title: t.faq.sections.about },
    { key: "usage", title: t.faq.sections.usage },
    { key: "reports", title: t.faq.sections.reports },
    { key: "access", title: t.faq.sections.access },
    { key: "data", title: t.faq.sections.data },
    { key: "support", title: t.faq.sections.support },
  ];

  const sectionCounts = useMemo(() => {
    const counts = new Map<FaqSectionKey, number>();
    for (const item of t.faqItems) {
      counts.set(item.section, (counts.get(item.section) ?? 0) + 1);
    }
    return counts;
  }, [t]);

  const tabItems = [
    {
      value: "all",
      label: t.faq.allSectionsLabel,
      badge: (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            activeSection === "all" ? "bg-white/25 text-white" : "bg-slate-100 text-ink-muted dark:bg-slate-800",
          )}
        >
          {t.faqItems.length}
        </span>
      ),
    },
    ...sections.map((section) => ({
      value: section.key,
      label: section.title,
      badge: (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            activeSection === section.key ? "bg-white/25 text-white" : "bg-slate-100 text-ink-muted dark:bg-slate-800",
          )}
        >
          {sectionCounts.get(section.key) ?? 0}
        </span>
      ),
    })),
  ];

  const visibleSections = useMemo(
    () =>
      sections
        .filter((section) => activeSection === "all" || section.key === activeSection)
        .map((section) => ({
          ...section,
          items: t.faqItems.filter(
            (item) =>
              item.section === section.key &&
              (item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query)),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [activeSection, query, t],
  );

  const totalVisible = visibleSections.reduce((sum, section) => sum + section.items.length, 0);

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
      <section className="space-y-3">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand">
          <Sparkles className="h-3.5 w-3.5" />
          {t.faq.title}
        </p>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{t.faq.subtitle}</h1>

        <div className="flex items-center gap-3 rounded-control border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10 dark:border-slate-800 dark:bg-slate-900">
          <Search className="h-4.5 w-4.5 shrink-0 text-ink-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.faq.searchPlaceholder}
            className="border-0 bg-transparent p-0 text-sm text-ink shadow-none placeholder:text-ink-muted focus-visible:ring-0"
          />
        </div>
      </section>

      <div className="sticky top-16 z-10 -mx-4 bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <Tabs
          items={tabItems}
          value={activeSection}
          onChange={(value) => setActiveSection(value as FaqSectionKey | "all")}
        />
      </div>

      <section className="space-y-8">
        {totalVisible ? (
          visibleSections.map((section) => {
            const Icon = SECTION_ICONS[section.key];
            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand-soft text-brand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold tracking-tight text-ink sm:text-xl">{section.title}</h2>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {section.items.map((item) => {
                    const isOpen = openQuestion === item.question;
                    return (
                      <div
                        key={item.question}
                        className={cn(
                          "overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-900",
                          isOpen && "border-brand/40 shadow-card",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenQuestion(isOpen ? null : item.question)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-semibold text-ink transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        >
                          <span>{item.question}</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200",
                              isOpen && "rotate-180 text-brand",
                            )}
                          />
                        </button>
                        <div
                          className={cn(
                            "grid transition-all duration-200 ease-out",
                            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                          )}
                        >
                          <div className="overflow-hidden">
                            <p className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-ink-muted dark:border-slate-800">
                              {item.answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-panel border border-slate-200 bg-white p-10 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-lg font-bold text-ink">{t.faq.emptyTitle}</p>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{t.faq.emptyDescription}</p>

            {similarSuggestions.length ? (
              <div className="mt-8 text-left">
                <p className="text-sm font-semibold text-ink">{t.faq.suggestionsTitle}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {similarSuggestions.map((item) => (
                    <button
                      key={item.question}
                      type="button"
                      onClick={() => {
                        setSearch(item.question);
                        setActiveSection("all");
                      }}
                      className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-ink transition hover:border-brand/40 hover:bg-brand-soft dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      {item.question}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-panel border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
            <BadgeCheck className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">{t.faq.suggestionsTitle}</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              {t.faq.sendSuggestion}{" "}
              <a href="mailto:renato.deacaldas@gmail.com" className="font-semibold text-brand hover:text-brand-hover">
                renato.deacaldas@gmail.com
              </a>
            </p>
          </div>
        </div>
        <a
          href="mailto:renato.deacaldas@gmail.com"
          className="inline-flex shrink-0 items-center justify-center rounded-control bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {t.faq.suggestionsEmail}
        </a>
      </section>
    </div>
  );
}
