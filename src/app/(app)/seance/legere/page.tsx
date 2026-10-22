import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SessionRunner } from "@/components/session/session-runner";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { previewLightSession } from "@/server/bet-session";

export default async function LightSessionPage() {
  const t = await getTranslations("session");
  return (
    <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
      <RequireAssessment />
    </Suspense>
  );
}

async function RequireAssessment() {
  const user = await getCurrentUser();
  const preview = await previewLightSession(db, user.id);
  if (!preview) redirect("/bilan");
  return <SessionRunner mode={{ kind: "light", preview }} />;
}
