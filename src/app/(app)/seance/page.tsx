import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SessionRunner } from "@/components/session/session-runner";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { hasCompletedAssessment } from "@/server/assessment";

export default async function SessionPage() {
  const t = await getTranslations("session");
  return (
    <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
      <RequireAssessment />
    </Suspense>
  );
}

/** The session plan starts from the assessment, so users without one go there first. */
async function RequireAssessment() {
  const user = await getCurrentUser();
  if (!(await hasCompletedAssessment(db, user.id))) redirect("/bilan");
  return <SessionRunner />;
}
