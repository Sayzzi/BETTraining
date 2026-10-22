import { getTranslations } from "next-intl/server";
import { ChronoCounter } from "@/components/chrono-counter";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <section
        aria-hidden="true"
        className="flex flex-col justify-between gap-6 bg-ardoise px-6 py-6 text-brume md:px-12 md:py-12"
      >
        <p className="type-wide text-lg font-bold">{t("brand")}</p>
        <div>
          <p className="type-wide flex items-baseline gap-3 leading-none font-extrabold text-chrono">
            <span className="text-[clamp(4.5rem,16vw,11rem)]">
              <ChronoCounter reactionMs={287} />
            </span>
            <span className="text-2xl md:text-4xl">{t("chrono.unit")}</span>
          </p>
          <p className="mt-6 hidden max-w-[36ch] text-lg text-trait md:block">
            {t("chrono.caption")}
          </p>
        </div>
      </section>
      <main className="flex items-center px-6 py-10 md:px-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
