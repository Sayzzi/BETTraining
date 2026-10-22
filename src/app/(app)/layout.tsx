import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 md:px-6">
      <header className="flex items-center justify-between gap-6 border-b border-trait py-5">
        <Link href="/" className="type-wide text-lg font-bold">
          {t("brand")}
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/entrainement" className="text-sm font-semibold underline-offset-4 hover:underline">
            {t("nav.freePractice")}
          </Link>
          <SignOutButton />
        </nav>
      </header>
      <main className="flex-1 py-10 md:py-16">{children}</main>
    </div>
  );
}
