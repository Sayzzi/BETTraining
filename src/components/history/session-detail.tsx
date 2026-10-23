import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { MinuteChart } from "@/components/results/minute-chart";
import type { SessionDetail } from "@/server/history";
import { kindKey } from "./session-list";

export async function SessionDetailView({ session }: { session: SessionDetail }) {
  const [t, tTitles, tResults, format] = await Promise.all([
    getTranslations("history"),
    getTranslations("exerciseTitles"),
    getTranslations("results"),
    getFormatter(),
  ]);
  const percent = (value: number | null) =>
    value === null ? "—" : format.number(value, { style: "percent", maximumFractionDigits: 0 });
  const summaryHref =
    session.kind === "bet" || session.kind === "light"
      ? `/seance/resultats/${session.id}`
      : session.assessmentId
        ? `/bilan/resultats/${session.assessmentId}`
        : null;

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-schiste">
          <Link href="/historique" className="underline underline-offset-4">
            {t("title")}
          </Link>
        </p>
        <h1 className="type-wide mt-2 text-4xl font-extrabold">{t(`kinds.${kindKey(session)}`)}</h1>
        <p className="mt-2 text-schiste">
          {format.dateTime(session.startedAt, { dateStyle: "full", timeStyle: "short" })}
          {session.durationMin === null ? "" : `, ${t("minutes", { minutes: session.durationMin })}`}
          {session.context ? `, ${t(`contexts.${session.context}`)}` : ""}
        </p>
        {session.status !== "completed" ? (
          <p className="mt-4 max-w-[60ch] font-semibold text-alerte">{t(`statusNotes.${session.status}`)}</p>
        ) : null}
        {summaryHref ? (
          <Link href={summaryHref} className="mt-4 inline-block font-semibold underline underline-offset-4">
            {t(session.kind === "assessment" ? "seeAssessment" : "seeSummary")}
          </Link>
        ) : null}
      </header>

      <div className="mt-10 space-y-12">
        {session.runs.map((run) => {
          const results = run.results;
          const hasLapses = results?.lapseThresholdMs != null;
          return (
            <section key={run.id} className="border-t border-ardoise pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 className="type-wide text-2xl font-bold">{tTitles(run.exercise)}</h2>
                {run.block ? <p className="text-schiste">{t(`blocks.${run.block}`)}</p> : null}
              </div>

              {!results ? (
                <p className="mt-3 text-schiste">{t(run.status === "incomplete" ? "runIncomplete" : "runPending")}</p>
              ) : (
                <>
                  <dl className="mt-4 grid grid-cols-2 gap-x-8 md:grid-cols-4">
                    {[
                      {
                        label: t("meanRt"),
                        value: results.meanRtMs === null ? "—" : `${format.number(Math.round(results.meanRtMs))} ms`,
                      },
                      { label: t("accuracy"), value: percent(results.accuracy) },
                      { label: t("variability"), value: percent(results.rtCv) },
                      hasLapses
                        ? { label: t("lapses"), value: format.number(results.lapses) }
                        : { label: t("errors"), value: format.number(results.errors) },
                    ].map((stat) => (
                      <div key={stat.label} className="border-t border-trait py-3">
                        <dt className="text-sm text-schiste">{stat.label}</dt>
                        <dd className="type-wide mt-1 text-xl font-bold tabular-nums">{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {run.difficultyStart ? (
                    <p className="mt-3 text-sm text-schiste">
                      {t("difficulty", {
                        start: format.number(run.difficultyStart.level, { maximumFractionDigits: 2 }),
                        end:
                          run.difficultyEnd === null
                            ? "—"
                            : format.number(run.difficultyEnd.level, { maximumFractionDigits: 2 }),
                      })}
                    </p>
                  ) : null}
                  {results.minutes.length > 0 ? (
                    <MinuteChart
                      minutes={results.minutes}
                      labels={{
                        minute: tResults("minuteLabel"),
                        lapses: tResults("minuteLapses"),
                        change: tResults("minuteChange"),
                        reference: tResults("minuteReference"),
                      }}
                    />
                  ) : null}
                  <Link
                    href={`/entrainement/resultats/${run.id}`}
                    className="mt-3 inline-block text-sm font-semibold underline underline-offset-4"
                  >
                    {t("runDetail")}
                  </Link>
                </>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
