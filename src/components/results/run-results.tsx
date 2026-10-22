import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { DifficultySnapshot } from "@/engine/exercises";
import type { MinuteResult } from "@/engine/results";
import type { RunDetails } from "@/server/training";

export async function RunResults({ run }: { run: RunDetails }) {
  const [t, format] = await Promise.all([getTranslations("results"), getFormatter()]);
  const results = run.results;
  const heading = (
    <header>
      <h1 className="type-wide text-4xl font-extrabold">
        {t.has(`titles.${run.exercise}`) ? t(`titles.${run.exercise}`) : t("titles.pvt")}
      </h1>
      <p className="mt-2 text-schiste">
        {format.dateTime(run.startedAt, { dateStyle: "long", timeStyle: "short" })}
        {", "}
        {t("duration", { minutes: Math.round(run.config.durationMs / 60_000) })}
      </p>
    </header>
  );

  const actions = (
    <div className="mt-12 flex flex-wrap gap-6">
      <Link
        href={`/entrainement/${run.exercise}`}
        className="h-12 rounded-md bg-ardoise px-6 leading-12 font-semibold text-brume"
      >
        {t("again")}
      </Link>
      <Link href="/entrainement" className="leading-12 font-semibold underline underline-offset-4">
        {t("backToList")}
      </Link>
    </div>
  );

  if (!results) {
    return (
      <>
        {heading}
        <p className="mt-8 max-w-[60ch] text-lg">{t(run.status === "incomplete" ? "incomplete" : "pending")}</p>
        {actions}
      </>
    );
  }

  const hasLapses = results.lapseThresholdMs !== null;
  const describe = (snapshot: DifficultySnapshot) => {
    const level = format.number(snapshot.level, { maximumFractionDigits: 2 });
    if ("n" in snapshot) {
      return t("difficultyNBack", {
        level,
        n: snapshot.n,
        seconds: format.number(snapshot.soaMs / 1000, { maximumFractionDigits: 1 }),
      });
    }
    if (!("incongruentRate" in snapshot)) {
      return t("difficultySpeed", {
        level,
        seconds: format.number(snapshot.responseWindowMs / 1000, { maximumFractionDigits: 1 }),
      });
    }
    return t("difficultyChoice", {
      level,
      incongruent: format.number(snapshot.incongruentRate, { style: "percent", maximumFractionDigits: 0 }),
      seconds: format.number(snapshot.responseWindowMs / 1000, { maximumFractionDigits: 1 }),
    });
  };

  const percent = (value: number | null) =>
    value === null ? "—" : format.number(value, { style: "percent", maximumFractionDigits: 0 });
  const ms = (value: number | null) => (value === null ? "—" : format.number(Math.round(value)));

  const stats = [
    hasLapses
      ? { label: t("lapses", { threshold: results.lapseThresholdMs! }), value: format.number(results.lapses) }
      : { label: t("errors"), value: format.number(results.errors) },
    { label: t("accuracy"), value: percent(results.accuracy) },
    { label: t("variability"), value: percent(results.rtCv) },
    {
      label: t("rateCorrect"),
      value:
        results.rateCorrectPerSecond === null
          ? "—"
          : format.number(results.rateCorrectPerSecond, { maximumFractionDigits: 2 }),
    },
    hasLapses
      ? { label: t("falseStarts"), value: format.number(results.falseStarts) }
      : { label: t("misses"), value: format.number(results.misses) },
    { label: t("trials"), value: format.number(results.trialCount) },
  ];

  return (
    <>
      {heading}
      <div className="mt-8 rounded-lg bg-ardoise px-6 py-8 text-brume md:px-10">
        <p className="type-wide flex items-baseline gap-3 leading-none font-extrabold text-chrono">
          <span className="text-[clamp(4rem,14vw,8rem)] tabular-nums">{ms(results.meanRtMs)}</span>
          <span className="text-2xl md:text-3xl">ms</span>
        </p>
        <p className="mt-4 text-trait">{t(hasLapses ? "meanRt" : "meanRtChoice")}</p>
        {results.congruencyEffectMs !== null ? (
          <p className="mt-3 max-w-[60ch] text-brume">
            {t("congruencyEffect", {
              value: format.number(Math.round(results.congruencyEffectMs), { signDisplay: "exceptZero" }),
            })}
          </p>
        ) : null}
      </div>

      {run.difficultyStart && run.difficultyEnd ? (
        <section className="mt-10">
          <h2 className="type-wide text-2xl font-bold">{t("difficultyTitle")}</h2>
          <p className="mt-2 max-w-[60ch] text-lg">
            {t("difficultyChange", { start: describe(run.difficultyStart), end: describe(run.difficultyEnd) })}
          </p>
          <p className="mt-1 text-schiste">{t("difficultyNext")}</p>
        </section>
      ) : null}

      <dl className="mt-10 grid grid-cols-2 gap-x-8 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="border-t border-trait py-4">
            <dt className="text-sm text-schiste">{stat.label}</dt>
            <dd className="type-wide mt-1 text-2xl font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {results.minutes.length > 0 ? (
        <section className="mt-12">
          <h2 className="type-wide text-2xl font-bold">{t("minuteTitle")}</h2>
          <p className="mt-2 max-w-[60ch] text-schiste">{t(hasLapses ? "minuteIntro" : "minuteIntroChoice")}</p>
          <MinuteChart minutes={results.minutes} labels={{ minute: t("minuteLabel"), lapses: t("minuteLapses") }} />
        </section>
      ) : null}
      {actions}
    </>
  );
}

function MinuteChart({ minutes, labels }: { minutes: MinuteResult[]; labels: { minute: string; lapses: string } }) {
  const max = Math.max(...minutes.map((m) => m.meanRtMs ?? 0), 1);
  return (
    <table className="mt-6 w-full border-collapse">
      <caption className="sr-only">{labels.minute}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{labels.minute}</th>
          <th scope="col">ms</th>
          <th scope="col">{labels.lapses}</th>
        </tr>
      </thead>
      <tbody>
        {minutes.map((m) => (
          <tr key={m.minute} className="border-b border-trait last:border-b-0">
            <th scope="row" className="w-16 py-2 pr-3 text-left text-sm font-semibold tabular-nums">
              {m.minute + 1}
            </th>
            <td className="py-2">
              <div className="flex items-center gap-3">
                <div
                  className="h-4 rounded-sm bg-ardoise"
                  style={{ width: `${((m.meanRtMs ?? 0) / max) * 100}%`, minWidth: m.meanRtMs ? 4 : 0 }}
                />
                <span className="w-16 shrink-0 text-sm whitespace-nowrap tabular-nums">
                  {m.meanRtMs === null ? "—" : `${Math.round(m.meanRtMs)} ms`}
                </span>
              </div>
            </td>
            <td className="w-28 py-2 text-right text-sm whitespace-nowrap tabular-nums">
              {m.lapses > 0 ? (
                <span className="rounded-sm bg-chrono px-1.5 py-0.5 font-semibold text-ardoise">
                  {m.lapses} {labels.lapses}
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
