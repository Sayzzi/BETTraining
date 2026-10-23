import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { SessionListItem } from "@/server/history";

/** Sessions grouped by month, one row each; incomplete sessions are flagged. */
export async function SessionList({ sessions }: { sessions: SessionListItem[] }) {
  const [t, tTitles, format] = await Promise.all([
    getTranslations("history"),
    getTranslations("exerciseTitles"),
    getFormatter(),
  ]);

  const months = new Map<string, SessionListItem[]>();
  for (const session of sessions) {
    const key = format.dateTime(session.startedAt, { month: "long", year: "numeric" });
    months.set(key, [...(months.get(key) ?? []), session]);
  }

  return (
    <div className="space-y-10">
      {[...months.entries()].map(([month, items]) => (
        <section key={month}>
          <h2 className="type-wide text-xl font-bold first-letter:uppercase">{month}</h2>
          <ul className="mt-3 divide-y divide-trait border-y border-trait">
            {items.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/historique/${session.id}`}
                  className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-x-4 gap-y-1 py-4 hover:bg-white/50 md:grid-cols-[6rem_14rem_1fr_auto]"
                >
                  <span className="text-sm text-schiste tabular-nums">
                    <span className="block font-semibold text-ardoise first-letter:uppercase">
                      {format.dateTime(session.startedAt, { weekday: "short", day: "numeric" })}
                    </span>
                    {format.dateTime(session.startedAt, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-semibold">
                    {t(`kinds.${kindKey(session)}`)}
                    {session.status !== "completed" ? (
                      <span className="ml-2 inline-block rounded-sm border border-alerte px-1.5 text-xs font-semibold text-alerte">
                        {t(`statuses.${session.status}`)}
                      </span>
                    ) : null}
                  </span>
                  <span className="col-span-2 row-start-2 text-sm text-schiste md:col-span-1 md:row-start-auto">
                    {session.exercises.length > 0
                      ? format.list([...new Set(session.exercises)].map((e) => tTitles(e)), { type: "unit" })
                      : "—"}
                  </span>
                  <span className="text-right text-sm text-schiste tabular-nums">
                    {session.durationMin === null ? "" : t("minutes", { minutes: session.durationMin })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** A BET session done at rest is cognitive training. */
export function kindKey(session: Pick<SessionListItem, "kind" | "context">) {
  return session.kind === "bet" && session.context === "rest" ? "cognitive" : session.kind;
}
