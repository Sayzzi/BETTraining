import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/current-user";

export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <>
      <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
        <Greeting />
      </Suspense>
      <p className="mt-6 max-w-[60ch] text-lg text-schiste">{t("intro")}</p>
      <p className="mt-6 max-w-[60ch] text-lg">
        {t("freePracticeIntro")}{" "}
        <Link href="/entrainement" className="font-semibold underline underline-offset-4">
          {t("freePracticeLink")}
        </Link>
      </p>
    </>
  );
}

async function Greeting() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("home")]);
  return <h1 className="type-wide text-4xl font-extrabold md:text-5xl">{t("greeting", { name: user.name })}</h1>;
}
