"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

export function PostponeAssessmentButton() {
  const t = useTranslations("home.daily");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/load/postpone-assessment", { method: "POST" });
          router.refresh();
        })
      }
      className="leading-12 font-semibold underline underline-offset-4 disabled:opacity-70"
    >
      {pending ? t("postponing") : t("postponeAssessment")}
    </button>
  );
}
