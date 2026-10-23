import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ProgressView } from "@/components/progress/progress-view";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { getProgress } from "@/server/progress";

export default async function ProgressPage() {
  const t = await getTranslations("progress");
  return (
    <>
      <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
      <div className="mt-10">
        <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
          <Data />
        </Suspense>
      </div>
    </>
  );
}

async function Data() {
  const user = await getCurrentUser();
  return <ProgressView progress={await getProgress(db, user.id)} />;
}
