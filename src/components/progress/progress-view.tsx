import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { DOMAINS } from "@/engine/exercises";
import type { Progress } from "@/server/progress";
import { LineChart } from "./line-chart";

const LEVEL_MIN = 1;
const LEVEL_MAX = 15;

export async function ProgressView({ progress }: { progress: Progress }) {
  const [t, tDomains, format] = await Promise.all([
    getTranslations("progress"),
    getTranslations("assessmentResults.domains"),
    getFormatter(),
  ]);
  const day = (date: string) => format.dateTime(new Date(`${date}T12:00:00`), { day: "numeric", month: "short" });
  const level = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const percent = (value: number | null) =>
    value === null ? "—" : format.number(value, { style: "percent", maximumFractionDigits: 0 });
  const withResistance = progress.assessments.filter((a) => a.fatigueResistance !== null);

  return (
    <>
      <section>
        <h2 className="type-wide text-2xl font-bold">{t("levelsTitle")}</h2>
        <p className="mt-2 max-w-[62ch] text-schiste">{t("levelsIntro")}</p>
        <div className="mt-8 grid gap-x-10 gap-y-12 md:grid-cols-2">
          {DOMAINS.map((domain) => {
            const points = progress.levels[domain];
            const current = points.at(-1)?.level;
            const ranking = progress.classification[domain];
            return (
              <div key={domain}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold">{tDomains(domain)}</h3>
                  {ranking ? (
                    <span
                      className={`rounded-sm px-2 py-0.5 text-sm font-semibold ${
                        ranking === "strength" ? "bg-chrono text-ardoise" : "border border-ardoise"
                      }`}
                    >
                      {t(ranking)}
                    </span>
                  ) : null}
                </div>
                {current === undefined ? (
                  <p className="mt-3 text-schiste">{t("noLevel")}</p>
                ) : (
                  <>
                    <p className="type-wide mt-1 text-4xl font-extrabold tabular-nums">
                      {level(current)}
                      <span className="ml-2 text-base font-semibold text-schiste">{t("outOf", { max: LEVEL_MAX })}</span>
                    </p>
                    <LineChart
                      points={points.map((p) => ({ x: p.date, y: p.level }))}
                      yMin={LEVEL_MIN}
                      yMax={LEVEL_MAX}
                      label={t("levelChartLabel", { domain: tDomains(domain) })}
                      formatY={level}
                      formatX={day}
                    />
                  </>
                )}
                {domain === "sustained_attention" ? <p className="mt-2 text-sm text-schiste">{t("attentionNote")}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="type-wide text-2xl font-bold">{t("assessmentsTitle")}</h2>
        {progress.assessments.length === 0 ? (
          <p className="mt-3 max-w-[60ch] text-schiste">
            {t("noAssessment")}{" "}
            <Link href="/bilan" className="font-semibold text-ardoise underline underline-offset-4">
              {t("takeAssessment")}
            </Link>
          </p>
        ) : (
          <>
            <p className="mt-2 max-w-[62ch] text-schiste">{t("assessmentsIntro")}</p>
            {withResistance.length > 0 ? (
              <div className="mt-6 max-w-md">
                <h3 className="font-semibold">{t("resistanceTitle")}</h3>
                <p className="type-wide mt-1 text-4xl font-extrabold tabular-nums">
                  {percent(withResistance.at(-1)!.fatigueResistance)}
                </p>
                <LineChart
                  points={withResistance.map((a) => ({ x: a.date, y: a.fatigueResistance! }))}
                  yMin={0.5}
                  yMax={1.1}
                  reference={1}
                  label={t("resistanceTitle")}
                  formatY={(value) => percent(value)}
                  formatX={day}
                />
              </div>
            ) : null}
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-ardoise text-sm text-schiste">
                    <th scope="col" className="py-2 pr-3 font-semibold">{t("date")}</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("resistanceShort")}</th>
                    {DOMAINS.map((domain) => (
                      <th key={domain} scope="col" className="py-2 pr-3 text-right font-semibold">
                        {tDomains(domain)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...progress.assessments].reverse().map((a) => (
                    <tr key={a.id} className="border-b border-trait">
                      <th scope="row" className="py-3 pr-3 font-semibold">
                        <Link href={`/bilan/resultats/${a.id}`} className="underline underline-offset-4">
                          {format.dateTime(new Date(`${a.date}T12:00:00`), { dateStyle: "medium" })}
                        </Link>
                      </th>
                      <td className="py-3 pr-3 text-right tabular-nums">{percent(a.fatigueResistance)}</td>
                      {DOMAINS.map((domain) => {
                        const score = a.scores[domain];
                        return (
                          <td key={domain} className="py-3 pr-3 text-right tabular-nums">
                            {score == null ? "—" : format.number(score, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-schiste">{t("scoreNote")}</p>
          </>
        )}
      </section>
    </>
  );
}
