"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("home");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.replace("/connexion");
          router.refresh();
        })
      }
      className="text-sm font-semibold underline underline-offset-4 disabled:opacity-70"
    >
      {pending ? t("signingOut") : t("signOut")}
    </button>
  );
}
