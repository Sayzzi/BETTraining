import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type CurrentUser = { id: string; name: string };

// Reads the request, so callers must render behind a <Suspense> boundary.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");
  return { id: session.user.id, name: session.user.name };
});
