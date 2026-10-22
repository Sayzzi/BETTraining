import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PreferencesForm } from "@/components/preferences-form";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { getPreferences } from "@/server/preferences";

export default async function PreferencesPage() {
  const t = await getTranslations("preferences");
  return (
    <>
      <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-schiste">{t("intro")}</p>
      <div className="mt-10">
        <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
          <Form />
        </Suspense>
      </div>
    </>
  );
}

async function Form() {
  const user = await getCurrentUser();
  return <PreferencesForm initial={await getPreferences(db, user.id)} />;
}
