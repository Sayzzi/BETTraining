import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { MetricProgress } from "@/engine/strengths";
import type { AssessmentDetails } from "@/server/assessment";

export async function AssessmentResultsView({ assessment }: { assessment: AssessmentDetails }) {
  const [t, format] = await Promise.all([getTranslations("assessmentResults"), getFormatter()]);
  const results = assessment.results;
  const date = assessment.completedAt ?? assessment.startedAt;
  const score = (value: number | null) =>
    value === null ? "—" : format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const change = (value: number | null) =>
    value === null ? "—" : format.number(value, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });

  return (
    <>
      <header>
        <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 text-schiste">{format.dateTime(date, { dateStyle: "long", timeStyle: "short" })}</p>
      </header>

      {!results ? (
        <p className="mt-8 max-w-[60ch] text-lg">{t(assessment.status === "incomplete" ? "incomplete" : "pending")}</p>
      ) : (
        <>
          <div className="mt-8 rounded-lg bg-ardoise px-6 py-8 text-brume md:px-10">
            <p className="text-trait">{t("resistanceLabel")}</p>
            <p className="type-wide mt-2 text-[clamp(4rem,14vw,8rem)] leading-none font-extrabold text-chrono tabular-nums">
              {results.fatigueResistance === null
                ? "—"
                : format.number(results.fatigueResistance, { style: "percent", maximumFractionDigits: 0 })}
            </p>
            <p className="mt-4 max-w-[60ch] text-trait">{t("resistanceExplanation")}</p>
          </div>

          <section className="mt-12">
            <h2 className="type-wide text-2xl font-bold">{t("domainsTitle")}</h2>
            <p className="mt-2 max-w-[60ch] text-schiste">{t("domainsIntro")}</p>
            <table className="mt-6 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-ardoise text-sm text-schiste">
                  <th scope="col" className="py-2 pr-3 font-semibold">{t("domain")}</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("cold")}</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("fatigued")}</th>
                  <th scope="col" className="py-2 text-right font-semibold">{t("change")}</th>
                </tr>
              </thead>
              <tbody>
                {results.domains.map((domain) => (
                  <tr key={domain.domain} className="border-b border-trait">
                    <th scope="row" className="py-4 pr-3 font-semibold">
                      {t(`domains.${domain.domain}`)}
                      <span className="block text-sm font-normal text-schiste">{t(`tests.${domain.exercise}`)}</span>
                    </th>
                    <td className="py-4 pr-3 text-right tabular-nums">{score(domain.cold)}</td>
                    <td className="py-4 pr-3 text-right tabular-nums">{score(domain.fatigued)}</td>
                    <td className="type-wide py-4 text-right font-bold tabular-nums">{change(domain.change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-schiste">{t("scoreUnit")}</p>
          </section>

          <section className="mt-12">
            <h2 className="type-wide text-2xl font-bold">{t("comparisonTitle")}</h2>
            {results.comparison ? (
              <>
                <p className="mt-2 max-w-[60ch] text-schiste">
                  {t("comparisonIntro", {
                    date: format.dateTime(new Date(results.comparison.previousCompletedAt), { dateStyle: "long" }),
                  })}
                </p>
                <div className="mt-6">
                  {/* Column headings from tablet width up; on phones each metric carries its own label. */}
                  <div
                    aria-hidden="true"
                    className="hidden border-b border-ardoise py-2 text-sm font-semibold text-schiste md:grid md:grid-cols-[1fr_8rem_8rem_8rem_8rem] md:gap-3"
                  >
                    <span>{t("domain")}</span>
                    <span className="text-right">{t("reactionTime")}</span>
                    <span className="text-right">{t("regularity")}</span>
                    <span className="text-right">{t("accuracy")}</span>
                    <span className="text-right">{t("ranking")}</span>
                  </div>
                  <ul>
                    {results.comparison.domains.map((domain) => (
                      <li
                        key={domain.domain}
                        className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-3 border-b border-trait py-4 md:grid-cols-[1fr_8rem_8rem_8rem_8rem] md:items-center"
                      >
                        <span className="font-semibold">{t(`domains.${domain.domain}`)}</span>
                        <span className="text-right md:order-last">
                          <span
                            className={`inline-block rounded-sm px-2 py-0.5 text-sm font-semibold whitespace-nowrap ${
                              domain.classification === "strength"
                                ? "bg-chrono text-ardoise"
                                : "border border-ardoise text-ardoise"
                            }`}
                          >
                            {t(domain.classification)}
                          </span>
                        </span>
                        <dl className="col-span-2 grid grid-cols-3 gap-3 md:contents">
                          {(
                            [
                              ["reactionTime", domain.reactionTime],
                              ["regularity", domain.regularity],
                              ["accuracy", domain.accuracy],
                            ] as const
                          ).map(([label, metric]) => (
                            <div key={label} className="md:text-right">
                              <dt className="text-sm text-schiste md:sr-only">{t(label)}</dt>
                              <dd className="tabular-nums">
                                <Progress metric={metric} format={format} progressedLabel={t("progressed")} />
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-3 max-w-[70ch] text-sm text-schiste">{t("rankingRule")}</p>
              </>
            ) : (
              <p className="mt-2 max-w-[60ch] text-schiste">{t("firstAssessment")}</p>
            )}
          </section>

          <section className="mt-12">
            <h2 className="type-wide text-2xl font-bold">{t("detailTitle")}</h2>
            <ul className="mt-4 divide-y divide-trait border-y border-trait">
              {assessment.runs.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/entrainement/resultats/${run.id}`}
                    className="flex justify-between gap-4 py-3 hover:underline hover:underline-offset-4"
                  >
                    <span>{t(`tests.${run.exercise}`)}</span>
                    <span className="text-schiste">{t(`blocks.${run.block}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="mt-12 flex flex-wrap gap-6">
        <Link href="/" className="h-12 rounded-md bg-ardoise px-6 leading-12 font-semibold text-brume">
          {t("home")}
        </Link>
        <Link href="/bilan" className="leading-12 font-semibold underline underline-offset-4">
          {t("retake")}
        </Link>
      </div>
    </>
  );
}

/** Relative improvement with its sign (positive is better); a check mark when it meets the rule. */
function Progress({
  metric,
  format,
  progressedLabel,
}: {
  metric: MetricProgress;
  format: Awaited<ReturnType<typeof getFormatter>>;
  progressedLabel: string;
}) {
  if (metric.change === null) return <>—</>;
  return (
    <span className={metric.progressed ? "font-bold" : "text-schiste"}>
      {format.number(metric.change, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" })}
      {metric.progressed ? (
        <>
          <span aria-hidden="true"> ✓</span>
          <span className="sr-only"> {progressedLabel}</span>
        </>
      ) : null}
    </span>
  );
}
