import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { BetSessionSummary } from "@/server/bet-session";
import { PlanExplanationText } from "./plan-explanation";

export async function SessionSummaryView({ summary }: { summary: BetSessionSummary }) {
  const [t, tTests, format] = await Promise.all([
    getTranslations("sessionSummary"),
    getTranslations("assessmentResults.tests"),
    getFormatter(),
  ]);
  const tSession = await getTranslations("session");
  const signed = (value: number) => format.number(Math.round(value), { signDisplay: "exceptZero" });
  const check = summary.fatigueCheck;
  const exerciseName = (exercise: string) =>
    tTests.has(exercise) ? tTests(exercise) : t(`exercises.${exercise as "pvt" | "flanker" | "choice_rt"}`);

  return (
    <>
      <header>
        <h1 className="type-wide text-4xl font-extrabold">
          {summary.kind === "light" ? t("lightTitle") : summary.context === "rest" ? t("cognitiveTitle") : t("title")}
        </h1>
        <p className="mt-2 text-schiste">
          {t("meta", {
            date: format.dateTime(summary.startedAt, { dateStyle: "long", timeStyle: "short" }),
            duration: summary.durationMin,
            context: t(`contextsInline.${summary.context}`),
          })}
        </p>
      </header>

      {summary.status === "incomplete" ? (
        <p className="mt-6 max-w-[60ch] font-semibold text-alerte">{t("incomplete")}</p>
      ) : null}
      {summary.fatigueAdvice ? (
        <p className="mt-4 max-w-[60ch] text-schiste">{t(`fatigueAdvice.${summary.fatigueAdvice}`)}</p>
      ) : null}

      {summary.kind === "bet" ? (
        <div className="mt-8 rounded-lg bg-ardoise px-6 py-8 text-brume md:px-10">
          <p className="text-trait">{t("fatigueCheckLabel")}</p>
          {check ? (
            <>
              <p className="type-wide mt-2 flex items-baseline gap-3 leading-none font-extrabold text-chrono">
                <span className="text-[clamp(3.5rem,12vw,7rem)] tabular-nums">{signed(check.meanRtChangeMs)}</span>
                <span className="text-2xl md:text-3xl">ms</span>
              </p>
              <p className="mt-4 max-w-[60ch] text-trait">
                {t("fatigueCheckBody", { lapses: signed(check.lapsesChange) })}
              </p>
            </>
          ) : (
            <p className="mt-3 max-w-[60ch] text-trait">{t("fatigueCheckMissing")}</p>
          )}
        </div>
      ) : null}

      <dl className="mt-10 grid grid-cols-2 gap-x-8 md:grid-cols-4">
        {[
          { label: t("load"), value: summary.sessionLoad === null ? "—" : format.number(summary.sessionLoad) },
          { label: t("effort"), value: rating(summary.ratings.perceivedEffort) },
          {
            label: t("fatigue"),
            value: `${rating(summary.ratings.preFatigue)} → ${rating(summary.ratings.postFatigue)}`,
          },
          { label: t("motivation"), value: rating(summary.ratings.motivation) },
        ].map((stat) => (
          <div key={stat.label} className="border-t border-trait py-4">
            <dt className="text-sm text-schiste">{stat.label}</dt>
            <dd className="type-wide mt-1 text-2xl font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-schiste">{t("loadExplanation")}</p>

      {summary.explanation ? (
        <section className="mt-12 max-w-[60ch]">
          <h2 className="type-wide text-2xl font-bold">{t("whyTitle")}</h2>
          <div className="mt-3 text-lg">
            <PlanExplanationText explanation={summary.explanation} />
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="type-wide text-2xl font-bold">{t("exercisesTitle")}</h2>
        <ul className="mt-4 divide-y divide-trait border-y border-trait">
          {summary.runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/entrainement/resultats/${run.id}`}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 hover:underline hover:underline-offset-4 md:grid-cols-[14rem_1fr_auto]"
              >
                <span className="font-semibold">{exerciseName(run.exercise)}</span>
                <span className="text-schiste md:order-none">{tSession(`blocks.${run.block}.title`)}</span>
                <span className="col-span-2 text-schiste tabular-nums md:col-span-1 md:text-right">
                  {run.results
                    ? t("runLine", {
                        rt: run.results.meanRtMs === null ? "—" : `${Math.round(run.results.meanRtMs)} ms`,
                        accuracy:
                          run.results.accuracy === null
                            ? "—"
                            : format.number(run.results.accuracy, { style: "percent", maximumFractionDigits: 0 }),
                      })
                    : t("runNotDone")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap gap-6">
        <Link href="/" className="h-12 rounded-md bg-ardoise px-6 leading-12 font-semibold text-brume">
          {t("home")}
        </Link>
      </div>
    </>
  );

  function rating(value: number | null) {
    return value === null ? "—" : String(value);
  }
}
