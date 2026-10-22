import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { account, user } from "@/db/schema";
import { createAuth } from "@/lib/auth";

const db = createDb(process.env.DATABASE_URL!);
const auth = createAuth(db);

afterAll(async () => {
  await db.$client.end();
});

function credentials(label: string) {
  return { name: "Jakub", email: `${label}-${crypto.randomUUID()}@example.com`, password: "endurance-123" };
}

describe("email and password accounts", () => {
  it("signs up a user and stores a hashed password", async () => {
    const body = credentials("signup");
    const result = await auth.api.signUpEmail({ body });

    expect(result.user.email).toBe(body.email);
    const [stored] = await db.select().from(user).where(eq(user.email, body.email));
    expect(stored.name).toBe("Jakub");
    const [credential] = await db.select().from(account).where(eq(account.userId, stored.id));
    expect(credential.providerId).toBe("credential");
    expect(credential.password).not.toBe(body.password);
  });

  it("signs in with the right password and returns a session for that user", async () => {
    const body = credentials("signin");
    await auth.api.signUpEmail({ body });

    const result = await auth.api.signInEmail({ body: { email: body.email, password: body.password } });

    expect(result.user.email).toBe(body.email);
    expect(result.token).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    const body = credentials("wrong");
    await auth.api.signUpEmail({ body });

    await expect(
      auth.api.signInEmail({ body: { email: body.email, password: "not-the-password" } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });

  it("rejects a second account with the same email", async () => {
    const body = credentials("duplicate");
    await auth.api.signUpEmail({ body });

    await expect(auth.api.signUpEmail({ body })).rejects.toMatchObject({
      body: { code: expect.stringMatching(/^USER_ALREADY_EXISTS/) },
    });
  });

  it("rejects a password shorter than the minimum", async () => {
    await expect(
      auth.api.signUpEmail({ body: { ...credentials("short"), password: "court" } }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_TOO_SHORT" } });
  });
});
