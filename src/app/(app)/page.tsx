import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/current-user";

export default async function HomePage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between border-b border-trait py-5">
        <p className="type-wide text-lg font-bold">{t("brand")}</p>
        <SignOutButton />
      </header>
      <main className="py-12 md:py-20">
        <Suspense fallback={<p className="text-schiste">{t("home.loading")}</p>}>
          <Greeting />
        </Suspense>
        <p className="mt-6 max-w-[60ch] text-lg text-schiste">{t("home.intro")}</p>
      </main>
    </div>
  );
}

async function Greeting() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("home")]);
  return (
    <h1 className="type-wide text-4xl font-extrabold md:text-5xl">
      {t("greeting", { name: user.name })}
    </h1>
  );
}
