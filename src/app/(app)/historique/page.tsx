import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SessionList } from "@/components/history/session-list";
import { db } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { listSessions } from "@/server/history";

export default async function HistoryPage({ searchParams }: PageProps<"/historique">) {
  const t = await getTranslations("history");
  return (
    <>
      <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-schiste">{t("intro")}</p>
      <div className="mt-10">
        <Suspense fallback={<p className="text-schiste">{t("loading")}</p>}>
          <History searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function History({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, user, t] = await Promise.all([searchParams, getCurrentUser(), getTranslations("history")]);
  const raw = typeof params.avant === "string" ? new Date(params.avant) : null;
  const before = raw && !Number.isNaN(raw.getTime()) ? raw : undefined;
  const { sessions, hasMore } = await listSessions(db, user.id, { before });

  if (sessions.length === 0) {
    return (
      <div className="max-w-[60ch]">
        <p className="text-lg">{t(before ? "noOlder" : "empty")}</p>
        <Link href={before ? "/historique" : "/entrainement"} className="mt-4 inline-block font-semibold underline underline-offset-4">
          {t(before ? "latest" : "startPractice")}
        </Link>
      </div>
    );
  }
  return (
    <>
      <SessionList sessions={sessions} />
      <div className="mt-8 flex flex-wrap gap-6">
        {before ? (
          <Link href="/historique" className="font-semibold underline underline-offset-4">
            {t("latest")}
          </Link>
        ) : null}
        {hasMore ? (
          <Link
            href={`/historique?avant=${encodeURIComponent(sessions.at(-1)!.startedAt.toISOString())}`}
            className="font-semibold underline underline-offset-4"
          >
            {t("older")}
          </Link>
        ) : null}
      </div>
    </>
  );
}
