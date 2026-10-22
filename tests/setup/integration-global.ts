import postgres from "postgres";
import { runMigrations } from "../../src/db/migrate";

// Expects the test database from `pnpm db:test:up`; wipes it and applies migrations.
export default async function setup() {
  const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL!;
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await sql`drop schema if exists public cascade`;
    await sql`drop schema if exists drizzle cascade`;
    await sql`create schema public`;
  } catch (error) {
    throw new Error(
      `Test database unreachable at ${TEST_DATABASE_URL}. Run \`pnpm db:test:up\` first.`,
      { cause: error },
    );
  } finally {
    await sql.end();
  }
  await runMigrations(TEST_DATABASE_URL);
}
