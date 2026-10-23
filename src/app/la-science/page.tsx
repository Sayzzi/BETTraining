import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EffectChart } from "@/components/science/effect-chart";
import { doiUrl, SOURCE_IDS, SOURCES } from "@/content/science";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("science");
  return { title: t("metaTitle"), description: t("intro") };
}

const SHOWN = ["fatigued", "sport", "certainty"] as const;
const NOT_SHOWN = ["effort", "vo2max", "premise", "independence", "practice", "transfer"] as const;
const APP = ["rest", "measure", "load", "promise"] as const;

// Public page: readable without an account, so it has its own light header.
export default async function SciencePage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-trait py-5">
        <Link href="/" className="type-wide text-lg font-bold">
          {t("brand")}
        </Link>
        <Link href="/" className="text-sm font-semibold underline-offset-4 hover:underline">
          {t("science.openApp")}
        </Link>
      </header>
      <main className="flex-1 py-10 md:py-16">
        <h1 className="type-wide max-w-[14ch] text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.95] font-extrabold">
          {t("science.title")}
        </h1>
        <p className="mt-6 max-w-[56ch] text-lg">{t("science.intro")}</p>
        <p className="mt-3 text-sm text-schiste">{t("science.updated")}</p>

        <Section title={t("science.what.title")}>
          <div className="flex max-w-[64ch] flex-col gap-4">
            <p>{t("science.what.p1")}</p>
            <p>{t("science.what.p2")}</p>
            <p>{t("science.what.p3")}</p>
          </div>
        </Section>

        <Section title={t("science.shown.title")}>
          <Findings items={SHOWN.map((key) => t(`science.shown.${key}`))} filled />
          <h3 className="type-wide mt-12 text-lg font-bold">{t("science.chart.title")}</h3>
          <div className="mt-6">
            <EffectChart />
          </div>
        </Section>

        <Section title={t("science.notShown.title")}>
          <Findings items={NOT_SHOWN.map((key) => t(`science.notShown.${key}`))} />
        </Section>

        <Section title={t("science.app.title")}>
          <ul className="flex max-w-[64ch] list-disc flex-col gap-3 pl-5">
            {APP.map((key) => (
              <li key={key}>{t(`science.app.${key}`)}</li>
            ))}
          </ul>
        </Section>

        <Section title={t("science.sources.title")}>
          <p className="text-schiste">{t("science.sources.intro")}</p>
          <ul className="mt-6 flex flex-col divide-y divide-trait border-y border-trait">
            {SOURCE_IDS.map((id) => (
              <li key={id} className="py-4">
                <p className="font-semibold">{t(`science.sources.notes.${id}`)}</p>
                <p className="mt-1 text-sm text-schiste">
                  {SOURCES[id].citation}{" "}
                  <a
                    href={doiUrl(SOURCES[id].doi)}
                    className="break-all text-ardoise underline underline-offset-4"
                    rel="noreferrer"
                    target="_blank"
                  >
                    doi:{SOURCES[id].doi}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16 md:mt-20">
      <h2 className="type-wide text-2xl font-extrabold md:text-3xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A finding the studies support (filled marker) or do not (hollow marker). */
function Findings({ items, filled = false }: { items: string[]; filled?: boolean }) {
  return (
    <ul className="flex max-w-[64ch] flex-col gap-5">
      {items.map((item) => (
        <li key={item} className="grid grid-cols-[0.75rem_1fr] gap-4">
          <span
            aria-hidden="true"
            className={`mt-1.5 size-3 border-2 border-ardoise ${filled ? "bg-ardoise" : ""}`}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
