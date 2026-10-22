import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function FreePracticePage() {
  const t = await getTranslations("freePractice");
  return (
    <>
      <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-schiste">{t("intro")}</p>
      <ul className="mt-10 divide-y divide-trait border-y border-trait">
        <li>
          <Link href="/entrainement/pvt" className="group flex flex-col gap-1 py-6 md:flex-row md:items-baseline md:gap-8">
            <span className="type-wide text-2xl font-bold group-hover:underline group-hover:underline-offset-4">
              {t("pvtName")}
            </span>
            <span className="text-schiste">{t("pvtDescription")}</span>
          </Link>
        </li>
      </ul>
      <p className="mt-6 text-sm text-schiste">{t("moreSoon")}</p>
    </>
  );
}
