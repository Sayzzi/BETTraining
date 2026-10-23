import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SessionRunner } from "@/components/session/session-runner";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { previewBetSession } from "@/server/bet-session";
import { getPreferences } from "@/server/preferences";

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
  const [previews, preferences] = await Promise.all([previewBetSession(db, user.id), getPreferences(db, user.id)]);
  if (!previews) redirect("/bilan");
  return <SessionRunner mode={{ kind: "bet", previews, defaultDurationMin: preferences.defaultDurationMin }} />;
}
