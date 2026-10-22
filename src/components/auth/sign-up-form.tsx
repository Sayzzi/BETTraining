"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { toAuthErrorKey, type AuthErrorKey } from "./auth-error";
import { Field } from "./field";
import { SubmitButton } from "./submit-button";

export function SignUpForm() {
  const t = useTranslations("signUp");
  const tError = useTranslations("authErrors");
  const router = useRouter();

  const [errorKey, submit, pending] = useActionState(
    async (_previous: AuthErrorKey | null, formData: FormData) => {
      const { error } = await authClient.signUp.email({
        name: String(formData.get("name")).trim(),
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      });
      if (error) return toAuthErrorKey(error.code);
      router.replace("/");
      router.refresh();
      return null;
    },
    null,
  );

  return (
    <>
      <h1 className="type-wide text-3xl font-extrabold">{t("title")}</h1>
      <form action={submit} className="mt-8 flex flex-col gap-5">
        <Field id="name" name="name" type="text" autoComplete="given-name" required label={t("name")} />
        <Field id="email" name="email" type="email" autoComplete="email" required label={t("email")} />
        <Field
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          label={t("password")}
          hint={t("passwordHint", { min: PASSWORD_MIN_LENGTH })}
        />
        {errorKey ? (
          <p role="alert" className="text-sm font-semibold text-alerte">
            {tError(errorKey, { min: PASSWORD_MIN_LENGTH })}
          </p>
        ) : null}
        <SubmitButton pending={pending} label={t("submit")} pendingLabel={t("pending")} />
      </form>
      <p className="mt-8 text-sm text-schiste">
        {t("hasAccount")}{" "}
        <Link href="/connexion" className="font-semibold text-ardoise underline underline-offset-4">
          {t("toSignIn")}
        </Link>
      </p>
    </>
  );
}
