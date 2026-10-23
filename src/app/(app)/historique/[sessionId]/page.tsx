import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SessionDetailView } from "@/components/history/session-detail";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { getSessionDetail } from "@/server/history";
import { NotFoundError } from "@/server/training";

export default async function SessionDetailPage({ params }: PageProps<"/historique/[sessionId]">) {
  const t = await getTranslations("history");
  return (
    <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ sessionId: string }> }) {
  const [{ sessionId }, user] = await Promise.all([params, getCurrentUser()]);
  const session = await getSessionDetail(db, user.id, sessionId).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return <SessionDetailView session={session} />;
}
