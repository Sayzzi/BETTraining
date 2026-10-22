import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RunResults } from "@/components/results/run-results";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { getRun, NotFoundError } from "@/server/training";

export default async function ResultsPage({ params }: PageProps<"/entrainement/resultats/[runId]">) {
  const t = await getTranslations("results");
  return (
    <>
      <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
        <Results params={params} />
      </Suspense>
      <div className="mt-12 flex flex-wrap gap-6">
        <Link href="/entrainement/pvt" className="h-12 rounded-md bg-ardoise px-6 leading-12 font-semibold text-brume">
          {t("again")}
        </Link>
        <Link href="/entrainement" className="leading-12 font-semibold underline underline-offset-4">
          {t("backToList")}
        </Link>
      </div>
    </>
  );
}

async function Results({ params }: { params: Promise<{ runId: string }> }) {
  const [{ runId }, user] = await Promise.all([params, getCurrentUser()]);
  const run = await getRun(db, user.id, runId).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return <RunResults run={run} />;
}
