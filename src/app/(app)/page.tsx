import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PlanExplanationText } from "@/components/session/plan-explanation";
import { db } from "@/db/client";
import type { AssessmentResults } from "@/engine/assessment";
import { getCurrentUser } from "@/lib/current-user";
import { latestAssessments } from "@/server/assessment";
import { previewBetSession, previewLightSession } from "@/server/bet-session";
import { getDailySession } from "@/server/daily";
import { PostponeAssessmentButton } from "@/components/postpone-assessment-button";
import { refreshLoad } from "@/server/load";
import { getPreferences } from "@/server/preferences";

const PRIMARY = "inline-block h-12 rounded-md bg-ardoise px-6 leading-12 font-semibold text-brume hover:bg-ardoise/90";
const SECONDARY = "leading-12 font-semibold underline underline-offset-4";

export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await getCurrentUser();
  const [t, format, [latest]] = await Promise.all([
    getTranslations("home"),
    getFormatter(),
    latestAssessments(db, user.id, 1),
  ]);

  return (
    <>
      <h1 className="type-wide text-4xl font-extrabold md:text-5xl">{t("greeting", { name: user.name })}</h1>
      {latest ? (
        <>
          <DailySession userId={user.id} />
          <p className="mt-10 max-w-[60ch] text-lg">
            {t("lastAssessment", {
              date: format.dateTime(latest.completedAt!, { dateStyle: "long" }),
              resistance: formatResistance(format, latest.results as AssessmentResults),
            })}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6">
            <Link href={`/bilan/resultats/${latest.id}`} className={SECONDARY}>
              {t("seeAssessment")}
            </Link>
            <Link href="/bilan" className={SECONDARY}>
              {t("retakeAssessment")}
            </Link>
          </div>
        </>
      ) : (
        // Without an assessment, the algorithm has no starting level: it comes first.
        <section className="mt-8 max-w-[60ch] rounded-lg bg-ardoise px-6 py-8 text-brume md:px-10">
          <h2 className="type-wide text-2xl font-bold text-chrono">{t("assessmentFirstTitle")}</h2>
          <p className="mt-3 text-lg text-trait">{t("assessmentFirstBody")}</p>
          <Link href="/bilan" className="mt-6 inline-block h-12 rounded-md bg-chrono px-6 leading-12 font-semibold text-ardoise">
            {t("assessmentFirstCta")}
          </Link>
        </section>
      )}
      <p className="mt-10 max-w-[60ch] text-lg">
        {t("freePracticeIntro")}{" "}
        <Link href="/entrainement" className="font-semibold underline underline-offset-4">
          {t("freePracticeLink")}
        </Link>
      </p>
    </>
  );
}

/** Today's session chosen from the week so far, with why it looks the way it does. */
async function DailySession({ userId }: { userId: string }) {
  const [t, daily, preferences, betPreviews, lightPreview, load] = await Promise.all([
    getTranslations("home.daily"),
    getDailySession(db, userId),
    getPreferences(db, userId),
    previewBetSession(db, userId),
    previewLightSession(db, userId),
    refreshLoad(db, userId),
  ]);
  const week = daily.week;

  return (
    <>
      {load.assessmentDue ? (
        <section className="mt-8 max-w-[62ch] rounded-lg bg-ardoise px-6 py-6 text-brume md:px-8">
          <h2 className="type-wide text-xl font-bold text-chrono">{t("assessmentDueTitle")}</h2>
          <p className="mt-2 text-trait">{t("assessmentDueBody")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6">
            <Link href="/bilan" className="inline-block h-12 rounded-md bg-chrono px-6 leading-12 font-semibold text-ardoise">
              {t("takeAssessment")}
            </Link>
            <PostponeAssessmentButton />
          </div>
        </section>
      ) : null}
      <section className="mt-8 max-w-[62ch] border-l-2 border-chrono pl-5 md:pl-6">
        <h2 className="type-wide text-2xl font-bold">
          {daily.done ? t("doneTitle") : t(`${daily.kind}Title`)}
        </h2>
        <div className="mt-3 text-lg">
          {daily.done ? (
            <p>{t("doneBody", { kind: daily.kind })}</p>
          ) : daily.kind === "bet" && betPreviews ? (
            <PlanExplanationText explanation={betPreviews[preferences.defaultDurationMin]} />
          ) : daily.kind === "light" && lightPreview ? (
            <>
              <p>{t("lightBody")}</p>
              <PlanExplanationText explanation={lightPreview} />
            </>
          ) : (
            <p>{t("restBody")}</p>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          {daily.done && daily.todaysSessionId ? (
            <Link href={`/seance/resultats/${daily.todaysSessionId}`} className={PRIMARY}>
              {t("seeSummary")}
            </Link>
          ) : daily.kind === "bet" ? (
            <Link href="/seance" className={PRIMARY}>
              {t("startBet")}
            </Link>
          ) : daily.kind === "light" ? (
            <>
              <Link href="/seance/legere" className={PRIMARY}>
                {t("startLight")}
              </Link>
              <Link href="/seance" className={SECONDARY}>
                {t("betInstead")}
              </Link>
            </>
          ) : (
            <Link href="/seance/legere" className={SECONDARY}>
              {t("lightAnyway")}
            </Link>
          )}
        </div>
        <p className="mt-6 text-schiste">
          {t("week", { betDone: week.betDone, betTarget: week.betTarget, lightDone: week.lightDone, goal: week.goal })}{" "}
          <Link href="/preferences" className="underline underline-offset-4">
            {t("changePreferences")}
          </Link>
        </p>
      </section>
    </>
  );
}

function formatResistance(format: Awaited<ReturnType<typeof getFormatter>>, results: AssessmentResults) {
  return results.fatigueResistance === null
    ? "—"
    : format.number(results.fatigueResistance, { style: "percent", maximumFractionDigits: 0 });
}
