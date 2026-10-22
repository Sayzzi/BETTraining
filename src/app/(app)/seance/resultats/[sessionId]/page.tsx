import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SessionSummaryView } from "@/components/session/session-summary";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { getBetSessionSummary } from "@/server/bet-session";
import { NotFoundError } from "@/server/training";

export default async function SessionSummaryPage({ params }: PageProps<"/seance/resultats/[sessionId]">) {
  const t = await getTranslations("sessionSummary");
  return (
    <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
      <Summary params={params} />
    </Suspense>
  );
}

async function Summary({ params }: { params: Promise<{ sessionId: string }> }) {
  const [{ sessionId }, user] = await Promise.all([params, getCurrentUser()]);
  const summary = await getBetSessionSummary(db, user.id, sessionId).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return <SessionSummaryView summary={summary} />;
}
