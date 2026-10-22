import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db, type Database } from "@/db/client";
import * as schema from "@/db/schema";

import { PASSWORD_MIN_LENGTH } from "@/lib/password";

export function createAuth(database: Database, plugins: BetterAuthPlugin[] = []) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      autoSignIn: true,
    },
    plugins,
  });
}

// nextCookies must stay last so cookies set by server actions reach the browser.
export const auth = createAuth(db, [nextCookies()]);
