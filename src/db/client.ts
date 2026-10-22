import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(url: string) {
  const sql = postgres(url, { max: 10 });
  return drizzle(sql, { schema });
}

// One pool per server process, reused across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: Database };

function getDb() {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.db = createDb(url);
  }
  return globalForDb.db;
}

// Connects on first use, so `next build` can import this module without a database.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDb();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
