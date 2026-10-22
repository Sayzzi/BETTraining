import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AssessmentResultsView } from "@/components/assessment/assessment-results";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { getAssessment } from "@/server/assessment";
import { NotFoundError } from "@/server/training";

export default async function AssessmentResultsPage({ params }: PageProps<"/bilan/resultats/[assessmentId]">) {
  const t = await getTranslations("assessmentResults");
  return (
    <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
      <Results params={params} />
    </Suspense>
  );
}

async function Results({ params }: { params: Promise<{ assessmentId: string }> }) {
  const [{ assessmentId }, user] = await Promise.all([params, getCurrentUser()]);
  const assessment = await getAssessment(db, user.id, assessmentId).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return <AssessmentResultsView assessment={assessment} />;
}
