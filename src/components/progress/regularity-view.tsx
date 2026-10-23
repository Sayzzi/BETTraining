import { getFormatter, getTranslations } from "next-intl/server";
import type { ActivityKind, CalendarDay } from "@/engine/regularity";
import type { Regularity } from "@/server/regularity";
import { LineChart } from "./line-chart";

const CELL: Record<ActivityKind, string> = {
  bet: "bg-ardoise",
  light: "border-2 border-ardoise bg-white",
  free_practice: "bg-trait",
  assessment: "bg-chrono",
};

export async function RegularityView({ regularity }: { regularity: Regularity }) {
  const [t, format] = await Promise.all([getTranslations("regularity"), getFormatter()]);
  const thisWeek = regularity.weeks.at(-1)!;
  const dayLabel = (date: string) => format.dateTime(new Date(`${date}T12:00:00`), { weekday: "long", day: "numeric", month: "long" });
  const short = (date: string) => format.dateTime(new Date(`${date}T12:00:00`), { day: "numeric", month: "short" });
  const weekdays = regularity.calendar[0].map((d) =>
    format.dateTime(new Date(`${d.date}T12:00:00`), { weekday: "narrow" }),
  );

  return (
    <section>
      <h2 className="type-wide text-2xl font-bold">{t("title")}</h2>
      <div className="mt-6 grid gap-x-12 gap-y-10 md:grid-cols-[auto_1fr]">
        <div className="space-y-8">
          <div>
            <p className="text-sm text-schiste">{t("streakLabel")}</p>
            <p className="type-wide text-5xl font-extrabold tabular-nums">
              {t("days", { count: regularity.streak.days })}
            </p>
            {regularity.streak.restDays > 0 ? (
              <p className="mt-1 text-sm text-schiste">{t("restIncluded", { count: regularity.streak.restDays })}</p>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-schiste">{t("goalLabel")}</p>
            <p className="type-wide text-3xl font-extrabold tabular-nums">
              {thisWeek.done} / {thisWeek.goal}
            </p>
            <ol className="mt-3 flex gap-1.5" aria-label={t("goalHistory")}>
              {regularity.weeks.map((week) => (
                <li
                  key={week.weekStart}
                  title={t("weekTitle", { date: short(week.weekStart), done: week.done, goal: week.goal })}
                  className={`flex size-7 items-center justify-center rounded-sm text-xs font-bold ${
                    week.reached ? "bg-chrono text-ardoise" : "border border-trait text-schiste"
                  }`}
                >
                  <span aria-hidden="true">{week.reached ? "✓" : week.done}</span>
                  <span className="sr-only">
                    {t("weekTitle", { date: short(week.weekStart), done: week.done, goal: week.goal })}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div>
          <p className="text-sm text-schiste">{t("calendarLabel")}</p>
          <div className="mt-2 inline-grid grid-cols-7 gap-1.5" role="grid" aria-label={t("calendarLabel")}>
            {weekdays.map((weekday, i) => (
              <span key={i} aria-hidden="true" className="text-center text-xs text-schiste">
                {weekday}
              </span>
            ))}
            {regularity.calendar.flat().map((day) => (
              <Day key={day.date} day={day} today={regularity.today} label={dayLabel(day.date)} t={t} />
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-schiste">
            {(["bet", "light", "free_practice", "assessment"] as const).map((kind) => (
              <li key={kind} className="flex items-center gap-2">
                <span aria-hidden="true" className={`size-3.5 rounded-sm ${CELL[kind]}`} />
                {t(`kinds.${kind}`)}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="flex size-3.5 items-center justify-center">
                <span className="size-1.5 rounded-full bg-schiste" />
              </span>
              {t("plannedRest")}
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-14">
        <h2 className="type-wide text-2xl font-bold">{t("loadTitle")}</h2>
        <p className="mt-2 max-w-[62ch] text-schiste">{t("loadIntro")}</p>
        {regularity.loadSpike ? (
          <p role="status" className="mt-4 max-w-[62ch] border-l-2 border-alerte pl-4 font-semibold text-alerte">
            {t("loadSpike")}
          </p>
        ) : null}
        <LoadBars loads={regularity.loads} label={t("loadTitle")} format={short} />

        {regularity.ratings.length > 0 ? (
          <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
            {(["postFatigue", "perceivedEffort", "motivation"] as const).map((key) => {
              const points = regularity.ratings
                .filter((r) => r[key] !== null)
                .map((r) => ({ x: r.date, y: r[key]! }));
              return (
                <div key={key}>
                  <h3 className="font-semibold">{t(`ratings.${key}`)}</h3>
                  <p className="type-wide mt-1 text-3xl font-extrabold tabular-nums">
                    {points.at(-1)?.y ?? "—"}
                    <span className="ml-1 text-base font-semibold text-schiste">/ 10</span>
                  </p>
                  <LineChart
                    points={points}
                    yMin={0}
                    yMax={10}
                    label={t(`ratings.${key}`)}
                    formatY={(value) => String(value)}
                    formatX={short}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-8 text-schiste">{t("noRatings")}</p>
        )}
        <p className="mt-4 max-w-[62ch] text-sm text-schiste">{t("ratingsNote")}</p>
      </div>
    </section>
  );
}

function Day({
  day,
  today,
  label,
  t,
}: {
  day: CalendarDay;
  today: string;
  label: string;
  t: Awaited<ReturnType<typeof getTranslations<"regularity">>>;
}) {
  const state = day.kind ? t(`kinds.${day.kind}`) : day.plannedRest ? t("plannedRest") : day.future ? "" : t("nothing");
  return (
    <span
      role="gridcell"
      aria-label={state ? `${label} : ${state}` : label}
      title={state ? `${label} : ${state}` : label}
      className={`flex size-8 items-center justify-center rounded-sm md:size-9 ${
        day.kind ? CELL[day.kind] : day.future ? "" : "border border-trait/60"
      } ${day.date === today ? "outline-2 outline-offset-2 outline-chrono" : ""}`}
    >
      {day.plannedRest ? <span aria-hidden="true" className="size-1.5 rounded-full bg-schiste" /> : null}
    </span>
  );
}

/** Weekly completed load as columns from zero, the current week in the signal yellow. */
function LoadBars({
  loads,
  label,
  format,
}: {
  loads: Regularity["loads"];
  label: string;
  format: (date: string) => string;
}) {
  const max = Math.max(...loads.map((w) => w.load), 1);
  return (
    <figure className="mt-6 max-w-2xl">
      <div className="flex h-40 items-end gap-2 border-b border-trait" aria-hidden="true">
        {loads.map((week, i) => (
          <div key={week.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs tabular-nums text-schiste">{week.load > 0 ? week.load : ""}</span>
            <div
              className={`w-full rounded-t-sm ${i === loads.length - 1 ? "bg-chrono" : "bg-ardoise"}`}
              style={{ height: `${(week.load / max) * 85}%`, minHeight: week.load > 0 ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-1 flex gap-2 text-xs text-schiste" aria-hidden="true">
        {loads.map((week) => (
          <span key={week.weekStart} className="flex-1 text-center tabular-nums">
            {format(week.weekStart)}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {loads.map((week) => (
            <tr key={week.weekStart}>
              <th scope="row">{format(week.weekStart)}</th>
              <td>{week.load}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
