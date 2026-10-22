import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FREE_PRACTICE_EXERCISES } from "@/engine/exercises";

export default async function FreePracticePage() {
  const t = await getTranslations("freePractice");
  return (
    <>
      <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-schiste">{t("intro")}</p>
      <ul className="mt-10 divide-y divide-trait border-y border-trait">
        {FREE_PRACTICE_EXERCISES.map((exercise) => (
          <li key={exercise}>
            <Link
              href={`/entrainement/${exercise}`}
              className="group flex flex-col gap-1 py-6 md:grid md:grid-cols-[12rem_1fr] md:items-baseline md:gap-8"
            >
              <span className="type-wide text-2xl font-bold group-hover:underline group-hover:underline-offset-4">
                {t(`${exercise}Name`)}
              </span>
              <span className="text-schiste">{t(`${exercise}Description`)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-schiste">{t("moreSoon")}</p>
    </>
  );
}
