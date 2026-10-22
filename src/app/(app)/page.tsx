import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { db } from "@/db/client";
import type { AssessmentResults } from "@/engine/assessment";
import { getCurrentUser } from "@/lib/current-user";
import { latestAssessments } from "@/server/assessment";

const PRIMARY = "inline-block h-12 rounded-md bg-ardoise px-6 leading-12 font-semibold text-brume hover:bg-ardoise/90";

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
        <section className="mt-8 max-w-[60ch]">
          <p className="text-lg">
            {t("lastAssessment", {
              date: format.dateTime(latest.completedAt!, { dateStyle: "long" }),
              resistance: formatResistance(format, latest.results as AssessmentResults),
            })}
          </p>
          <div className="mt-6 flex flex-wrap gap-6">
            <Link href={`/bilan/resultats/${latest.id}`} className={PRIMARY}>
              {t("seeAssessment")}
            </Link>
            <Link href="/bilan" className="leading-12 font-semibold underline underline-offset-4">
              {t("retakeAssessment")}
            </Link>
          </div>
          <p className="mt-8 text-schiste">{t("dailySessionSoon")}</p>
        </section>
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

function formatResistance(format: Awaited<ReturnType<typeof getFormatter>>, results: AssessmentResults) {
  return results.fatigueResistance === null
    ? "—"
    : format.number(results.fatigueResistance, { style: "percent", maximumFractionDigits: 0 });
}
